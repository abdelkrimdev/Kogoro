import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CachedMatch, MatchCache } from "./match-cache";

function createTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "kogoro-cache-test-"));
  return join(dir, "cache.db");
}

function cleanupTempDb(dbPath: string) {
  const dir = join(dbPath, "..");
  rmSync(dir, { recursive: true, force: true });
}

describe("MatchCache", () => {
  test("set stores a match and get retrieves it", () => {
    const dbPath = createTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      const match: CachedMatch = {
        animeId: "1",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 5,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      };
      cache.set("abc123", match);
      const result = cache.get("abc123");
      expect(result).toEqual(match);
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("has returns true for existing key and false for missing key", () => {
    const dbPath = createTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      expect(cache.has("nonexistent")).toBe(false);
      cache.set("abc", {
        animeId: "1",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(cache.has("abc")).toBe(true);
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("get returns null for missing key", () => {
    const dbPath = createTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      expect(cache.get("nonexistent")).toBeNull();
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("clear removes all entries", () => {
    const dbPath = createTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("a", {
        animeId: "1",
        episodeId: null,
        entryType: "tv",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      cache.set("b", {
        animeId: "2",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(true);
      cache.clear();
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(false);
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("hashFile computes SHA-256 hash of file contents", async () => {
    const filePath = join(tmpdir(), "kogoro-cache-hash-test.txt");
    try {
      await Bun.write(filePath, "hello world");
      const hash = await MatchCache.hashFile(filePath);
      expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    } finally {
      rmSync(filePath, { force: true });
    }
  });

  test("list returns all entries ordered by timestamp", () => {
    const dbPath = createTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("a", {
        animeId: "1",
        episodeId: null,
        entryType: "tv",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      cache.set("b", {
        animeId: "2",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-03T00:00:00.000Z",
      });
      cache.set("c", {
        animeId: "3",
        episodeId: null,
        entryType: "ova",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-02T00:00:00.000Z",
      });
      const entries = cache.list();
      expect(entries).toHaveLength(3);
      expect(entries[0]?.hash).toBe("a");
      expect(entries[1]?.hash).toBe("c");
      expect(entries[2]?.hash).toBe("b");
    } finally {
      cleanupTempDb(dbPath);
    }
  });
});
