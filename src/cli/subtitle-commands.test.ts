import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSubtitleHandlers } from "../cli/subtitle-commands";
import { MatchCache } from "../match-cache";
import type { SubtitlePlugin } from "../plugins/subtitle/plugin";
import type { SubtitleResult } from "../plugins/subtitle/types";
import { createCache, makeCachedMatch, withTempDir } from "../test-helpers";

function createMockSubtitlePlugin(): SubtitlePlugin {
  return {
    async search(
      _animeTitle: string,
      _season?: number,
      _episode?: number,
      _language?: string,
    ): Promise<SubtitleResult[]> {
      return [
        {
          id: "sub1",
          fileId: 101,
          language: "en",
          format: "srt",
          score: 5000,
          fileName: "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.srt",
        },
      ];
    },
    async download(_fileId: number): Promise<string> {
      return "1\n00:00:01,000 --> 00:00:05,000\nHello world\n";
    },
  };
}

describe("subtitle CLI commands", () => {
  test("subtitle downloads subtitles for cached entries", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.mkv");
      writeFileSync(videoFile, "fake video content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const cache = createCache(tmpDir);
      cache.set(
        fileHash,
        makeCachedMatch({
          animeId: "12345",
          animeTitle: "Jujutsu Kaisen",
          episodeId: "1001",
          season: 1,
          episode: 1,
          title: "Ryomen Sukuna",
        }),
      );

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      let logOutput = "";
      let errOutput = "";
      await handlers.fetch(
        tmpDir,
        {},
        (msg: string) => {
          logOutput += `${msg}\n`;
        },
        (msg: string) => {
          errOutput += `${msg}\n`;
        },
      );

      expect(errOutput).toBe("");
      expect(logOutput).toContain("Downloaded:");
      expect(logOutput).toContain("downloaded");
      expect(logOutput).toContain("Summary");
      expect(logOutput).toContain("1 downloaded");
    });
  });

  test("subtitle skips when subtitle file already exists", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Naruto - 1x01 - Pilot.mkv");
      writeFileSync(videoFile, "naruto content");
      const subtitleFile = `${videoFile}.en.srt`;
      writeFileSync(subtitleFile, "existing subtitle");

      const fileHash = await MatchCache.hashFile(videoFile);

      const cache = createCache(tmpDir);
      cache.set(
        fileHash,
        makeCachedMatch({
          animeId: "42",
          animeTitle: "Naruto",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Pilot",
        }),
      );

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      let logOutput = "";
      await handlers.fetch(
        tmpDir,
        {},
        (msg: string) => {
          logOutput += `${msg}\n`;
        },
        () => {},
      );

      expect(logOutput).toContain("Summary");
      expect(logOutput).toContain("1 skipped");
    });
  });

  test("subtitle force overwrites existing subtitle", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Naruto - 1x01 - Pilot.mkv");
      writeFileSync(videoFile, "naruto overwrite");
      const subtitleFile = `${videoFile}.en.srt`;
      writeFileSync(subtitleFile, "old subtitle content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const cache = createCache(tmpDir);
      cache.set(
        fileHash,
        makeCachedMatch({
          animeId: "42",
          animeTitle: "Naruto",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Pilot",
        }),
      );

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      let logOutput = "";
      await handlers.fetch(
        tmpDir,
        { force: true },
        (msg: string) => {
          logOutput += `${msg}\n`;
        },
        () => {},
      );

      expect(logOutput).toContain("1 downloaded");
      expect(logOutput).toContain("0 skipped");
    });
  });

  test("subtitle skips files not in cache", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Unknown", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Unknown - 1x01 - Ep.mkv");
      writeFileSync(videoFile, "unknown content");

      const cache = createCache(tmpDir);

      const subtitlePlugin = createMockSubtitlePlugin();
      const handlers = createSubtitleHandlers({ subtitlePlugin, cache });

      let logOutput = "";
      await handlers.fetch(
        tmpDir,
        {},
        (msg: string) => {
          logOutput += `${msg}\n`;
        },
        () => {},
      );

      expect(logOutput).toContain("0 downloaded");
    });
  });

  test("subtitle reports download failures", async () => {
    await withTempDir("subtitle", async (tmpDir) => {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Jujutsu Kaisen - 1x01 - Ep.mkv");
      writeFileSync(videoFile, "test content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const cache = createCache(tmpDir);
      cache.set(
        fileHash,
        makeCachedMatch({
          animeId: "123",
          animeTitle: "Jujutsu Kaisen",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Ep",
        }),
      );

      const failingPlugin: SubtitlePlugin = {
        async search(): Promise<SubtitleResult[]> {
          return [
            {
              id: "s1",
              fileId: 999,
              language: "en",
              format: "srt",
              score: 100,
              fileName: "test.srt",
            },
          ];
        },
        async download(): Promise<string> {
          return "";
        },
      };
      const handlers = createSubtitleHandlers({ subtitlePlugin: failingPlugin, cache });

      let logOutput = "";
      await handlers.fetch(
        tmpDir,
        {},
        (msg: string) => {
          logOutput += `${msg}\n`;
        },
        () => {},
      );

      expect(logOutput).toContain("1 failed");
    });
  });
});
