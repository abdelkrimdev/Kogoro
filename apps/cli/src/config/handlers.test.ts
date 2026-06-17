import { describe, expect, test } from "bun:test";
import { ConfigManager } from "@kogoro/core";
import { withTempDir } from "@kogoro/core/testing";
import { createConfigHandlers } from "./handlers";

describe("Config CLI commands", () => {
  test("returns value for existing key", async () => {
    await withTempDir("cli-config", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      await config.set("primaryDb", "anidb");
      const handlers = createConfigHandlers({ configDir: dir });
      expect(handlers.get("primary-db")).toBe("anidb");
    });
  });

  test("returns undefined for unset key", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      expect(handlers.get("nonexistent")).toBeUndefined();
    });
  });

  test("set persists value and returns true", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      const result = handlers.set("scan-concurrency", "8");
      expect(result).toBe(true);
      const config = new ConfigManager({ configDir: dir });
      expect(config.scanConcurrency).toBe(8);
    });
  });

  test("init creates config file with defaults", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      const prompts = {
        intro: () => {},
        outro: () => {},
        select: async () => "tvdb",
        text: async () => "",
        confirm: async () => true,
        cancel: () => {},
        isCancel: () => false,
      };
      await handlers.init(prompts);
      const config = new ConfigManager({ configDir: dir });
      expect(config.primaryDb).toBe("tvdb");
      expect(config.scanConcurrency).toBe(4);
    });
  });

  describe("config set with template presets", () => {
    test("accepts valid preset name", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        const result = handlers.set("template.preset", "plex");
        expect(result).toBe(true);
        const config = new ConfigManager({ configDir: dir });
        expect(config.template.preset).toBe("plex");
        expect(config.getTemplate()).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      });
    });

    test("throws for unknown preset name", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        expect(() => handlers.set("template.preset", "nonexistent")).toThrow("nonexistent");
        const config = new ConfigManager({ configDir: dir });
        expect(config.template.preset).toBe("standard");
      });
    });
  });

  describe("config set schema validation", () => {
    test("throws for invalid number type", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        expect(() => handlers.set("scan-concurrency", "eight")).toThrow("number");
      });
    });

    test("accepts valid number value", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        const result = handlers.set("scan-concurrency", "8");
        expect(result).toBe(true);
        const config = new ConfigManager({ configDir: dir });
        expect(config.scanConcurrency).toBe(8);
      });
    });

    test("throws for unknown top-level key", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        expect(() => handlers.set("unknown-key", "value")).toThrow("unknown-key");
      });
    });

    test("throws for unknown nested key", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        expect(() => handlers.set("template.unknown", "value")).toThrow("template.unknown");
      });
    });
  });

  describe("config get", () => {
    test("returns array for media-extensions", async () => {
      await withTempDir("cli-config", async (dir) => {
        const config = new ConfigManager({ configDir: dir });
        const handlers = createConfigHandlers({ configDir: dir });
        expect(handlers.get("media-extensions")).toEqual(config.mediaExtensions);
      });
    });

    test("returns number for scan-concurrency", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        expect(handlers.get("scan-concurrency")).toBe(4);
      });
    });
  });
});
