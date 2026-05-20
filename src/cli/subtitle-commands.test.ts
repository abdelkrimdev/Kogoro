import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSubtitleHandlers } from "../cli/subtitle-commands";
import { MatchCache } from "../match-cache";
import type { SubtitlePlugin } from "../plugins/subtitle/plugin";
import type { SubtitleResult } from "../plugins/subtitle/types";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "kogoro-subtitle-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

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
    const tmpDir = createTempDir();
    try {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.mkv");
      writeFileSync(videoFile, "fake video content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const dbPath = join(tmpDir, "cache.db");
      const cache = new MatchCache({ dbPath });
      cache.set(fileHash, {
        animeId: "12345",
        animeTitle: "Jujutsu Kaisen",
        episodeId: "1001",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Ryomen Sukuna",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

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
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test("subtitle skips when subtitle file already exists", async () => {
    const tmpDir = createTempDir();
    try {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Naruto - 1x01 - Pilot.mkv");
      writeFileSync(videoFile, "naruto content");
      const subtitleFile = `${videoFile}.en.srt`;
      writeFileSync(subtitleFile, "existing subtitle");

      const fileHash = await MatchCache.hashFile(videoFile);

      const dbPath = join(tmpDir, "cache.db");
      const cache = new MatchCache({ dbPath });
      cache.set(fileHash, {
        animeId: "42",
        animeTitle: "Naruto",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Pilot",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

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
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test("subtitle force overwrites existing subtitle", async () => {
    const tmpDir = createTempDir();
    try {
      const tvDir = join(tmpDir, "Naruto", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Naruto - 1x01 - Pilot.mkv");
      writeFileSync(videoFile, "naruto overwrite");
      const subtitleFile = `${videoFile}.en.srt`;
      writeFileSync(subtitleFile, "old subtitle content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const dbPath = join(tmpDir, "cache.db");
      const cache = new MatchCache({ dbPath });
      cache.set(fileHash, {
        animeId: "42",
        animeTitle: "Naruto",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Pilot",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

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
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test("subtitle skips files not in cache", async () => {
    const tmpDir = createTempDir();
    try {
      const tvDir = join(tmpDir, "Unknown", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Unknown - 1x01 - Ep.mkv");
      writeFileSync(videoFile, "unknown content");

      const dbPath = join(tmpDir, "cache.db");
      const cache = new MatchCache({ dbPath });

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
    } finally {
      cleanupTempDir(tmpDir);
    }
  });

  test("subtitle reports download failures", async () => {
    const tmpDir = createTempDir();
    try {
      const tvDir = join(tmpDir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      const videoFile = join(tvDir, "Jujutsu Kaisen - 1x01 - Ep.mkv");
      writeFileSync(videoFile, "test content");

      const fileHash = await MatchCache.hashFile(videoFile);

      const dbPath = join(tmpDir, "cache.db");
      const cache = new MatchCache({ dbPath });
      cache.set(fileHash, {
        animeId: "123",
        animeTitle: "Jujutsu Kaisen",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Ep",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

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
    } finally {
      cleanupTempDir(tmpDir);
    }
  });
});
