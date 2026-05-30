import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ConfigManager, withTempDir } from "@kogoro/core";
import { buildPluginList, buildSettingsFormData, maskApiKey } from "./settings";

describe("maskApiKey", () => {
  test("returns placeholder when key is empty", () => {
    expect(maskApiKey(undefined)).toBe("Not set");
  });

  test("returns placeholder when key is empty string", () => {
    expect(maskApiKey("")).toBe("Not set");
  });

  test("masks key showing last 4 characters", () => {
    expect(maskApiKey("abc123def456")).toBe("****f456");
  });

  test("masks short key entirely", () => {
    expect(maskApiKey("abc")).toBe("****");
  });

  test("masks key of exactly 4 characters", () => {
    expect(maskApiKey("abcd")).toBe("****");
  });
});

describe("buildPluginList", () => {
  test("returns default plugins when none configured", () => {
    const plugins = buildPluginList(undefined);
    expect(plugins).toEqual([
      { name: "tvdb", type: "database", source: "built-in", enabled: true },
      { name: "anidb", type: "database", source: "built-in", enabled: true },
      { name: "opensubtitles", type: "subtitle", source: "built-in", enabled: true },
    ]);
  });

  test("respects enabled state from config", () => {
    const plugins = buildPluginList({
      tvdb: { enabled: false },
      anidb: { enabled: true },
      opensubtitles: { enabled: true },
    });
    expect(plugins[0]?.enabled).toBe(false);
    expect(plugins[1]?.enabled).toBe(true);
  });
});

describe("buildSettingsFormData", () => {
  test("builds form data from config and api keys", async () => {
    await withTempDir("settings", async (dir) => {
      writeFileSync(join(dir, "config.toml"), 'primary-db = "anidb"\n');
      const reloaded = new ConfigManager({ configDir: dir });

      const formData = buildSettingsFormData(reloaded, {
        tvdb: "tvdbkey123",
        anidb: undefined,
        opensubtitles: "oskey456",
      });

      expect(formData.primaryDb).toBe("anidb");
      expect(formData.apiKeys["tvdb"]).toBe("****y123");
      expect(formData.apiKeys["anidb"]).toBe("Not set");
      expect(formData.apiKeys["opensubtitles"]).toBe("****y456");
      expect(formData.plugins).toHaveLength(3);
      expect(formData.templatePreset).toBe("standard");
      expect(formData.scanConcurrency).toBe(4);
      expect(formData.fetchConcurrency).toBe(5);
      expect(formData.episodeNumbering).toBe("relative");
      expect(formData.renameAction).toBe("move");
    });
  });
});
