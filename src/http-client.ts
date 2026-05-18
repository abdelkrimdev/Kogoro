export interface HttpClientOptions {
  minDelay?: number;
  maxRetries?: number;
  backoffBase?: number;
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
}

export class HttpClient {
  private minDelay: number;
  private maxRetries: number;
  private backoffBase: number;
  private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;
  private lastCallTime = 0;

  constructor(options: HttpClientOptions = {}) {
    this.minDelay = options.minDelay ?? 200;
    this.maxRetries = options.maxRetries ?? 3;
    this.backoffBase = options.backoffBase ?? 1000;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    await this.enforceRateLimit();
    return this.executeWithRetry(url, init);
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
