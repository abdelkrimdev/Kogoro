import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createArtworkDb,
  createCache,
  createMockHttpClient,
  createTrackingFetch,
  makeCachedMatch,
  mockFetch,
  testImageBytes,
  writeTempFile,
} from "../fixtures";
import type { ProgressEvent, TaskContext } from "../io/progress";
import { MatchCache } from "../match/match-cache";
import { ArtworkFetcher } from "./artwork-fetcher";

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

  test("reports noArtwork when primary database returns no poster", async () => {
    const { dir, animeDir, cache, seedCache, cleanup } = setup();
    try {
      await seedCache();

      const primaryDb = createArtworkDb([]);

      const fetcher = new ArtworkFetcher({
        primaryDb,
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

  test("reports progress for each anime during download phase", async () => {
    const { dir, cache, seedCache, cleanup } = setup();
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

      const events: ProgressEvent[] = [];
      const ctx: TaskContext = {
        progress: (p) => events.push(p),
        log() {},
        error() {},
      };

      const summary = await fetcher.process(dir, undefined, ctx);

      expect(summary.total).toBe(1);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.total).toBe(1);
      expect(events[0]?.completed).toBeGreaterThanOrEqual(1);
    } finally {
      cleanup();
    }
  });

  test("stops processing when aborted", async () => {
    const { dir, cache, cleanup } = setup();
    try {
      const mockDb = createArtworkDb([
        { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
        { id: "2", type: "poster", url: "https://example.com/poster2.jpg" },
      ]);

      const fetcher = new ArtworkFetcher({
        primaryDb: mockDb,
        cache,
      });

      const abortController = new AbortController();
      const events: ProgressEvent[] = [];
      const ctx: TaskContext = {
        progress: (p) => {
          events.push(p);
          if (events.length >= 1) abortController.abort();
        },
        log() {},
        error() {},
        abortSignal: abortController.signal,
      };

      const summary = await fetcher.process(dir, undefined, ctx);

      expect(summary.total).toBeLessThanOrEqual(2);
    } finally {
      cleanup();
    }
  });
});
