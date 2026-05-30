import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createCache,
  createMockSubtitlePlugin,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import type { Logger } from "../logger";
import { createSubtitleHandlers } from "./handlers";

describe("subtitle CLI commands", () => {
  function makeLogger(): { logger: Logger; info: string[]; progress: string[] } {
    const info: string[] = [];
    const progress: string[] = [];
    const logger: Logger = {
      info: (msg) => {
        info.push(msg);
      },
      error: () => {},
      debug: () => {},
      progress: (msg) => {
        progress.push(msg);
      },
    };
    return { logger, info, progress };
  }

  test("downloads subtitles for cached entries", async () => {
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

      const { logger, info } = makeLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.downloaded).toBe(1);
      expect(info.join("")).toContain("Downloaded:");
      expect(info.join("")).toContain("Summary");
    });
  });

  test("skips when subtitle file already exists", async () => {
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

      const { logger, info } = makeLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.skipped).toBe(1);
      expect(info.join("")).toContain("1 skipped");
    });
  });

  test("force option overwrites existing subtitle", async () => {
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

      const { logger } = makeLogger();
      const result = await handlers.fetch(tmpDir, { force: true }, logger);

      expect(result.downloaded).toBe(1);
      expect(result.skipped).toBe(0);
    });
  });

  test("skips files not in cache", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Unknown", "TV");
      mkdirSync(tvDir, { recursive: true });
      writeTempFile(tvDir, "Unknown - 1x01 - Ep.mkv", "unknown content");

      const cache = createCache(tmpDir);

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const { logger } = makeLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.downloaded).toBe(0);
    });
  });

  test("reports download failures", async () => {
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

      const { logger } = makeLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.failed).toBe(1);
    });
  });

  test("reports progress for each file", async () => {
    await withTempDir("subtitle-ctx-progress", async (tmpDir) => {
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

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      const { logger, progress } = makeLogger();
      await handlers.fetch(tmpDir, {}, logger);

      expect(progress.length).toBeGreaterThanOrEqual(1);
    });
  });
});
