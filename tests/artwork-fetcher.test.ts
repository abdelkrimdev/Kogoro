import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtworkFetcher } from "../src/artwork-fetcher.ts";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import type { ArtworkResult } from "../src/db/types.ts";
import { MatchCache } from "../src/match-cache.ts";

function mockFetch(
  data: string,
  status = 200,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": "image/jpeg" },
    });
  };
}

const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

function createMockDb(artworks: ArtworkResult[]): DatabasePlugin {
  return {
    async searchAnime() {
      return [];
    },
    async getEpisodes() {
      return [];
    },
    async getArtwork() {
      return artworks;
    },
  };
}

describe("ArtworkFetcher", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-artwork-test-"));
    const animeDir = join(dir, "TV", "Jujutsu Kaisen");
    mkdirSync(animeDir, { recursive: true });
    const videoPath = join(animeDir, "ep1.mkv");
    writeFileSync(videoPath, "dummy video content");

    const dbPath = join(dir, "cache.db");
    const cache = new MatchCache({ dbPath });

    return {
      dir,
      animeDir,
      videoPath,
      cache,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  }

  test("downloads poster and saves cover.jpg in anime directory", async () => {
    const { dir, animeDir, videoPath, cache, cleanup } = setup();
    try {
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const mockDb = createMockDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("skips anime directory that already has cover.jpg", async () => {
    const { dir, animeDir, videoPath, cache, cleanup } = setup();
    try {
      writeFileSync(join(animeDir, "cover.jpg"), "existing cover");

      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const mockDb = createMockDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 0, skipped: 1, noArtwork: 0 });
    } finally {
      cleanup();
    }
  });

  test("force overwrites existing cover.jpg", async () => {
    const { dir, animeDir, videoPath, cache, cleanup } = setup();
    try {
      writeFileSync(join(animeDir, "cover.jpg"), "old cover");

      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const mockDb = createMockDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const summary = await fetcher.process(dir, { force: true });

      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      const coverContent = await Bun.file(join(animeDir, "cover.jpg")).text();
      expect(coverContent).toBe(testImageBytes);
    } finally {
      cleanup();
    }
  });

  test("falls back to secondary database when primary has no artwork", async () => {
    const { dir, animeDir, videoPath, cache, cleanup } = setup();
    try {
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const primaryDb = createMockDb([]);
      const secondaryDb = createMockDb([
        { id: "2", type: "poster", url: "https://secondary.example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb,
        secondaryDbs: [secondaryDb],
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("reports noArtwork when no database returns poster", async () => {
    const { dir, animeDir, videoPath, cache, cleanup } = setup();
    try {
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const primaryDb = createMockDb([]);
      const secondaryDb = createMockDb([]);

      const fetcher = new ArtworkFetcher({
        primaryDb,
        secondaryDbs: [secondaryDb],
        cache,
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 0, skipped: 0, noArtwork: 1 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(false);
    } finally {
      cleanup();
    }
  });

  test("reports total 0 when no cache entries for files in directory", async () => {
    const { dir, cache, cleanup } = setup();
    try {
      const mockDb = createMockDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 0, downloaded: 0, skipped: 0, noArtwork: 0 });
    } finally {
      cleanup();
    }
  });
});
