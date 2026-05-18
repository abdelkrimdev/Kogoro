import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "../src/config/config-manager.ts";

describe("ConfigManager", () => {
  function setupTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-config-test-"));
    return dir;
  }

  function cleanupTempDir(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

  test("set then get persists and retrieves a value", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      await mgr.set("primary-db", "tvdb");
      const val = await mgr.get("primary-db");
      expect(val).toBe("tvdb");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("persisted value survives re-initialization", async () => {
    const dir = setupTempDir();
    try {
      const mgr1 = new ConfigManager({ configDir: dir });
      await mgr1.set("primary-db", "anidb");

      const mgr2 = new ConfigManager({ configDir: dir });
      const val = await mgr2.get("primary-db");
      expect(val).toBe("anidb");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config file is written to disk", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      await mgr.set("concurrency", "4");
      const configPath = join(dir, "config.toml");
      expect(existsSync(configPath)).toBe(true);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config init creates file with defaults", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      await mgr.init();
      expect(await mgr.get("primary-db")).toBe("tvdb");
      expect(await mgr.get("template.string")).toBe("{anime} - {season}x{episode:02} - {title}");
      expect(await mgr.get("extensions")).toBe(".mkv,.mp4");
      expect(await mgr.get("exclude-patterns")).toBe(".part,.crdownload");
      expect(await mgr.get("concurrency")).toBe("4");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config init does not overwrite existing values", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      await mgr.set("primary-db", "anidb");
      await mgr.init();
      expect(await mgr.get("primary-db")).toBe("anidb");
    } finally {
      cleanupTempDir(dir);
    }
  });
});
