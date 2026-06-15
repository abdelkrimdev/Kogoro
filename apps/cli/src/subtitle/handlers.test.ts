import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createMatchCacheService,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "@kogoro/core/testing";
import { createMockSubtitlePlugin, makeMockLogger } from "../fixtures";
import { createSubtitleHandlers } from "./handlers";

describe("subtitle CLI commands", () => {
  test("downloads subtitles for cached entries", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cacheService } = createMatchCacheService(tvDir);
      await seedCacheEntry(
        tvDir,
        "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.mkv",
        {
          animeId: "12345",
          animeTitle: "Jujutsu Kaisen",
          episodeId: "1001",
          season: 1,
          episode: 1,
          title: "Ryomen Sukuna",
        },
        cacheService,
      );

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cacheService });

      const { logger, infoLines } = makeMockLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.downloaded).toBe(1);
      expect(infoLines.join("")).toContain("Downloaded:");
      expect(infoLines.join("")).toContain("Summary");
    });
  });

  test("skips when subtitle file already exists", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cacheService } = createMatchCacheService(tvDir);
      await seedCacheEntry(
        tvDir,
        "Naruto - 1x01 - Pilot.mkv",
        {
          animeId: "42",
          animeTitle: "Naruto",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Pilot",
        },
        cacheService,
      );
      writeTempFile(tvDir, "Naruto - 1x01 - Pilot.mkv.en.srt", "existing subtitle");

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cacheService });

      const { logger, infoLines } = makeMockLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.skipped).toBe(1);
      expect(infoLines.join("")).toContain("1 skipped");
    });
  });

  test("force option overwrites existing subtitle", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cacheService } = createMatchCacheService(tvDir);
      await seedCacheEntry(
        tvDir,
        "Naruto - 1x01 - Pilot.mkv",
        {
          animeId: "42",
          animeTitle: "Naruto",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Pilot",
        },
        cacheService,
      );
      writeTempFile(tvDir, "Naruto - 1x01 - Pilot.mkv.en.srt", "old subtitle content");

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cacheService });

      const { logger } = makeMockLogger();
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

      const { cacheService } = createMatchCacheService(tmpDir);

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cacheService });

      const { logger } = makeMockLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.downloaded).toBe(0);
    });
  });

  test("reports download failures", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cacheService } = createMatchCacheService(tvDir);
      await seedCacheEntry(
        tvDir,
        "Jujutsu Kaisen - 1x01 - Ep.mkv",
        {
          animeId: "123",
          animeTitle: "Jujutsu Kaisen",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Ep",
        },
        cacheService,
      );

      const failingPlugin = createMockSubtitlePlugin({ downloadContent: "" });
      const handlers = createSubtitleHandlers({ subtitlePlugin: failingPlugin, cacheService });

      const { logger } = makeMockLogger();
      const result = await handlers.fetch(tmpDir, {}, logger);

      expect(result.failed).toBe(1);
    });
  });

  test("reports progress for each file", async () => {
    await withTempDir("subtitle-ctx-progress", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const { cacheService } = createMatchCacheService(tvDir);
      await seedCacheEntry(
        tvDir,
        "Jujutsu Kaisen - 1x01 - Ep.mkv",
        {
          animeId: "123",
          animeTitle: "Jujutsu Kaisen",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Ep",
        },
        cacheService,
      );

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cacheService });

      const { logger, progressLines } = makeMockLogger();
      await handlers.fetch(tmpDir, {}, logger);

      expect(progressLines.length).toBeGreaterThanOrEqual(1);
    });
  });
});
