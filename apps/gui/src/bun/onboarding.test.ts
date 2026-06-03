import { describe, expect, test } from "bun:test";
import {
  ConfigManager,
  createSilentCredentialStore,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import { shouldShowOnboarding, writeOnboardingConfig } from "./onboarding";

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
  test("writes primary db and template preset", async () => {
    await withTempDir("onboarding-config", async (dir) => {
      const store = createSilentCredentialStore();
      const config = new ConfigManager({ configDir: dir });

      const result = await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(config.get("primary-db")).toBe("tvdb");
      expect(config.get("template.preset")).toBe("standard");
    });
  });

  test("stores api key when provided", async () => {
    await withTempDir("onboarding-key", async (dir) => {
      const store = createSilentCredentialStore();
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
      const store = createSilentCredentialStore();
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

  test("includes template.custom when provided", async () => {
    await withTempDir("onboarding-custom", async (dir) => {
      const store = createSilentCredentialStore();
      const config = new ConfigManager({ configDir: dir });

      await writeOnboardingConfig(config, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
        templateCustom: "{anime}/{episode} {title}",
      });

      expect(config.get("template.custom")).toBe("{anime}/{episode} {title}");
    });
  });
});
