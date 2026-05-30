import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { withTempDir } from "@kogoro/core";
import { shouldShowOnboarding } from "./onboarding";

describe("shouldShowOnboarding", () => {
  test("returns true when config.toml does not exist", async () => {
    await withTempDir("no-config", async (dir) => {
      expect(shouldShowOnboarding(dir)).toBe(true);
    });
  });

  test("returns false when config.toml exists", async () => {
    await withTempDir("with-config", async (dir) => {
      writeFileSync(join(dir, "config.toml"), 'primary-db = "tvdb"\n');
      expect(shouldShowOnboarding(dir)).toBe(false);
    });
  });
});
