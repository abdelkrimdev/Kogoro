import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfigHandlers } from "../src/cli/config-commands.ts";
import { ConfigManager } from "../src/config/config-manager.ts";

describe("Config CLI commands", () => {
  function setupTempDir(): string {
    return mkdtempSync(join(tmpdir(), "kogoro-cli-config-"));
  }

  function cleanupTempDir(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

  test("config get returns set value", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      await config.set("primary-db", "anidb");
      const handlers = createConfigHandlers({ configDir: dir });
      let output = "";
      const log = (msg: string) => {
        output = msg;
      };
      await handlers.get("primary-db", log, () => {});
      expect(output).toBe("anidb");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config get returns message for unset key", async () => {
    const dir = setupTempDir();
    try {
      const handlers = createConfigHandlers({ configDir: dir });
      let errOutput = "";
      const log = () => {};
      const error = (msg: string) => {
        errOutput = msg;
      };
      await handlers.get("nonexistent", log, error);
      expect(errOutput).toBe("Config key 'nonexistent' is not set");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config set persists value", async () => {
    const dir = setupTempDir();
    try {
      const handlers = createConfigHandlers({ configDir: dir });
      await handlers.set("concurrency", "8", () => {});
      const config = new ConfigManager({ configDir: dir });
      expect(await config.get("concurrency")).toBe("8");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config init creates config file with defaults", async () => {
    const dir = setupTempDir();
    try {
      const handlers = createConfigHandlers({ configDir: dir });
      const prompts = {
        intro: () => {},
        outro: () => {},
        select: async () => "tvdb" as string,
        text: async () => "" as string,
        confirm: async () => true as boolean,
        isCancel: () => false,
      };
      await handlers.init(prompts, () => {});

      const config = new ConfigManager({ configDir: dir });
      expect(await config.get("primary-db")).toBe("tvdb");
      expect(await config.get("concurrency")).toBe("4");
    } finally {
      cleanupTempDir(dir);
    }
  });
});
