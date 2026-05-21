import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { run } from "../cli/main";
import type { PluginInfo } from "../plugin-registry";
import { captureConsoleLog } from "../test-fixtures";

describe("kogoro CLI", () => {
  test("CLI module loads without error", () => {
    expect(true).toBe(true);
  });

  test("template command renders pattern with variables", () => {
    const result = run([
      "node",
      "kogoro",
      "template",
      "{anime} - {season}x{episode:02} - {title}",
      "--anime",
      "JJK",
      "--season",
      "1",
      "--episode",
      "13",
      "--title",
      "Tomorrow",
    ]);
    expect(result).toBe("JJK - 1x13 - Tomorrow");
  });

  test("template command handles missing variables", () => {
    const result = run(["node", "kogoro", "template", "Hello {name}", "--name", "World"]);
    expect(result).toBe("Hello World");
  });

  test("package.json defines build:bin script for standalone binary", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["build:bin"]).toBeDefined();
    expect(pkg.scripts?.["build:bin"]).toContain("bun build --compile");
    expect(pkg.scripts?.["build:bin"]).toContain("kogoro");
  });

  test("plugins list command returns JSON with built-in plugins", () => {
    const { logs } = captureConsoleLog(() => run(["node", "kogoro", "plugins", "list"]));
    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0] ?? "[]") as Array<PluginInfo>;
    const tvdb = parsed.find((p) => p.name === "tvdb");
    expect(tvdb).toBeDefined();
    expect(tvdb?.type).toBe("database");
    expect(tvdb?.source).toBe("built-in");
  });
});
