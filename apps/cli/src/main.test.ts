import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureConsoleLog } from "@kogoro/core";
import type { PluginInfo } from "@kogoro/plugins";
import { run } from "./main";

describe("kogoro CLI", () => {
  test("CLI module loads without error", () => {
    expect(true).toBe(true);
  });

  test("package.json defines build:bin script for standalone binary", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["build:bin"]).toBeDefined();
    expect(pkg.scripts?.["build:bin"]).toContain("bun build --compile");
    expect(pkg.scripts?.["build:bin"]).toContain("kogoro");
  });

  test("plugins list command returns JSON with built-in plugins", () => {
    const { logs } = captureConsoleLog(() => run(["node", "kogoro", "plugins", "list", "--json"]));
    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0] ?? "[]") as Array<PluginInfo>;
    const tvdb = parsed.find((p) => p.name === "tvdb");
    expect(tvdb).toBeDefined();
    expect(tvdb?.type).toBe("database");
    expect(tvdb?.source).toBe("built-in");
  });
});
