import { describe, expect, test } from "bun:test";
import { withTempDir, writeTempFile } from "@kogoro/core";
import { shouldShowOnboarding } from "./onboarding";

describe("shouldShowOnboarding", () => {
  test("returns true when config.toml does not exist", async () => {
    await withTempDir("no-config", async (dir) => {
      expect(shouldShowOnboarding(dir)).toBe(true);
    });
  });

  test("returns false when config.toml exists", async () => {
    await withTempDir("with-config", async (dir) => {
      writeTempFile(dir, "config.toml", 'primary-db = "tvdb"\n');
      expect(shouldShowOnboarding(dir)).toBe(false);
    });
  });
});
