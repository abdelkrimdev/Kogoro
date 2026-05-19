import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CachedMatch, MatchCache } from "../src/match-cache.ts";
import { MetadataWriter } from "../src/metadata-writer.ts";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "kogoro-metadata-test-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

function createTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "kogoro-metadata-db-"));
  return join(dir, "cache.db");
}

function cleanupTempDb(dbPath: string) {
  const dir = join(dbPath, "..");
  rmSync(dir, { recursive: true, force: true });
}

describe("MetadataWriter", () => {
  describe("generateEpisodeNfo", () => {
    test("produces valid Kodi episode XML with all required fields", () => {
      const match: CachedMatch = {
        animeId: "12345",
        episodeId: "67890",
        entryType: "tv",
        season: 1,
        episode: 13,
        title: "The Test Episode",
        animeTitle: "Test Anime",
        timestamp: "2026-01-01T00:00:00.000Z",
      };

      const writer = new MetadataWriter({ cache: null as never });
      const xml = writer.generateEpisodeNfo(match);

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
      expect(xml).toContain("<episodedetails>");
      expect(xml).toContain("<title>The Test Episode</title>");
      expect(xml).toContain("<season>1</season>");
      expect(xml).toContain("<episode>13</episode>");
      expect(xml).toContain("<displayseason>1</displayseason>");
      expect(xml).toContain("<displayepisode>13</displayepisode>");
      expect(xml).toContain("</episodedetails>");
    });
  });

  describe("generateMovieNfo", () => {
    test("produces movie-style NFO with movie root element", () => {
      const match: CachedMatch = {
        animeId: "999",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: "Test Movie",
        timestamp: "2026-01-01T00:00:00.000Z",
      };

      const writer = new MetadataWriter({ cache: null as never });
      const xml = writer.generateMovieNfo(match);

      expect(xml).toContain("<movie>");
      expect(xml).toContain("<title>Test Movie</title>");
      expect(xml).toContain("</movie>");
      expect(xml).not.toContain("<episodedetails>");
      expect(xml).not.toContain("<season>");
    });
  });

  describe("enriched NFO with optional DatabasePlugin", () => {
    test("populates showtitle, plot, and aired when database plugin provided", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "Test Anime - 1x01.mkv");
        writeFileSync(videoPath, "fake video content");

        const hash = await MatchCache.hashFile(videoPath);
        const cache = new MatchCache({ dbPath });
        cache.set(hash, {
          animeId: "42",
          episodeId: "101",
          entryType: "tv",
          season: 1,
          episode: 1,
          title: "First Episode",
          animeTitle: "Test Anime",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const mockDb = {
          async searchAnime() {
            return [{ id: "42", title: "Test Anime", entryType: "tv" as const }];
          },
          async getEpisodes() {
            return [
              {
                id: "101",
                animeId: "42",
                season: 1,
                episode: 1,
                title: "First Episode",
                overview: "A thrilling start",
                airDate: "2026-01-15",
                entryType: "tv" as const,
              },
            ];
          },
          async getArtwork() {
            return [];
          },
        };

        const writer = new MetadataWriter({ cache, database: mockDb });
        const summary = await writer.write(dir);

        const nfoPath = join(dir, "Test Anime - 1x01.nfo");
        expect(existsSync(nfoPath)).toBe(true);

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toContain("<showtitle>Test Anime</showtitle>");
        expect(nfoContent).toContain("<plot>A thrilling start</plot>");
        expect(nfoContent).toContain("<aired>2026-01-15</aired>");

        expect(summary.total).toBe(1);
        expect(summary.written).toBe(1);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("still writes NFO without database plugin (empty showtitle/plot/aired)", async () => {
      const match: CachedMatch = {
        animeId: "12345",
        episodeId: "67890",
        entryType: "tv",
        season: 1,
        episode: 13,
        title: "The Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      };

      const writer = new MetadataWriter({ cache: null as never });
      const xml = writer.generateEpisodeNfo(match);

      expect(xml).toContain("<showtitle></showtitle>");
      expect(xml).toContain("<plot></plot>");
      expect(xml).toContain("<aired></aired>");
    });
  });

  describe("write", () => {
    test("writes NFO sidecar next to cached video file", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "Test Anime - 1x01.mkv");
        writeFileSync(videoPath, "fake video content");

        const hash = await MatchCache.hashFile(videoPath);
        const cache = new MatchCache({ dbPath });
        cache.set(hash, {
          animeId: "42",
          episodeId: "101",
          entryType: "tv",
          season: 1,
          episode: 1,
          title: "First Episode",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoPath = join(dir, "Test Anime - 1x01.nfo");
        expect(existsSync(nfoPath)).toBe(true);

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toContain("<episodedetails>");
        expect(nfoContent).toContain("<title>First Episode</title>");
        expect(nfoContent).toContain("<season>1</season>");
        expect(nfoContent).toContain("<episode>1</episode>");

        expect(summary.total).toBe(1);
        expect(summary.written).toBe(1);
        expect(summary.skipped).toBe(0);
        expect(summary.failed).toBe(0);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("skips files that already have NFO (no overwrite)", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "SkipTest.mkv");
        const nfoPath = join(dir, "SkipTest.nfo");
        writeFileSync(videoPath, "content");
        writeFileSync(nfoPath, "old metadata");

        const hash = await MatchCache.hashFile(videoPath);
        const cache = new MatchCache({ dbPath });
        cache.set(hash, {
          animeId: "1",
          episodeId: "2",
          entryType: "tv",
          season: 1,
          episode: 1,
          title: "Should Not Overwrite",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toBe("old metadata");
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(1);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("--force overwrites existing NFO file", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "ForceTest.mkv");
        const nfoPath = join(dir, "ForceTest.nfo");
        writeFileSync(videoPath, "content");
        writeFileSync(nfoPath, "old metadata");

        const hash = await MatchCache.hashFile(videoPath);
        const cache = new MatchCache({ dbPath });
        cache.set(hash, {
          animeId: "1",
          episodeId: "2",
          entryType: "tv",
          season: 1,
          episode: 5,
          title: "New Episode",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir, { force: true });

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toContain("<title>New Episode</title>");
        expect(nfoContent).toContain("<episode>5</episode>");
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(1);
        expect(summary.skipped).toBe(0);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("skips video files not in cache", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "NoMatch.mkv");
        writeFileSync(videoPath, "uncached content");

        const cache = new MatchCache({ dbPath });
        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoPath = join(dir, "NoMatch.nfo");
        expect(existsSync(nfoPath)).toBe(false);
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(1);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("handles empty directory", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const cache = new MatchCache({ dbPath });
        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        expect(summary.total).toBe(0);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(0);
        expect(summary.failed).toBe(0);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });

    test("writes movie-style NFO for movie entry type", async () => {
      const dir = createTempDir();
      const dbPath = createTempDb();
      try {
        const videoPath = join(dir, "My Movie.mkv");
        writeFileSync(videoPath, "movie content");

        const hash = await MatchCache.hashFile(videoPath);
        const cache = new MatchCache({ dbPath });
        cache.set(hash, {
          animeId: "99",
          episodeId: null,
          entryType: "movie",
          season: null,
          episode: null,
          title: "Great Movie",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoPath = join(dir, "My Movie.nfo");
        expect(existsSync(nfoPath)).toBe(true);
        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toContain("<movie>");
        expect(nfoContent).toContain("<title>Great Movie</title>");
        expect(nfoContent).not.toContain("<episodedetails>");
        expect(nfoContent).not.toContain("<season>");
        expect(summary.written).toBe(1);
      } finally {
        cleanupTempDb(dbPath);
        cleanupTempDir(dir);
      }
    });
  });
});
