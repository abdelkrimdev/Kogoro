import { describe, expect, test } from "bun:test";
import { HttpClient } from "../src/http-client.ts";

function mockResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

function makeMockFetch() {
  let callCount = 0;
  return {
    getCallCount: () => callCount,
    fn: (_url: string | URL, _init?: RequestInit) => {
      callCount++;
      return Promise.resolve(mockResponse("ok", { status: 200 }));
    },
  };
}

function makeMockFetchSequence(...responses: Response[]) {
  let callCount = 0;
  return {
    getCallCount: () => callCount,
    fn: (_url: string | URL, _init?: RequestInit) => {
      if (callCount >= responses.length) {
        return Promise.resolve(mockResponse("ok", { status: 200 }));
      }
      const r = responses[callCount];
      if (r === undefined) return Promise.resolve(mockResponse("ok", { status: 200 }));
      callCount++;
      return Promise.resolve(r);
    },
  };
}

describe("HttpClient", () => {
  describe("rate limiting", () => {
    test("enforces minimum delay between consecutive requests", async () => {
      const mock = makeMockFetch();

      const client = new HttpClient({
        minDelay: 100,
        fetch: mock.fn,
      });

      const now = Date.now();
      await client.fetch("http://test.com/a");
      await client.fetch("http://test.com/b");

      const elapsed = Date.now() - now;
      expect(mock.getCallCount()).toBe(2);
      expect(elapsed).toBeGreaterThanOrEqual(90);
    });

    test("does not delay the first request", async () => {
      const mock = makeMockFetch();

      const client = new HttpClient({
        minDelay: 5000,
        fetch: mock.fn,
      });

      const now = Date.now();
      await client.fetch("http://test.com/a");
      const elapsed = Date.now() - now;

      expect(mock.getCallCount()).toBe(1);
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe("retry", () => {
    test("retries 429 response up to maxRetries with Retry-After delay", async () => {
      const seq = makeMockFetchSequence(
        mockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        mockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        mockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
      );

      const client = new HttpClient({
        minDelay: 0,
        maxRetries: 2,
        fetch: seq.fn,
      });

      const response = await client.fetch("http://test.com/429");

      expect(response.status).toBe(429);
      expect(seq.getCallCount()).toBe(3);
    });

    test("succeeds on retry when 429 then 200", async () => {
      const seq = makeMockFetchSequence(
        mockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        mockResponse("ok", { status: 200 }),
      );

      const client = new HttpClient({
        minDelay: 0,
        maxRetries: 2,
        fetch: seq.fn,
      });

      const response = await client.fetch("http://test.com/429-then-200");

      expect(response.status).toBe(200);
      expect(seq.getCallCount()).toBe(2);
    });

    test("retries 5xx response with exponential backoff", async () => {
      const timings: number[] = [];
      const seq = makeMockFetchSequence(
        mockResponse("server error", { status: 500 }),
        mockResponse("server error", { status: 500 }),
        mockResponse("server error", { status: 500 }),
        mockResponse("server error", { status: 500 }),
      );

      const client = new HttpClient({
        minDelay: 0,
        maxRetries: 3,
        backoffBase: 1,
        fetch(_url, _init) {
          timings.push(Date.now());
          return seq.fn(_url, _init);
        },
      });

      const start = Date.now();
      const response = await client.fetch("http://test.com/500");
      const elapsed = Date.now() - start;

      expect(seq.getCallCount()).toBe(4);
      expect(response.status).toBe(500);
      expect(elapsed).toBeGreaterThanOrEqual(1 + 2 + 4);
    });

    test("non-retryable 4xx returns immediately without retry", async () => {
      const seq = makeMockFetchSequence(mockResponse("not found", { status: 404 }));

      const client = new HttpClient({
        minDelay: 0,
        maxRetries: 3,
        fetch: seq.fn,
      });

      const response = await client.fetch("http://test.com/404");

      expect(seq.getCallCount()).toBe(1);
      expect(response.status).toBe(404);
    });

    test("403 returns immediately without retry", async () => {
      const seq = makeMockFetchSequence(mockResponse("forbidden", { status: 403 }));

      const client = new HttpClient({
        minDelay: 0,
        maxRetries: 3,
        fetch: seq.fn,
      });

      const response = await client.fetch("http://test.com/403");

      expect(seq.getCallCount()).toBe(1);
      expect(response.status).toBe(403);
    });
  });
});
