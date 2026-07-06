import { describe, expect, test } from "bun:test";

describe("ConnectTrackerDialog timeout handling", () => {
  test("callback-server returns empty code on timeout", async () => {
    const { CallbackServer } = await import("../../bun/callback-server");

    const server = new CallbackServer({ port: 43228, timeout: 50 });
    await server.start();

    try {
      const state = server.generateState();
      let receivedResult: { code: string; state: string } = { code: "", state: "" };

      server.waitForCallback(state, (result) => {
        receivedResult = result;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(receivedResult).toEqual({ code: "", state: "" });
    } finally {
      await server.stop();
    }
  });
});
