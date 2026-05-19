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
      expect(await mgr.get("secondary-dbs")).toBe("");
      expect(await mgr.get("template.preset")).toBe("standard");
      expect(await mgr.get("extensions")).toBe(".mkv,.mp4");
      expect(await mgr.get("exclude-patterns")).toBe(".part,.crdownload");
      expect(await mgr.get("concurrency")).toBe("4");
      expect(await mgr.get("api-delay")).toBe("200");
      expect(await mgr.get("episode-numbering")).toBe("relative");
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

  test("getList returns empty array for unset key", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual([]);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("getList parses comma-separated values", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", "anidb,tvdb");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("getList trims whitespace around values", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", " anidb , tvdb ");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("getList returns empty array for empty string", async () => {
    const dir = setupTempDir();
    try {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", "");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual([]);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("dotted key survives round-trip through disk", async () => {
    const dir = setupTempDir();
    try {
      const mgr1 = new ConfigManager({ configDir: dir });
      mgr1.set("template.preset", "plex");

      const mgr2 = new ConfigManager({ configDir: dir });
      expect(mgr2.get("template.preset")).toBe("plex");
    } finally {
      cleanupTempDir(dir);
    }
  });

  describe("template presets", () => {
    test("getTemplate returns default standard preset when nothing configured", async () => {
      const dir = setupTempDir();
      try {
        const mgr = new ConfigManager({ configDir: dir });
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - {season}x{episode:02} - {title}");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("getTemplate resolves named preset from template.preset", async () => {
      const dir = setupTempDir();
      try {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "plex");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("getTemplate prefers template.string over template.preset", async () => {
      const dir = setupTempDir();
      try {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "plex");
        mgr.set("template.string", "{custom} - {template}");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{custom} - {template}");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("getTemplate falls back to standard preset for unknown preset name", async () => {
      const dir = setupTempDir();
      try {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "nonexistent");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - {season}x{episode:02} - {title}");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("all five named presets resolve correctly", async () => {
      const presets: Record<string, string> = {
        standard: "{anime} - {season}x{episode:02} - {title}",
        compact: "{anime} - E{episode:02}",
        absolute: "{anime} - {episode:03}",
        plex: "{anime} - s{season:02}e{episode:02} - {title}",
        anidb: "{anime} - {episode:03} - {title}",
      };

      const dir = setupTempDir();
      try {
        const mgr = new ConfigManager({ configDir: dir });
        for (const [name, expected] of Object.entries(presets)) {
          mgr.set("template.preset", name);
          expect(mgr.getTemplate()).toBe(expected);
        }
      } finally {
        cleanupTempDir(dir);
      }
    });
  });
});
