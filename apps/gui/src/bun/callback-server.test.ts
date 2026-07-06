import { afterEach, describe, expect, test } from "bun:test";
import { CallbackServer } from "./callback-server";

describe("CallbackServer", () => {
  let server: CallbackServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  test("generates unique state parameters", () => {
    server = new CallbackServer({ port: 43220 });
    const state1 = server.generateState();
    const state2 = server.generateState();

    expect(state1).not.toBe(state2);
    expect(state1.length).toBe(64);
    expect(state2.length).toBe(64);
  });

  test("starts and stops server", async () => {
    server = new CallbackServer({ port: 43221 });
    await server.start();

    const response = await fetch("http://localhost:43221/callback/mal?code=test&state=teststate");
    expect(response.status).toBe(400);

    await server.stop();
    server = null;

    try {
      await fetch("http://localhost:43221/callback/mal?code=test&state=teststate");
      expect(true).toBe(false);
    } catch {
      expect(true).toBe(true);
    }
  });

  test("handles MAL callback with valid state", async () => {
    server = new CallbackServer({ port: 43222 });
    await server.start();

    const state = server.generateState();
    let receivedResult: { code: string; state: string } = { code: "", state: "" };

    server.waitForCallback(state, (result) => {
      receivedResult = result;
    });

    const response = await fetch(
      `http://localhost:43222/callback/mal?code=auth-code-123&state=${state}`,
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Authorization Successful");
    expect(html).toContain("MyAnimeList");

    expect(receivedResult).toEqual({ code: "auth-code-123", state });
  });

  test("handles AniList callback with valid state", async () => {
    server = new CallbackServer({ port: 43223 });
    await server.start();

    const state = server.generateState();
    let receivedResult: { code: string; state: string } = { code: "", state: "" };

    server.waitForCallback(state, (result) => {
      receivedResult = result;
    });

    const response = await fetch(
      `http://localhost:43223/callback/anilist?code=anilist-code-456&state=${state}`,
    );

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Authorization Successful");
    expect(html).toContain("AniList");

    expect(receivedResult).toEqual({ code: "anilist-code-456", state });
  });

  test("rejects callback with invalid state", async () => {
    server = new CallbackServer({ port: 43224 });
    await server.start();

    const response = await fetch(
      "http://localhost:43224/callback/mal?code=test&state=invalidstate",
    );

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("Invalid or expired state parameter");
  });

  test("rejects callback with missing parameters", async () => {
    server = new CallbackServer({ port: 43225 });
    await server.start();

    const response = await fetch("http://localhost:43225/callback/mal?code=test");

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("Missing code or state parameter");
  });

  test("returns 404 for unknown paths", async () => {
    server = new CallbackServer({ port: 43226 });
    await server.start();

    const response = await fetch("http://localhost:43226/unknown");

    expect(response.status).toBe(404);
  });

  test("times out waiting for callback", async () => {
    server = new CallbackServer({ port: 43227, timeout: 100 });
    await server.start();

    const state = server.generateState();
    let receivedResult: { code: string; state: string } = { code: "", state: "" };

    server.waitForCallback(state, (result) => {
      receivedResult = result;
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receivedResult).toEqual({ code: "", state: "" });
  });

  test("auto-stops after successful callback when no more pending states", async () => {
    server = new CallbackServer({ port: 43228 });
    await server.start();

    const state = server.generateState();
    let receivedResult: { code: string; state: string } = { code: "", state: "" };

    server.waitForCallback(state, (result) => {
      receivedResult = result;
    });

    const preResponse = await fetch("http://localhost:43228/unknown");
    expect(preResponse.status).toBe(404);

    await fetch(`http://localhost:43228/callback/mal?code=test-code&state=${state}`);

    expect(receivedResult).toEqual({ code: "test-code", state });

    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      await fetch("http://localhost:43228/callback/mal?code=test&state=test");
      expect(true).toBe(false);
    } catch {
      expect(true).toBe(true);
    }

    server = null;
  });
});
