import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigManager } from "../config/config-manager";
import { withTestConfig } from "../test-fixtures";

describe("ConfigManager", () => {
  test("set then get persists and retrieves a value", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primary-db", "tvdb");
      const val = config.get("primary-db");
      expect(val).toBe("tvdb");
    });
  });

  test("persisted value survives re-initialization", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primary-db", "anidb");

      const mgr2 = new ConfigManager({ configDir: _dir });
      const val = mgr2.get("primary-db");
      expect(val).toBe("anidb");
    });
  });

  test("config file is written to disk", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("concurrency", "4");
      const configPath = join(_dir, "config.toml");
      expect(existsSync(configPath)).toBe(true);
    });
  });

  test("config init creates file with defaults", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.init();
      expect(config.get("primary-db")).toBe("tvdb");
      expect(config.get("secondary-dbs")).toBe("");
      expect(config.get("template.preset")).toBe("standard");
      expect(config.get("extensions")).toBe(".mkv,.mp4");
      expect(config.get("exclude-patterns")).toBe(".part,.crdownload");
      expect(config.get("concurrency")).toBe("4");
      expect(config.get("api-delay")).toBe("200");
    });
  });

  test("config init does not overwrite existing values", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primary-db", "anidb");
      config.init();
      expect(config.get("primary-db")).toBe("anidb");
    });
  });

  test("getList returns empty array for unset key", async () => {
    await withTestConfig("config", async (_dir, config) => {
      const list = config.getList("secondary-dbs");
      expect(list).toEqual([]);
    });
  });

  test("getList parses comma-separated values", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("secondary-dbs", "anidb,tvdb");
      const list = config.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    });
  });

  test("getList trims whitespace around values", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("secondary-dbs", " anidb , tvdb ");
      const list = config.getList("secondary-dbs");
      expect(list).toEqual(["anidb", "tvdb"]);
    });
  });

  test("getList returns empty array for empty string", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("secondary-dbs", "");
      const list = config.getList("secondary-dbs");
      expect(list).toEqual([]);
    });
  });

  test("dotted key survives round-trip through disk", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("template.preset", "plex");

      const mgr2 = new ConfigManager({ configDir: _dir });
      expect(mgr2.get("template.preset")).toBe("plex");
    });
  });

  describe("template presets", () => {
    test("getTemplate returns default standard preset when nothing configured", async () => {
      await withTestConfig("config", async (_dir, config) => {
        const template = config.getTemplate();
        expect(template).toBe("{anime} - {season}x{episode:02} - {title}");
      });
    });

    test("getTemplate resolves named preset from template.preset", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "plex");
        config.init();
        const template = config.getTemplate();
        expect(template).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      });
    });

    test("getTemplate prefers template.string over template.preset", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "plex");
        config.set("template.string", "{custom} - {template}");
        config.init();
        const template = config.getTemplate();
        expect(template).toBe("{custom} - {template}");
      });
    });

    test("getTemplate falls back to standard preset for unknown preset name", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "nonexistent");
        config.init();
        const template = config.getTemplate();
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

      await withTestConfig("config", async (_dir, config) => {
        for (const [name, expected] of Object.entries(presets)) {
          config.set("template.preset", name);
          expect(config.getTemplate()).toBe(expected);
        }
      });
    });
  });

  describe("plugin enable/disable", () => {
    test("isPluginEnabled returns true when plugin is not configured", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.isPluginEnabled("tvdb")).toBe(true);
      });
    });

    test("isPluginEnabled returns false when plugin is disabled", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("plugins.tvdb.enabled", "false");
        expect(config.isPluginEnabled("tvdb")).toBe(false);
      });
    });

    test("isPluginEnabled handles case-insensitive false values", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("plugins.tvdb.enabled", "FALSE");
        expect(config.isPluginEnabled("tvdb")).toBe(false);
      });
    });

    test("isPluginEnabled returns true when plugin is explicitly enabled", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("plugins.tvdb.enabled", "true");
        expect(config.isPluginEnabled("tvdb")).toBe(true);
      });
    });

    test("getDisabledPlugins returns empty set when no plugins are disabled", async () => {
      await withTestConfig("config", async (_dir, config) => {
        const disabled = config.getDisabledPlugins();
        expect(disabled.size).toBe(0);
      });
    });

    test("getDisabledPlugins returns only disabled plugins", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("plugins.tvdb.enabled", "false");
        config.set("plugins.anidb.enabled", "true");
        const disabled = config.getDisabledPlugins();
        expect(disabled.has("tvdb")).toBe(true);
        expect(disabled.has("anidb")).toBe(false);
      });
    });

    test("getDisabledPlugins reads from persisted config", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("plugins.anidb.enabled", "false");

        const mgr2 = new ConfigManager({ configDir: _dir });
        const disabled = mgr2.getDisabledPlugins();
        expect(disabled.has("anidb")).toBe(true);
      });
    });
  });
});
