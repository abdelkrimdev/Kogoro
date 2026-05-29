import { afterEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMockClackPrompts,
  createMockDb,
  seedCacheEntry,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import { createMetadataHandlers } from "./handlers";

const { mock: clackMock, captures } = createMockClackPrompts();
mock.module("@clack/prompts", () => clackMock);

describe("metadata CLI commands", () => {
  afterEach(() => {
    captures.reset();
  });

  test("write generates NFO and outputs summary", async () => {
    await withTempDir("cli-meta", async (dir) => {
      await seedCacheEntry(dir, "Test.mkv", {
        episodeId: "10",
        season: 1,
        episode: 2,
        title: "Test Ep",
      });

      const dbPath = join(dir, "cache.db");
      const handlers = createMetadataHandlers({ dbPath });
      await handlers.write(dir, { json: true });

      const jsonOutput = captures.logMessage.find((msg) => msg.startsWith("{")) as string;
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
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
      await handlers.write(dir, {});

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
      await handlers.write(dir, { force: true, json: true });

      const jsonOutput = captures.logMessage.find((msg) => msg.startsWith("{")) as string;
      expect(jsonOutput).toBeDefined();
      const parsed = JSON.parse(jsonOutput);
      expect(parsed.written).toBe(1);
      expect(parsed.skipped).toBe(0);
    });
  });
});
