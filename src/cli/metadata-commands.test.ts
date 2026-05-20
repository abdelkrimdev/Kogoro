import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMetadataHandlers } from "../cli/metadata-commands";
import { MatchCache } from "../match-cache";
import { createCache, createMockDb, makeCachedMatch, withTempDir } from "../test-helpers";

describe("metadata CLI commands", () => {
  test("write generates NFO and returns summary JSON", async () => {
    await withTempDir("cli-meta", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const videoPath = join(dir, "Test.mkv");
      writeFileSync(videoPath, "test content");

      const hash = await MatchCache.hashFile(videoPath);
      const cache = createCache(dir);
      cache.set(
        hash,
        makeCachedMatch({
          episodeId: "10",
          season: 1,
          episode: 2,
          title: "Test Ep",
        }),
      );

      const handlers = createMetadataHandlers({ dbPath });
      let logOutput = "";
      await handlers.write(
        dir,
        false,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed.total).toBe(1);
      expect(parsed.written).toBe(1);
    });
  });

  test("write with database enriches NFO with showtitle, plot, and aired", async () => {
    await withTempDir("cli-meta", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const videoPath = join(dir, "Anime - 1x01.mkv");
      writeFileSync(videoPath, "content");

      const hash = await MatchCache.hashFile(videoPath);
      const cache = createCache(dir);
      cache.set(
        hash,
        makeCachedMatch({
          animeId: "42",
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "First Episode",
          animeTitle: "Test Anime",
        }),
      );

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

      const handlers = createMetadataHandlers({ dbPath, database: mockDb });
      await handlers.write(
        dir,
        false,
        () => {},
        () => {},
      );

      const nfoPath = join(dir, "Anime - 1x01.nfo");
      const nfoContent = readFileSync(nfoPath, "utf-8");
      expect(nfoContent).toContain("<showtitle>Test Anime</showtitle>");
      expect(nfoContent).toContain("<plot>A thrilling start</plot>");
      expect(nfoContent).toContain("<aired>2026-01-15</aired>");
    });
  });

  test("write with force overwrites existing NFO", async () => {
    await withTempDir("cli-meta", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const videoPath = join(dir, "Force.mkv");
      const nfoPath = join(dir, "Force.nfo");
      writeFileSync(videoPath, "content");
      writeFileSync(nfoPath, "old");

      const hash = await MatchCache.hashFile(videoPath);
      const cache = createCache(dir);
      cache.set(
        hash,
        makeCachedMatch({
          episodeId: "10",
          season: 1,
          episode: 1,
          title: "New",
        }),
      );

      const handlers = createMetadataHandlers({ dbPath });
      let logOutput = "";
      await handlers.write(
        dir,
        true,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed.written).toBe(1);
      expect(parsed.skipped).toBe(0);
    });
  });
});
