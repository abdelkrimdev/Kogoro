import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtworkFetcher } from "./artwork-fetcher";
import { MatchCache } from "./match-cache";
import {
  createArtworkDb,
  createCache,
  createMockHttpClient,
  createTrackingFetch,
  makeCachedMatch,
  mockFetch,
  testImageBytes,
  writeTempFile,
} from "./test-fixtures";

describe("ArtworkFetcher", () => {
  function setup() {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-artwork-test-"));
    const animeDir = join(dir, "TV", "Jujutsu Kaisen");
    mkdirSync(animeDir, { recursive: true });
    const videoPath = writeTempFile(animeDir, "ep1.mkv", "dummy video content");

    const cache = createCache(dir);

    async function seedCache(animeId = "12345") {
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(
        hash,
        makeCachedMatch({
          animeId,
          episodeId: "101",
          season: 1,
          episode: 1,
          title: "Test Episode",
        }),
      );
    }

    return {
      dir,
      animeDir,
      videoPath,
      cache,
      seedCache,
      cleanup: () => rmSync(dir, { recursive: true, force: true }),
    };
  }

  test("downloads poster and saves cover.jpg in anime directory", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("skips anime directory that already has cover.jpg", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      writeFileSync(join(animeDir, "cover.jpg"), "existing cover");

      await seedCache();

      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 0, skipped: 1, noArtwork: 0 });
    } finally {
      cleanup();
    }
  });

  test("force option overwrites existing cover.jpg", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      writeFileSync(join(animeDir, "cover.jpg"), "old cover");

      await seedCache();

      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
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
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const primaryDb = createArtworkDb([]);
      const secondaryDb = createArtworkDb([
        { id: "2", type: "poster", url: "https://secondary.example.com/poster.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb,
        secondaryDbs: [secondaryDb],
        cache,
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      const summary = await fetcher.process(dir);

      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("reports noArtwork when no database returns poster", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const primaryDb = createArtworkDb([]);
      const secondaryDb = createArtworkDb([]);

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

  test("selects highest resolution poster URL when multiple available", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/small.jpg", width: 200, height: 300 },
        {
          id: "2",
          type: "poster",
          url: "https://example.com/large.jpg",
          width: 1000,
          height: 1500,
        },
        { id: "3", type: "poster", url: "https://example.com/medium.jpg", width: 500, height: 750 },
      ]);

      const requestedUrls: string[] = [];
      const trackingFetch = createTrackingFetch(requestedUrls, testImageBytes);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        httpClient: createMockHttpClient(trackingFetch),
      });

      const summary = await fetcher.process(dir);
      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(requestedUrls).toContain("https://example.com/large.jpg");
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("falls back to first artwork when no resolution data available", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/first.jpg" },
        { id: "2", type: "poster", url: "https://example.com/second.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      const summary = await fetcher.process(dir);
      expect(summary).toEqual({ total: 1, downloaded: 1, skipped: 0, noArtwork: 0 });
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      cleanup();
    }
  });

  test("reports total 0 when directory has no cached files", async () => {
    const { dir, cache, cleanup } = setup();
    try {
      const mockDb = createArtworkDb([
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
