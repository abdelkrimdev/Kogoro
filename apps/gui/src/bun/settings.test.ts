import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { KeytarLike } from "@kogoro/core";
import { ConfigManager, CredentialStore } from "@kogoro/core";
import { createMockKeytar, withTempDir, writeTempFile } from "@kogoro/core/testing";
import { buildSettingsFormData, togglePlugin, updateApiKey } from "./settings";

describe("buildSettingsFormData", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KOGORO_") && k.endsWith("_KEY")) delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("builds form data from config and credential store", async () => {
    await withTempDir("settings", async (dir) => {
      writeTempFile(dir, "config.toml", 'primary-db = "anidb"\n');
      const reloaded = new ConfigManager({ configDir: dir });
      const keytar = createMockKeytar();
      const store = new CredentialStore({ keytar });
      await store.setCredential("tvdb", "tvdbkey123");
      await store.setCredential("opensubtitles", "oskey456");

      const formData = await buildSettingsFormData(reloaded, store);

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
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const k of Object.keys(process.env)) {
      if (k.startsWith("KOGORO_") && k.endsWith("_KEY")) delete process.env[k];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("stores api key", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "secret123" });
    expect(result).toEqual({ success: true, usedKeyring: true });
    expect(await store.getCredential("tvdb")).toBe("secret123");
  });

  test("deletes api key when empty", async () => {
    const store = new CredentialStore({ keytar: createMockKeytar() });
    await store.setCredential("tvdb", "oldkey");
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "" });
    expect(result).toEqual({ success: true });
    expect(await store.getCredential("tvdb")).toBeUndefined();
  });

  test("falls back to env var when keyring fails", async () => {
    const throwingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("no secret service");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const store = new CredentialStore({ keytar: throwingKeytar });
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "secret123" });
    expect(result.success).toBe(true);
    expect(process.env["KOGORO_TVDB_KEY"]).toBe("secret123");
  });

  test("falls back to env var on DBus error", async () => {
    const throwingKeytar: KeytarLike = {
      setPassword: async () => {
        throw new Error("org.freedesktop.DBus.Error.NotSupported");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    const store = new CredentialStore({ keytar: throwingKeytar });
    const result = await updateApiKey(store, { plugin: "tvdb", apiKey: "secret123" });
    expect(result.success).toBe(true);
    expect(process.env["KOGORO_TVDB_KEY"]).toBe("secret123");
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
