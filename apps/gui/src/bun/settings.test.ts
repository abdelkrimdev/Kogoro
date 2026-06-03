import { describe, expect, test } from "bun:test";
import {
  ConfigManager,
  createSilentCredentialStore,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import { buildSettingsFormData, togglePlugin, updateApiKey } from "./settings";

describe("buildSettingsFormData", () => {
  test("builds form data from config and api keys", async () => {
    await withTempDir("settings", async (dir) => {
      writeTempFile(dir, "config.toml", 'primary-db = "anidb"\n');
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

describe("updateApiKey", () => {
  test("stores api key", async () => {
    const store = createSilentCredentialStore();
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "secret123" });
    expect(result).toEqual({ success: true });
    expect(await store.getCredential("tvdb")).toBe("secret123");
  });

  test("deletes api key when empty", async () => {
    const store = createSilentCredentialStore();
    await store.setCredential("tvdb", "oldkey");
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "" });
    expect(result).toEqual({ success: true });
    expect(await store.getCredential("tvdb")).toBeUndefined();
  });
});

describe("togglePlugin", () => {
  test("enables plugin", () => {
    const config = new ConfigManager();
    const result = togglePlugin(config, { plugin: "tvdb", enabled: true });
    expect(result).toEqual({ success: true });
    expect(config.get("plugins.tvdb.enabled")).toBe(true);
  });

  test("disables plugin", () => {
    const config = new ConfigManager();
    togglePlugin(config, { plugin: "tvdb", enabled: true });
    const result = togglePlugin(config, { plugin: "tvdb", enabled: false });
    expect(result).toEqual({ success: true });
    expect(config.get("plugins.tvdb.enabled")).toBe(false);
  });
});
