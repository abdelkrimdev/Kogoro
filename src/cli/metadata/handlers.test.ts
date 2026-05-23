import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLogCapture,
  createMockDb,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "../../test-fixtures";
import { createMetadataHandlers } from "./handlers";

describe("metadata CLI commands", () => {
  test("write generates NFO and returns summary JSON", async () => {
    await withTempDir("cli-meta", async (dir) => {
      await seedCacheEntry(dir, "Test.mkv", {
        episodeId: "10",
        season: 1,
        episode: 2,
        title: "Test Ep",
      });

      const dbPath = join(dir, "cache.db");
      const handlers = createMetadataHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.write(dir, false, log.onLog, () => {});

      const parsed = JSON.parse(log.output);
      expect(parsed.total).toBe(1);
      expect(parsed.written).toBe(1);
    });
  });

  test("write with database enriches NFO with showtitle, plot, and aired", async () => {
    await withTempDir("cli-meta", async (dir) => {
      await seedCacheEntry(dir, "Anime - 1x01.mkv", {
        animeId: "42",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "First Episode",
        animeTitle: "Test Anime",
      });

      const dbPath = join(dir, "cache.db");
      const mockDb = createMockDb({
        searchAnime: () => [{ id: "42", titleEn: "Test Anime", entryType: "tv" as const }],
        getAnime: () => ({ id: "42", titleEn: "Test Anime", entryType: "tv" as const }),
        getEpisodes: () => [
          {
            id: "101",
            animeId: "42",
            season: 1,
            episode: 1,
            titleEn: "First Episode",
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
      await seedCacheEntry(dir, "Force.mkv", {
        episodeId: "10",
        season: 1,
        episode: 1,
        title: "New",
      });
      writeTempFile(dir, "Force.nfo", "old");

      const dbPath = join(dir, "cache.db");
      const handlers = createMetadataHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.write(dir, true, log.onLog, () => {});

      const parsed = JSON.parse(log.output);
      expect(parsed.written).toBe(1);
      expect(parsed.skipped).toBe(0);
    });
  });
});
