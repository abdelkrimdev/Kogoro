import { describe, expect, test } from "bun:test";
import { createSilentCredentialStore, withTempDir, writeTempFile } from "@kogoro/core";
import type { ConfigSetter } from "./onboarding";
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
    await withTempDir("onboarding-config", async () => {
      const store = createSilentCredentialStore();
      const calls: string[][] = [];
      const mockConfig: ConfigSetter = {
        set: (key, value) => {
          calls.push([key, value]);
          return { success: true };
        },
      };

      const result = await writeOnboardingConfig(mockConfig, store, {
        primaryDb: "tvdb",
        apiKey: "",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(calls).toEqual([
        ["primary-db", "tvdb"],
        ["template.preset", "standard"],
      ]);
    });
  });

  test("stores api key when provided", async () => {
    await withTempDir("onboarding-key", async () => {
      const store = createSilentCredentialStore();
      const mockConfig: ConfigSetter = {
        set: () => ({ success: true }),
      };

      const result = await writeOnboardingConfig(mockConfig, store, {
        primaryDb: "tvdb",
        apiKey: "secret-key",
        templatePreset: "standard",
      });

      expect(result).toEqual({ success: true });
      expect(await store.getCredential("tvdb")).toBe("secret-key");
    });
  });

  test("returns error when primary-db set fails", async () => {
    const store = createSilentCredentialStore();
    const mockConfig: ConfigSetter = {
      set: () => ({ success: false, error: "Invalid value" }),
    };

    const result = await writeOnboardingConfig(mockConfig, store, {
      primaryDb: "invalid",
      apiKey: "",
      templatePreset: "standard",
    });

    expect(result).toEqual({ success: false, error: "Invalid value" });
  });

  test("returns error when template.preset set fails", async () => {
    const store = createSilentCredentialStore();
    let callCount = 0;
    const mockConfig: ConfigSetter = {
      set: (_key, _value) => {
        callCount++;
        if (callCount === 2) return { success: false, error: "Bad preset" };
        return { success: true };
      },
    };

    const result = await writeOnboardingConfig(mockConfig, store, {
      primaryDb: "tvdb",
      apiKey: "",
      templatePreset: "invalid",
    });

    expect(result).toEqual({ success: false, error: "Bad preset" });
  });

  test("includes template.custom when provided", async () => {
    const store = createSilentCredentialStore();
    const calls: string[][] = [];
    const mockConfig: ConfigSetter = {
      set: (key, value) => {
        calls.push([key, value]);
        return { success: true };
      },
    };

    await writeOnboardingConfig(mockConfig, store, {
      primaryDb: "tvdb",
      apiKey: "",
      templatePreset: "standard",
      templateCustom: "{anime}/{episode} {title}",
    });

    expect(calls).toEqual([
      ["primary-db", "tvdb"],
      ["template.preset", "standard"],
      ["template.custom", "{anime}/{episode} {title}"],
    ]);
  });
});
