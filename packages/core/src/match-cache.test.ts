import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { MatchCache } from "./match-cache";
import { createCache, makeCachedMatch, withTempDir } from "./test-fixtures";

describe("MatchCache", () => {
  test("set stores a match and get retrieves it", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      const match = makeCachedMatch({
        episodeId: "101",
        season: 1,
        episode: 5,
        title: "Test Episode",
      });
      cache.set("abc123", match);
      const result = cache.get("abc123");
      expect(result).toEqual(match);
    });
  });

  test("has returns true for existing key and false for missing key", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      expect(cache.has("nonexistent")).toBe(false);
      cache.set("abc", makeCachedMatch({ entryType: "movie" }));
      expect(cache.has("abc")).toBe(true);
    });
  });

  test("get returns null for missing key", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      expect(cache.get("nonexistent")).toBeNull();
    });
  });

  test("clear removes all entries", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      cache.set("a", makeCachedMatch());
      cache.set("b", makeCachedMatch({ animeId: "2", entryType: "movie" }));
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(true);
      cache.clear();
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(false);
    });
  });

  test("hashFile computes SHA-256 hash of file contents", async () => {
    await withTempDir("cache-hash", async (dir) => {
      const filePath = join(dir, "test.txt");
      await Bun.write(filePath, "hello world");
      const hash = await MatchCache.hashFile(filePath);
      expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });
  });

  test("list returns all entries ordered by timestamp", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      cache.set("a", makeCachedMatch());
      cache.set(
        "b",
        makeCachedMatch({
          animeId: "2",
          entryType: "movie",
          timestamp: "2026-01-03T00:00:00.000Z",
        }),
      );
      cache.set(
        "c",
        makeCachedMatch({ animeId: "3", entryType: "ova", timestamp: "2026-01-02T00:00:00.000Z" }),
      );
      const entries = cache.list();
      expect(entries).toHaveLength(3);
      expect(entries[0]?.hash).toBe("a");
      expect(entries[1]?.hash).toBe("c");
      expect(entries[2]?.hash).toBe("b");
    });
  });
});
