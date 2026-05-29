export interface DebugEntry {
  type: "request" | "response";
  url: string;
  method: string;
  status?: number;
  body?: string;
  ms?: number;
}

type DebugCallback = (entry: DebugEntry) => void;

interface HttpClientOptions {
  minDelay?: number;
  maxRetries?: number;
  backoffBase?: number;
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
  onDebug?: DebugCallback;
}

export class HttpClient {
  private minDelay: number;
  private maxRetries: number;
  private backoffBase: number;
  private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;
  private onDebug?: DebugCallback;
  private lastCallTime = 0;

  constructor(options: HttpClientOptions = {}) {
    this.minDelay = options.minDelay ?? 200;
    this.maxRetries = options.maxRetries ?? 3;
    this.backoffBase = options.backoffBase ?? 1000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.onDebug = options.onDebug;
  }

  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof url === "string" ? url : url.toString();
    const method = init?.method ?? "GET";
    const startTime = Date.now();

    this.onDebug?.({ type: "request", url: urlStr, method });
    await this.enforceRateLimit();
    const response = await this.executeWithRetry(url, init);
    return this.debugResponse(response, urlStr, method, startTime);
  }

  private async debugResponse(
    response: Response,
    url: string,
    method: string,
    startTime: number,
  ): Promise<Response> {
    if (!this.onDebug) return response;

    const bodyText = await response.text();
    const ms = Date.now() - startTime;
    const truncated = bodyText.length <= 200 ? bodyText : `${bodyText.slice(0, 200)}...`;

    this.onDebug({
      type: "response",
      url,
      method,
      status: response.status,
      body: truncated,
      ms,
    });

    return new Response(bodyText, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (this.lastCallTime > 0 && elapsed < this.minDelay) {
      await sleep(this.minDelay - elapsed);
    }
    this.lastCallTime = Date.now();
  }

  private async executeWithRetry(
    url: string | URL,
    init?: RequestInit,
    attempt: number = 0,
  ): Promise<Response> {
    const response = await this.fetchFn(url, init);

    if (response.ok) {
      this.lastCallTime = Date.now();
      return response;
    }

    if (response.status === 429 && attempt < this.maxRetries) {
      const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
      await sleep(retryAfter * 1000);
      return this.executeWithRetry(url, init, attempt + 1);
    }

    if (response.status >= 500 && attempt < this.maxRetries) {
      const delay = this.backoffBase * 2 ** attempt;
      await sleep(delay);
      return this.executeWithRetry(url, init, attempt + 1);
    }

    this.lastCallTime = Date.now();
    return response;
  }
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 5;
  const parsed = Number(value);
  if (!Number.isNaN(parsed)) return parsed;
  return 5;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
