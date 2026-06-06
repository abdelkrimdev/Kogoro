import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createCache, makeCachedMatch, withTempDir } from "../fixtures";
import { MatchCache } from "./match-cache";

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

  describe("scan_state", () => {
    test("setScanState stores entry and getScanState retrieves it", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/path/to/file.mkv", 1024, 1700000000, "abc123");
        const result = cache.getScanState("/path/to/file.mkv");
        expect(result).toEqual({ size: 1024, mtime: 1700000000, hash: "abc123" });
      });
    });

    test("getScanState returns null for missing path", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        expect(cache.getScanState("/nonexistent")).toBeNull();
      });
    });

    test("setScanState overwrites existing entry", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/path/file.mkv", 100, 1000, "hash1");
        cache.setScanState("/path/file.mkv", 200, 2000, "hash2");
        expect(cache.getScanState("/path/file.mkv")).toEqual({
          size: 200,
          mtime: 2000,
          hash: "hash2",
        });
      });
    });

    test("deleteScanState removes an entry", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/path/file.mkv", 100, 1000, "hash");
        cache.deleteScanState("/path/file.mkv");
        expect(cache.getScanState("/path/file.mkv")).toBeNull();
      });
    });

    test("deleteScanState is a no-op for missing path", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.deleteScanState("/nonexistent");
        expect(cache.getScanState("/nonexistent")).toBeNull();
      });
    });

    test("getScanStateBatch returns entries for multiple paths", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/a.mkv", 100, 1000, "hashA");
        cache.setScanState("/b.mkv", 200, 2000, "hashB");
        cache.setScanState("/c.mkv", 300, 3000, "hashC");
        const result = cache.getScanStateBatch(["/a.mkv", "/b.mkv", "/missing.mkv"]);
        expect(result.size).toBe(2);
        expect(result.get("/a.mkv")).toEqual({ size: 100, mtime: 1000, hash: "hashA" });
        expect(result.get("/b.mkv")).toEqual({ size: 200, mtime: 2000, hash: "hashB" });
        expect(result.has("/missing.mkv")).toBe(false);
      });
    });

    test("deleteScanStateBatch removes multiple entries", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/a.mkv", 100, 1000, "hashA");
        cache.setScanState("/b.mkv", 200, 2000, "hashB");
        cache.setScanState("/c.mkv", 300, 3000, "hashC");
        cache.deleteScanStateBatch(["/a.mkv", "/c.mkv"]);
        expect(cache.getScanState("/a.mkv")).toBeNull();
        expect(cache.getScanState("/b.mkv")).toEqual({ size: 200, mtime: 2000, hash: "hashB" });
        expect(cache.getScanState("/c.mkv")).toBeNull();
      });
    });

    test("purgeStale removes scan_state entries not in currentPaths", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);
        cache.setScanState("/a.mkv", 100, 1000, "hashA");
        cache.setScanState("/b.mkv", 200, 2000, "hashB");
        cache.setScanState("/c.mkv", 300, 3000, "hashC");

        cache.purgeStale(["/a.mkv", "/c.mkv"]);

        expect(cache.getScanState("/a.mkv")).toEqual({ size: 100, mtime: 1000, hash: "hashA" });
        expect(cache.getScanState("/b.mkv")).toBeNull();
        expect(cache.getScanState("/c.mkv")).toEqual({ size: 300, mtime: 3000, hash: "hashC" });
      });
    });

    test("purgeStale removes orphaned matches entries", async () => {
      await withTempDir("cache", async (dir) => {
        const cache = createCache(dir);

        cache.set("hashA", makeCachedMatch({ animeId: "1" }));
        cache.set("hashB", makeCachedMatch({ animeId: "2" }));
        cache.set("hashC", makeCachedMatch({ animeId: "3" }));

        cache.setScanState("/a.mkv", 100, 1000, "hashA");
        cache.setScanState("/b.mkv", 200, 2000, "hashB");
        cache.setScanState("/c.mkv", 300, 3000, "hashC");

        cache.purgeStale(["/a.mkv", "/c.mkv"]);

        expect(cache.getScanState("/a.mkv")).not.toBeNull();
        expect(cache.getScanState("/b.mkv")).toBeNull();
        expect(cache.getScanState("/c.mkv")).not.toBeNull();
        expect(cache.has("hashA")).toBe(true);
        expect(cache.has("hashB")).toBe(false);
        expect(cache.has("hashC")).toBe(true);
      });
    });
  });
});
