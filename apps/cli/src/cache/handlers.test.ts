import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createCache, makeCachedMatch, withTempDir } from "@kogoro/core";
import { createCacheHandlers } from "./handlers";

describe("cache CLI commands", () => {
  test("list returns all cached entries", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      cache.set(
        "hash1",
        makeCachedMatch({ episodeId: "101", season: 1, episode: 5, title: "Ep 5" }),
      );
      cache.set(
        "hash2",
        makeCachedMatch({
          animeId: "2",
          entryType: "movie",
          title: "Movie",
          timestamp: "2026-01-02T00:00:00.000Z",
        }),
      );

      const handlers = createCacheHandlers({ dbPath: join(dir, "cache.db") });
      const entries = handlers.list();

      expect(entries).toHaveLength(2);
      expect(entries[0]?.hash).toBe("hash1");
      expect(entries[0]?.match.animeId).toBe("1");
      expect(entries[1]?.hash).toBe("hash2");
    });
  });

  test("lookup returns match for existing hash", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      cache.set(
        "existhash",
        makeCachedMatch({ animeId: "99", entryType: "ova", title: "Special" }),
      );

      const handlers = createCacheHandlers({ dbPath: join(dir, "cache.db") });
      const match = handlers.lookup("existhash");

      expect(match?.animeId).toBe("99");
      expect(match?.entryType).toBe("ova");
    });
  });

  test("lookup returns null for missing hash", () => {
    const handlers = createCacheHandlers();
    const match = handlers.lookup("nonexistent");
    expect(match).toBeNull();
  });

  test("clear removes all entries and returns true", async () => {
    await withTempDir("cache", async (dir) => {
      const cache = createCache(dir);
      cache.set("a", makeCachedMatch());
      expect(cache.has("a")).toBe(true);

      const handlers = createCacheHandlers({ dbPath: join(dir, "cache.db") });
      const result = handlers.clear();
      expect(result).toBe(true);
      expect(cache.has("a")).toBe(false);
    });
  });
});
