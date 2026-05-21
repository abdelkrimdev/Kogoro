import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createSubtitleHandlers } from "../cli/subtitle-commands";
import {
  createCache,
  createLogCapture,
  createMockSubtitlePlugin,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "../test-fixtures";

describe("subtitle CLI commands", () => {
  test("subtitle downloads subtitles for cached entries", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cache } = await seedCacheEntry(tvDir, "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.mkv", {
        animeId: "12345",
        animeTitle: "Jujutsu Kaisen",
        episodeId: "1001",
        season: 1,
        episode: 1,
        title: "Ryomen Sukuna",
      });

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const log = createLogCapture();
      await handlers.fetch(tmpDir, {}, log.onLogAppend, log.onErrorAppend);

      expect(log.errorOutput).toBe("");
      expect(log.output).toContain("Downloaded:");
      expect(log.output).toContain("downloaded");
      expect(log.output).toContain("Summary");
      expect(log.output).toContain("1 downloaded");
    });
  });

  test("subtitle skips when subtitle file already exists", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cache } = await seedCacheEntry(tvDir, "Naruto - 1x01 - Pilot.mkv", {
        animeId: "42",
        animeTitle: "Naruto",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Pilot",
      });
      writeTempFile(tvDir, "Naruto - 1x01 - Pilot.mkv.en.srt", "existing subtitle");

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const log = createLogCapture();
      await handlers.fetch(tmpDir, {}, log.onLogAppend, () => {});

      expect(log.output).toContain("Summary");
      expect(log.output).toContain("1 skipped");
    });
  });

  test("subtitle force overwrites existing subtitle", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cache } = await seedCacheEntry(tvDir, "Naruto - 1x01 - Pilot.mkv", {
        animeId: "42",
        animeTitle: "Naruto",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Pilot",
      });
      writeTempFile(tvDir, "Naruto - 1x01 - Pilot.mkv.en.srt", "old subtitle content");

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const log = createLogCapture();
      await handlers.fetch(tmpDir, { force: true }, log.onLogAppend, () => {});

      expect(log.output).toContain("1 downloaded");
      expect(log.output).toContain("0 skipped");
    });
  });

  test("subtitle skips files not in cache", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Unknown", "TV");
      mkdirSync(tvDir, { recursive: true });
      writeTempFile(tvDir, "Unknown - 1x01 - Ep.mkv", "unknown content");

      const cache = createCache(tmpDir);

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const log = createLogCapture();
      await handlers.fetch(tmpDir, {}, log.onLogAppend, () => {});

      expect(log.output).toContain("0 downloaded");
    });
  });

  test("subtitle reports download failures", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cache } = await seedCacheEntry(tvDir, "Jujutsu Kaisen - 1x01 - Ep.mkv", {
        animeId: "123",
        animeTitle: "Jujutsu Kaisen",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Ep",
      });

      const failingPlugin = createMockSubtitlePlugin({ downloadContent: "" });
      const handlers = createSubtitleHandlers({ subtitlePlugin: failingPlugin, cache });

      const log = createLogCapture();
      await handlers.fetch(tmpDir, {}, log.onLogAppend, () => {});

      expect(log.output).toContain("1 failed");
    });
  });
});
