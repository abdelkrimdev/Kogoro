import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@kogoro/core/src/test-fixtures";
import { shouldShowOnboarding } from "./onboarding";

describe("shouldShowOnboarding", () => {
  test("returns true when config.toml does not exist", async () => {
    await withTempDir("no-config", async (dir) => {
      const result = shouldShowOnboarding(dir);
      expect(result).toBe(true);
      expect(existsSync(join(dir, "config.toml"))).toBe(false);
    });
  });

  test("returns false when config.toml exists", async () => {
    await withTempDir("with-config", async (dir) => {
      // Create a config.toml file
      const { writeFileSync } = await import("node:fs");
      writeFileSync(join(dir, "config.toml"), 'primary-db = "tvdb"\n');
      const result = shouldShowOnboarding(dir);
      expect(result).toBe(false);
    });
  });
});
