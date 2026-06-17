import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTempDir, withTestConfig } from "../fixtures";
import { ConfigManager } from "./config-manager";
import { TEMPLATE_PRESETS } from "./schema";

describe("ConfigManager", () => {
  test("set then get persists and retrieves a value", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primaryDb", "tvdb");
      const val = config.primaryDb;
      expect(val).toBe("tvdb");
    });
  });

  test("persisted value survives re-initialization", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primaryDb", "anidb");

      const mgr2 = new ConfigManager({ configDir: _dir });
      const val = mgr2.primaryDb;
      expect(val).toBe("anidb");
    });
  });

  test("config file is written to disk on set", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primaryDb", "tvdb");
      const configPath = join(_dir, "config.toml");
      expect(existsSync(configPath)).toBe(true);
    });
  });

  test("config init creates file with defaults", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.init();
      expect(config.primaryDb).toBe("tvdb");
      expect(config.template.preset).toBe("standard");
      expect(Array.isArray(config.mediaExtensions)).toBe(true);
      expect(config.mediaExtensions.includes(".mkv")).toBe(true);
      expect(config.mediaExtensions.includes(".ogm")).toBe(true);
      expect(config.scanConcurrency).toBe(4);
    });
  });

  test("config init does not overwrite existing values", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("primaryDb", "anidb");
      config.init();
      expect(config.primaryDb).toBe("anidb");
    });
  });

  test("getList returns empty array for unset key", async () => {
    await withTestConfig("config", async (_dir, config) => {
      const list = config.getList("exclude-patterns");
      expect(Array.isArray(list)).toBe(true);
    });
  });

  test("getList parses comma-separated values for string keys", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("excludePatterns", ".part,.crdownload");
      const list = config.getList("exclude-patterns");
      expect(list).toEqual([".part", ".crdownload"]);
    });
  });

  test("getList trims whitespace around values", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("excludePatterns", " .part , .crdownload ");
      const list = config.getList("exclude-patterns");
      expect(list).toEqual([".part", ".crdownload"]);
    });
  });

  test("getList returns empty array for empty string", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("excludePatterns", "");
      const list = config.getList("exclude-patterns");
      expect(list).toEqual([]);
    });
  });

  test("set with valid key persists to disk", async () => {
    await withTestConfig("config", async (_dir, config) => {
      config.set("template.preset", "plex");

      const mgr2 = new ConfigManager({ configDir: _dir });
      expect(mgr2.template.preset).toBe("plex");
    });
  });

  describe("template presets", () => {
    test("getTemplate returns default standard preset when nothing configured", async () => {
      await withTestConfig("config", async (_dir, config) => {
        const template = config.getTemplate();
        expect(template).toBe(TEMPLATE_PRESETS.standard);
      });
    });

    test("getTemplate resolves named preset from template.preset", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "plex");
        config.init();
        const template = config.getTemplate();
        expect(template).toBe(TEMPLATE_PRESETS.plex);
      });
    });

    test("getTemplate prefers template.custom over template.preset", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "plex");
        config.set("template.custom", "{custom} - {template}");
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
        expect(template).toBe(TEMPLATE_PRESETS.standard);
      });
    });

    test("all five named presets resolve correctly", async () => {
      await withTestConfig("config", async (_dir, config) => {
        for (const [name, expected] of Object.entries(TEMPLATE_PRESETS)) {
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

    test("plugins accessor returns plugin toggles", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.init();
        expect(config.plugins).toEqual({});
      });
    });
  });

  describe("typed accessor", () => {
    test("primaryDb returns default value when not set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.primaryDb).toBe("tvdb");
      });
    });

    test("primaryDb reflects value after set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("primaryDb", "anidb");
        expect(config.primaryDb).toBe("anidb");
      });
    });

    test("typed set accepts camelCase key and typed value", async () => {
      await withTestConfig("config", async (_dir, config) => {
        const result = config.set("primaryDb", "anidb");
        expect(result).toEqual({ success: true });
        expect(config.primaryDb).toBe("anidb");
      });
    });

    test("template.preset returns default value when not set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.template.preset).toBe("standard");
      });
    });

    test("template.preset reflects value after set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("template.preset", "plex");
        expect(config.template.preset).toBe("plex");
      });
    });

    test("scanConcurrency returns default value when not set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.scanConcurrency).toBe(4);
      });
    });

    test("scanConcurrency reflects value after set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("scanConcurrency", "8");
        expect(config.scanConcurrency).toBe(8);
      });
    });

    test("episodeNumbering returns default value when not set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.episodeNumbering).toBe("relative");
      });
    });

    test("renameAction returns default value when not set", async () => {
      await withTestConfig("config", async (_dir, config) => {
        expect(config.renameAction).toBe("move");
      });
    });
  });

  describe("sanitize config", () => {
    test("sanitize config is serialized to TOML and persists", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.set("sanitize.action", "strip");
        config.set("sanitize.replacement", "-");
        config.set("sanitize.chars", "()/");

        const mgr2 = new ConfigManager({ configDir: _dir });
        expect(mgr2.sanitize.action).toBe("strip");
        expect(mgr2.sanitize.replacement).toBe("-");
        expect(mgr2.sanitize.chars).toBe("()/");
      });
    });

    test("sanitize defaults are returned when not configured", async () => {
      await withTestConfig("config", async (_dir, config) => {
        config.init();
        expect(config.sanitize.action).toBe("strip");
        expect(config.sanitize.replacement).toBe("_");
        expect(config.sanitize.chars).toBe('\\/:*?"<>|');
      });
    });
  });

  describe("TOML error handling", () => {
    test("constructor throws on corrupt TOML file", async () => {
      await withTempDir("config-corrupt", async (dir) => {
        const configPath = join(dir, "config.toml");
        mkdirSync(dir, { recursive: true });
        writeFileSync(configPath, "this is not valid TOML {{{");
        expect(() => new ConfigManager({ configDir: dir })).toThrow();
      });
    });

    test("constructor does not throw on valid TOML", async () => {
      await withTempDir("config-valid", async (dir) => {
        const configPath = join(dir, "config.toml");
        mkdirSync(dir, { recursive: true });
        writeFileSync(configPath, 'primary-db = "tvdb"\n');
        expect(() => new ConfigManager({ configDir: dir })).not.toThrow();
      });
    });
  });
});
