import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MetadataWriter } from "./metadata-writer";
import {
  createCache,
  createMockDb,
  makeCachedMatch,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "./test-fixtures";

describe("MetadataWriter", () => {
  describe("generateEpisodeNfo", () => {
    test("produces valid Kodi episode XML with all required fields", () => {
      const match = makeCachedMatch({
        animeId: "12345",
        episodeId: "67890",
        season: 1,
        episode: 13,
        title: "The Test Episode",
        animeTitle: "Test Anime",
      });

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
      const match = makeCachedMatch({
        animeId: "999",
        entryType: "movie",
        title: "Test Movie",
      });

      const writer = new MetadataWriter({ cache: null as never });
      const xml = writer.generateMovieNfo(match);

      expect(xml).toContain("<movie>");
      expect(xml).toContain("<title>Test Movie</title>");
      expect(xml).toContain("</movie>");
      expect(xml).not.toContain("<episodedetails>");
      expect(xml).not.toContain("<season>");
    });
  });

  describe("NFO enrichment with DatabasePlugin", () => {
    test("populates showtitle, plot, and aired when database plugin provided", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "Test Anime - 1x01.mkv", {
          animeId: "42",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "First Episode",
          animeTitle: "Test Anime",
        });

        const mockDb = createMockDb({
          searchAnime: () => [{ id: "42", title: "Test Anime", entryType: "tv" as const }],
          getAnime: () => ({ id: "42", title: "Test Anime", entryType: "tv" as const }),
          getEpisodes: () => [
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
          ],
        });

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
      });
    });

    test("showtitle comes from database getAnime, not just from cache", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "Anime - 1x01.mkv", {
          animeId: "99",
          episodeId: "5",
          season: 1,
          episode: 1,
          title: "Ep Title",
          animeTitle: "Cached Anime Title",
        });

        const mockDb = createMockDb({
          searchAnime: () => [{ id: "99", title: "DB Anime Title", entryType: "tv" as const }],
          getAnime: () => ({ id: "99", title: "DB Anime Title", entryType: "tv" as const }),
          getEpisodes: () => [
            {
              id: "5",
              animeId: "99",
              season: 1,
              episode: 1,
              title: "Ep Title",
              overview: "DB overview",
              airDate: "2025-01-01",
              entryType: "tv" as const,
            },
          ],
        });

        const writer = new MetadataWriter({ cache, database: mockDb });
        await writer.write(dir);

        const nfoContent = readFileSync(join(dir, "Anime - 1x01.nfo"), "utf-8");
        expect(nfoContent).toContain("<showtitle>DB Anime Title</showtitle>");
        expect(nfoContent).not.toContain("<showtitle>Cached Anime Title</showtitle>");
      });
    });

    test("still writes NFO without database plugin (empty showtitle/plot/aired)", async () => {
      const match = makeCachedMatch({
        animeId: "12345",
        episodeId: "67890",
        season: 1,
        episode: 13,
        title: "The Test Episode",
      });

      const writer = new MetadataWriter({ cache: null as never });
      const xml = writer.generateEpisodeNfo(match);

      expect(xml).toContain("<showtitle></showtitle>");
      expect(xml).toContain("<plot></plot>");
      expect(xml).toContain("<aired></aired>");
    });
  });

  describe("write", () => {
    test("writes NFO sidecar next to cached video file", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "Test Anime - 1x01.mkv", {
          animeId: "42",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "First Episode",
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
      });
    });

    test("skips files that already have NFO (no overwrite)", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "SkipTest.mkv", {
          animeId: "1",
          episodeId: "2",
          season: 1,
          episode: 1,
          title: "Should Not Overwrite",
        });
        const nfoPath = join(dir, "SkipTest.nfo");
        writeFileSync(nfoPath, "old metadata");

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toBe("old metadata");
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(1);
      });
    });

    test("force option overwrites existing NFO file", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "ForceTest.mkv", {
          animeId: "1",
          episodeId: "2",
          season: 1,
          episode: 5,
          title: "New Episode",
        });
        const nfoPath = join(dir, "ForceTest.nfo");
        writeFileSync(nfoPath, "old metadata");

        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir, { force: true });

        const nfoContent = readFileSync(nfoPath, "utf-8");
        expect(nfoContent).toContain("<title>New Episode</title>");
        expect(nfoContent).toContain("<episode>5</episode>");
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(1);
        expect(summary.skipped).toBe(0);
      });
    });

    test("skips video files not in cache", async () => {
      await withTempDir("metadata", async (dir) => {
        writeTempFile(dir, "NoMatch.mkv", "uncached content");

        const cache = createCache(dir);
        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        const nfoPath = join(dir, "NoMatch.nfo");
        expect(existsSync(nfoPath)).toBe(false);
        expect(summary.total).toBe(1);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(1);
      });
    });

    test("handles empty directory", async () => {
      await withTempDir("metadata", async (dir) => {
        const cache = createCache(dir);
        const writer = new MetadataWriter({ cache });
        const summary = await writer.write(dir);

        expect(summary.total).toBe(0);
        expect(summary.written).toBe(0);
        expect(summary.skipped).toBe(0);
        expect(summary.failed).toBe(0);
      });
    });

    test("writes movie-style NFO for movie entry type", async () => {
      await withTempDir("metadata", async (dir) => {
        const { cache } = await seedCacheEntry(dir, "My Movie.mkv", {
          animeId: "99",
          entryType: "movie",
          title: "Great Movie",
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
      });
    });
  });
});
