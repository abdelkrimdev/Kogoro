import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ProgressEvent, TaskContext } from "@kogoro/core";
import {
  createCache,
  createMockSubtitlePlugin,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import { createSubtitleHandlers } from "./handlers";

describe("subtitle CLI commands", () => {
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

      const logs: string[] = [];
      const errors: string[] = [];
      const ctx: TaskContext = {
        progress() {},
        log: (msg) => logs.push(msg),
        error: (msg) => errors.push(msg),
      };
      await handlers.fetch(tmpDir, {}, ctx);

      expect(errors).toHaveLength(0);
      expect(logs.join("")).toContain("Downloaded:");
      expect(logs.join("")).toContain("Summary");
      expect(logs.join("")).toContain("1 downloaded");
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

      const logs: string[] = [];
      const ctx: TaskContext = {
        progress() {},
        log: (msg) => logs.push(msg),
        error() {},
      };
      await handlers.fetch(tmpDir, {}, ctx);

      expect(logs.join("")).toContain("Summary");
      expect(logs.join("")).toContain("1 skipped");
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

      const logs: string[] = [];
      const ctx: TaskContext = {
        progress() {},
        log: (msg) => logs.push(msg),
        error() {},
      };
      await handlers.fetch(tmpDir, { force: true }, ctx);

      expect(logs.join("")).toContain("1 downloaded");
      expect(logs.join("")).toContain("0 skipped");
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

      const logs: string[] = [];
      const ctx: TaskContext = {
        progress() {},
        log: (msg) => logs.push(msg),
        error() {},
      };
      await handlers.fetch(tmpDir, {}, ctx);

      expect(logs.join("")).toContain("0 downloaded");
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

      const logs: string[] = [];
      const ctx: TaskContext = {
        progress() {},
        log: (msg) => logs.push(msg),
        error() {},
      };
      await handlers.fetch(tmpDir, {}, ctx);

      expect(logs.join("")).toContain("1 failed");
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

      const events: ProgressEvent[] = [];
      const ctx: TaskContext = {
        progress: (p) => events.push(p),
        log() {},
        error() {},
      };

      await handlers.fetch(tmpDir, {}, ctx);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.total).toBeGreaterThanOrEqual(1);
    });
  });
});
