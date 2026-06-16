import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { KeytarLike } from "@kogoro/core";
import { ConfigManager, CredentialStore } from "@kogoro/core";
import { createMockKeytar, withTempDir, writeTempFile } from "@kogoro/core/testing";
import {
  checkIncompleteOnboarding,
  shouldShowOnboarding,
  writeOnboardingConfig,
} from "./onboarding";

describe("shouldShowOnboarding", () => {
  test("returns true when config file does not exist", () => {
    expect(shouldShowOnboarding("/tmp/nonexistent-dir")).toBe(true);
  });

  test("returns false when config file exists", async () => {
    await withTempDir("onboarding", async (dir) => {
      writeTempFile(dir, "config.toml");
      expect(shouldShowOnboarding(dir)).toBe(false);
    });
  });
});

describe("writeOnboardingConfig", () => {
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

  test("writes primary db and template preset", async () => {
    await withTempDir("onboarding-config", async (dir) => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(config.primaryDb).toBe("tvdb");
      expect(config.template.preset).toBe("standard");
    });
  });

  test("stores api key when provided", async () => {
    await withTempDir("onboarding-key", async (dir) => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "secret-key",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(await store.getCredential("tvdb")).toBe("secret-key");
    });
  });

  test("returns error when template.preset is invalid", async () => {
    await withTempDir("onboarding-invalid-preset", async (dir) => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "invalid",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  test("clears template.custom when preset is not custom", async () => {
    await withTempDir("onboarding-custom", async (dir) => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
        templateCustom: "{anime}/{episode} {title}",
      });

      expect(config.template.custom).toBe("");
    });
  });

  test("writes custom preset and template together", async () => {
    await withTempDir("onboarding-custom-preset", async (dir) => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "custom",
        templateCustom: "{anime}/S{season}/E{episode} - {title}",
      });

      expect(result).toEqual({ success: true });
      expect(config.template.preset).toBe("custom");
      expect(config.template.custom).toBe("{anime}/S{season}/E{episode} - {title}");
      expect(config.getTemplate()).toBe("{anime}/S{season}/E{episode} - {title}");
    });
  });

  test("falls back to env var when keyring fails", async () => {
    await withTempDir("onboarding-keyring-fail", async (dir) => {
      const throwingKeytar: KeytarLike = {
        setPassword: async () => {
          throw new Error("no secret service");
        },
        getPassword: async () => null,
        deletePassword: async () => false,
      };
      const store = new CredentialStore({ keytar: throwingKeytar });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "secret-key",
        templatePreset: "standard",
      });

      expect(result.success).toBe(true);
      expect(process.env["KOGORO_TVDB_KEY"]).toBe("secret-key");
    });
  });

  test("falls back to env var on DBus error", async () => {
    await withTempDir("onboarding-keyring-translated", async (dir) => {
      const throwingKeytar: KeytarLike = {
        setPassword: async () => {
          throw new Error("org.freedesktop.DBus.Error.NotSupported");
        },
        getPassword: async () => null,
        deletePassword: async () => false,
      };
      const store = new CredentialStore({ keytar: throwingKeytar });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "secret-key",
        templatePreset: "standard",
      });

      expect(result.success).toBe(true);
      expect(process.env["KOGORO_TVDB_KEY"]).toBe("secret-key");
    });
  });

  test("writes sensible defaults when api key is empty", async () => {
    await withTempDir("onboarding-skip", async (dir) => {
      delete process.env["KOGORO_TVDB_KEY"];
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(config.primaryDb).toBe("tvdb");
      expect(config.template.preset).toBe("standard");
      expect(config.getTemplate()).toBeTruthy();
      expect(await store.getCredential("tvdb")).toBeUndefined();
    });
  });
});

describe("checkIncompleteOnboarding", () => {
  test("returns incomplete when api key is missing", async () => {
    await withTempDir("incomplete-missing-key", async (dir) => {
      delete process.env["KOGORO_TVDB_KEY"];
      const config = new ConfigManager({ configDir: dir });
      const store = new CredentialStore({ keytar: createMockKeytar() });
      config.set("primaryDb", "tvdb");

      const result = await checkIncompleteOnboarding(config, store);
      expect(result.incomplete).toBe(true);
      expect(result.missingKey).toBe("tvdb");
    });
  });

  test("returns complete when api key exists", async () => {
    await withTempDir("incomplete-has-key", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const store = new CredentialStore({ keytar: createMockKeytar() });
      config.set("primaryDb", "tvdb");
      await store.setCredential("tvdb", "my-api-key");

      const result = await checkIncompleteOnboarding(config, store);
      expect(result.incomplete).toBe(false);
      expect(result.missingKey).toBeUndefined();
    });
  });

  test("returns incomplete when keyring is unavailable", async () => {
    await withTempDir("incomplete-keyring-unavailable", async (dir) => {
      delete process.env["KOGORO_TVDB_KEY"];
      const throwingKeytar: KeytarLike = {
        setPassword: async () => {
          throw new Error("org.freedesktop.DBus.Error.NotSupported");
        },
        getPassword: async () => null,
        deletePassword: async () => false,
      };
      const config = new ConfigManager({ configDir: dir });
      const store = new CredentialStore({ keytar: throwingKeytar });
      config.set("primaryDb", "tvdb");

      const result = await checkIncompleteOnboarding(config, store);
      expect(result.incomplete).toBe(true);
      expect(result.missingKey).toBe("tvdb");
    });
  });
});
