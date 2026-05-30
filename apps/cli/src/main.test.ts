import { describe, expect, test } from "bun:test";
import type { PluginInfo } from "@kogoro/plugins";
import { run } from "./main";

async function captureConsoleLogAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; logs: string[] }> {
  const origLog = console.log;
  const logs: string[] = [];
  console.log = (msg: string) => logs.push(msg);
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.log = origLog;
  }
}

describe("kogoro CLI", () => {
  test("module loads", () => {
    expect(true).toBe(true);
  });

  test("plugins list command returns JSON", async () => {
    const { logs } = await captureConsoleLogAsync(() => run(["node", "kogoro", "plugins", "list"]));
    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0] ?? "[]") as Array<PluginInfo>;
    const tvdb = parsed.find((p) => p.name === "tvdb");
    expect(tvdb).toBeDefined();
    expect(tvdb?.type).toBe("database");
    expect(tvdb?.source).toBe("built-in");
  });
});
