import { describe, expect, test } from "bun:test";
import { type DebugEntry, HttpClient } from "./http-client";
import { createCountingFetch, createMockResponse, createSequenceFetch } from "./test-helpers";

describe("HttpClient", () => {
  describe("rate limiting", () => {
    test("enforces minimum delay between consecutive requests", async () => {
      const mock = createCountingFetch();

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
      const mock = createCountingFetch();

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
      const seq = createSequenceFetch(
        createMockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        createMockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        createMockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
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
      const seq = createSequenceFetch(
        createMockResponse("rate limited", { status: 429, headers: { "Retry-After": "0" } }),
        createMockResponse("ok", { status: 200 }),
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
      const seq = createSequenceFetch(
        createMockResponse("server error", { status: 500 }),
        createMockResponse("server error", { status: 500 }),
        createMockResponse("server error", { status: 500 }),
        createMockResponse("server error", { status: 500 }),
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
      const seq = createSequenceFetch(createMockResponse("not found", { status: 404 }));

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
      const seq = createSequenceFetch(createMockResponse("forbidden", { status: 403 }));

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

  describe("debug callback", () => {
    test("calls onDebug before and after fetch with request/response details", async () => {
      const entries: DebugEntry[] = [];
      const client = new HttpClient({
        minDelay: 0,
        fetch: () => Promise.resolve(createMockResponse('{"key": "value"}', { status: 200 })),
        onDebug: (entry) => {
          entries.push(entry);
        },
      });

      await client.fetch("http://test.com/api");

      expect(entries).toHaveLength(2);
      expect(entries[0]?.type).toBe("request");
      expect(entries[0]?.url).toBe("http://test.com/api");
      expect(entries[0]?.method).toBe("GET");
      expect(entries[1]?.type).toBe("response");
      expect(entries[1]?.url).toBe("http://test.com/api");
      expect(entries[1]?.method).toBe("GET");
      expect(entries[1]?.status).toBe(200);
    });

    test("response body is truncated at 4096 characters", async () => {
      const longBody = "x".repeat(5000);
      const entries: DebugEntry[] = [];
      const client = new HttpClient({
        minDelay: 0,
        fetch: () => Promise.resolve(createMockResponse(longBody, { status: 200 })),
        onDebug: (entry) => {
          entries.push(entry);
        },
      });

      await client.fetch("http://test.com/long");

      expect(entries).toHaveLength(2);
      const body = entries[1]?.body ?? "";
      expect(body.length).toBeLessThanOrEqual(4100);
      expect(body.endsWith("...")).toBe(true);
    });

    test("no debug callback provided does not throw", async () => {
      const client = new HttpClient({
        minDelay: 0,
        fetch: () => Promise.resolve(createMockResponse("ok", { status: 200 })),
      });

      await expect(client.fetch("http://test.com/noop")).resolves.toBeDefined();
    });

    test("response body is still readable after debug callback", async () => {
      const entries: DebugEntry[] = [];
      const client = new HttpClient({
        minDelay: 0,
        fetch: () => Promise.resolve(createMockResponse("hello world", { status: 200 })),
        onDebug: (entry) => {
          entries.push(entry);
        },
      });

      const response = await client.fetch("http://test.com/readable");
      const body = await response.text();
      expect(body).toBe("hello world");
    });
  });
});
