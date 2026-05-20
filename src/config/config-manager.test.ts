import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigManager } from "../config/config-manager";
import { withTempDir } from "../test-helpers";

describe("ConfigManager", () => {
  test("set then get persists and retrieves a value", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("primary-db", "tvdb");
      const val = mgr.get("primary-db");
      expect(val).toBe("tvdb");
    });
  });

  test("persisted value survives re-initialization", async () => {
    await withTempDir("config", async (dir) => {
      const mgr1 = new ConfigManager({ configDir: dir });
      mgr1.set("primary-db", "anidb");

      const mgr2 = new ConfigManager({ configDir: dir });
      const val = mgr2.get("primary-db");
      expect(val).toBe("anidb");
    });
  });

  test("config file is written to disk", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("concurrency", "4");
      const configPath = join(dir, "config.toml");
      expect(existsSync(configPath)).toBe(true);
    });
  });

  test("config init creates file with defaults", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.init();
      expect(mgr.get("primary-db")).toBe("tvdb");
      expect(mgr.get("secondary-dbs")).toBe("");
      expect(mgr.get("template.preset")).toBe("standard");
      expect(mgr.get("extensions")).toBe(".mkv,.mp4");
      expect(mgr.get("exclude-patterns")).toBe(".part,.crdownload");
      expect(mgr.get("concurrency")).toBe("4");
      expect(mgr.get("api-delay")).toBe("200");
      expect(mgr.get("episode-numbering")).toBe("relative");
    });
  });

  test("config init does not overwrite existing values", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("primary-db", "anidb");
      mgr.init();
      expect(mgr.get("primary-db")).toBe("anidb");
    });
  });

  test("getList returns empty array for unset key", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual([]);
    });
  });

  test("getList parses comma-separated values", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", "anidb,tvdb");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    });
  });

  test("getList trims whitespace around values", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", " anidb , tvdb ");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    });
  });

  test("getList returns empty array for empty string", async () => {
    await withTempDir("config", async (dir) => {
      const mgr = new ConfigManager({ configDir: dir });
      mgr.set("secondary-dbs", "");
      const list = mgr.getList("secondary-dbs");
      expect(list).toEqual([]);
    });
  });

  test("dotted key survives round-trip through disk", async () => {
    await withTempDir("config", async (dir) => {
      const mgr1 = new ConfigManager({ configDir: dir });
      mgr1.set("template.preset", "plex");

      const mgr2 = new ConfigManager({ configDir: dir });
      expect(mgr2.get("template.preset")).toBe("plex");
    });
  });

  describe("template presets", () => {
    test("getTemplate returns default standard preset when nothing configured", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - {season}x{episode:02} - {title}");
      });
    });

    test("getTemplate resolves named preset from template.preset", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "plex");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      });
    });

    test("getTemplate prefers template.string over template.preset", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "plex");
        mgr.set("template.string", "{custom} - {template}");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{custom} - {template}");
      });
    });

    test("getTemplate falls back to standard preset for unknown preset name", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("template.preset", "nonexistent");
        mgr.init();
        const template = mgr.getTemplate();
        expect(template).toBe("{anime} - {season}x{episode:02} - {title}");
      });
    });

    test("all five named presets resolve correctly", async () => {
      const presets: Record<string, string> = {
        standard: "{anime} - {season}x{episode:02} - {title}",
        compact: "{anime} - E{episode:02}",
        absolute: "{anime} - {episode:03}",
        plex: "{anime} - s{season:02}e{episode:02} - {title}",
        anidb: "{anime} - {episode:03} - {title}",
      };

      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        for (const [name, expected] of Object.entries(presets)) {
          mgr.set("template.preset", name);
          expect(mgr.getTemplate()).toBe(expected);
        }
      });
    });
  });

  describe("plugin enable/disable", () => {
    test("isPluginEnabled returns true when plugin is not configured", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        expect(mgr.isPluginEnabled("tvdb")).toBe(true);
      });
    });

    test("isPluginEnabled returns false when plugin is disabled", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("plugins.tvdb.enabled", "false");
        expect(mgr.isPluginEnabled("tvdb")).toBe(false);
      });
    });

    test("isPluginEnabled handles case-insensitive false values", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("plugins.tvdb.enabled", "FALSE");
        expect(mgr.isPluginEnabled("tvdb")).toBe(false);
      });
    });

    test("isPluginEnabled returns true when plugin is explicitly enabled", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("plugins.tvdb.enabled", "true");
        expect(mgr.isPluginEnabled("tvdb")).toBe(true);
      });
    });

    test("getDisabledPlugins returns empty set when no plugins are disabled", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        const disabled = mgr.getDisabledPlugins();
        expect(disabled.size).toBe(0);
      });
    });

    test("getDisabledPlugins returns only disabled plugins", async () => {
      await withTempDir("config", async (dir) => {
        const mgr = new ConfigManager({ configDir: dir });
        mgr.set("plugins.tvdb.enabled", "false");
        mgr.set("plugins.anidb.enabled", "true");
        const disabled = mgr.getDisabledPlugins();
        expect(disabled.has("tvdb")).toBe(true);
        expect(disabled.has("anidb")).toBe(false);
      });
    });

    test("getDisabledPlugins reads from persisted config", async () => {
      await withTempDir("config", async (dir) => {
        const mgr1 = new ConfigManager({ configDir: dir });
        mgr1.set("plugins.anidb.enabled", "false");

        const mgr2 = new ConfigManager({ configDir: dir });
        const disabled = mgr2.getDisabledPlugins();
        expect(disabled.has("anidb")).toBe(true);
      });
    });
  });
});
