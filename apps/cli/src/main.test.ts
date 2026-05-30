import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { captureConsoleLog } from "@kogoro/core";
import type { PluginInfo } from "@kogoro/plugins";
import { run, wrapCommand } from "./main";

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

  test("plugins list command returns JSON", () => {
    const { logs } = captureConsoleLog(() => run(["node", "kogoro", "plugins", "list"]));
    expect(logs.length).toBeGreaterThan(0);
    const parsed = JSON.parse(logs[0] ?? "[]") as Array<PluginInfo>;
    const tvdb = parsed.find((p) => p.name === "tvdb");
    expect(tvdb).toBeDefined();
    expect(tvdb?.type).toBe("database");
    expect(tvdb?.source).toBe("built-in");
  });
});

describe("wrapCommand", () => {
  test("serializes handler result as JSON to stdout", async () => {
    const outputs: string[] = [];
    const handler = async () => ({ items: [1, 2, 3] });

    await wrapCommand(handler, {
      stdout: (msg: string) => outputs.push(msg),
    });

    expect(outputs).toHaveLength(1);
    const parsed = JSON.parse(outputs[0] ?? "null");
    expect(parsed).toEqual({ items: [1, 2, 3] });
  });

  test("writes error to stderr and exits with code 1 on failure", async () => {
    const errors: string[] = [];
    let exitCode: number | undefined;
    const handler = async () => {
      throw new Error("Database unreachable");
    };

    await wrapCommand(handler, {
      stderr: (msg: string) => errors.push(msg),
      exit: (code: number) => {
        exitCode = code;
      },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Database unreachable");
    expect(exitCode).toBe(1);
  });
});
