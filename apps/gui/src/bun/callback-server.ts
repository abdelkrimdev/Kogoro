export interface CallbackServerOptions {
  port?: number;
  timeout?: number;
}

export interface CallbackResult {
  code: string;
  state: string;
}

export type CallbackHandler = (result: CallbackResult) => void;

function authorizationSuccessHtml(trackerName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>${trackerName} Authorization</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
    .success { color: #22c55e; font-size: 24px; }
    .message { color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="success">Authorization Successful!</div>
  <div class="message">You can close this window and return to Kogoro.</div>
</body>
</html>`;
}

function fragmentHandlerHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>AniList Authorization</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
    .success { color: #22c55e; font-size: 24px; }
    .message { color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="success">Processing authorization...</div>
  <div class="message">Please wait while we complete your authorization.</div>
  <script>
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');
    if (accessToken && state) {
      window.location.href = '/callback/anilist?access_token=' + encodeURIComponent(accessToken) + '&state=' + encodeURIComponent(state);
    } else {
      document.querySelector('.success').textContent = 'Authorization Failed';
      document.querySelector('.message').textContent = 'Missing access token or state parameter.';
    }
  </script>
</body>
</html>`;
}

export class CallbackServer {
  private port: number;
  private timeout: number;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private pendingStates = new Map<
    string,
    { handler: CallbackHandler; timer: ReturnType<typeof setTimeout> }
  >();

  constructor(options: CallbackServerOptions = {}) {
    this.port = options.port ?? 43219;
    this.timeout = options.timeout ?? 60000;
  }

  generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    this.server = Bun.serve({
      port: this.port,
      fetch: (req) => this.handleRequest(req),
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.server.stop();
    this.server = null;

    for (const [, { handler, timer }] of this.pendingStates) {
      clearTimeout(timer);
      handler({ code: "", state: "" });
    }
    this.pendingStates.clear();
  }

  waitForCallback(state: string, handler: CallbackHandler): void {
    const timer = setTimeout(() => {
      this.pendingStates.delete(state);
      handler({ code: "", state: "" });
    }, this.timeout);

    this.pendingStates.set(state, { handler, timer });
  }

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/callback/mal" || url.pathname === "/callback/anilist") {
      const code = url.searchParams.get("code");
      const accessToken = url.searchParams.get("access_token");
      const state = url.searchParams.get("state");
      const trackerName = url.pathname.includes("mal") ? "MyAnimeList" : "AniList";

      // For AniList without query params, serve HTML with JS to handle fragment
      if (url.pathname === "/callback/anilist" && !code && !accessToken && !state) {
        return new Response(fragmentHandlerHtml(), {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Handle normal callback with code or access_token
      const token = code || accessToken;
      if (!token || !state) {
        return new Response("Missing code/state or access_token/state parameter", { status: 400 });
      }

      const pending = this.pendingStates.get(state);
      if (!pending) {
        return new Response("Invalid or expired state parameter", { status: 400 });
      }

      clearTimeout(pending.timer);
      this.pendingStates.delete(state);

      pending.handler({ code: token, state });

      if (this.pendingStates.size === 0 && this.server) {
        this.server.stop();
        this.server = null;
      }

      return new Response(authorizationSuccessHtml(trackerName), {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
