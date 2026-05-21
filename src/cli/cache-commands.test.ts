import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createCacheHandlers } from "../cli/cache-commands";
import { createCache, createLogCapture, makeCachedMatch, withTempDir } from "../test-fixtures";

describe("cache CLI commands", () => {
  test("cache list returns JSON array of all cached entries", async () => {
    await withTempDir("cache", async (dir) => {
      const dbPath = join(dir, "cache.db");
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

      const handlers = createCacheHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.list(log.onLog, () => {});

      const parsed = JSON.parse(log.output);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.hash).toBe("hash1");
      expect(parsed[0]?.match.animeId).toBe("1");
      expect(parsed[1]?.hash).toBe("hash2");
    });
  });

  test("cache lookup returns match for existing hash", async () => {
    await withTempDir("cache", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const cache = createCache(dir);
      cache.set(
        "existhash",
        makeCachedMatch({ animeId: "99", entryType: "ova", title: "Special" }),
      );

      const handlers = createCacheHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.lookup("existhash", log.onLog, () => {});

      const parsed = JSON.parse(log.output);
      expect(parsed.animeId).toBe("99");
      expect(parsed.entryType).toBe("ova");
    });
  });

  test("cache lookup returns message for missing hash", async () => {
    await withTempDir("cache", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const handlers = createCacheHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.lookup("nonexistent", () => {}, log.onError);
      expect(log.errorOutput).toBe("No cached match for hash: nonexistent");
    });
  });

  test("cache clear removes all entries", async () => {
    await withTempDir("cache", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const cache = createCache(dir);
      cache.set("a", makeCachedMatch());
      expect(cache.has("a")).toBe(true);

      const handlers = createCacheHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.clear(true, log.onLog, () => {});
      expect(log.output).toBe("Cache cleared");
      expect(cache.has("a")).toBe(false);
    });
  });

  test("cache clear skips when confirmation denied", async () => {
    await withTempDir("cache", async (dir) => {
      const dbPath = join(dir, "cache.db");
      const cache = createCache(dir);
      cache.set("a", makeCachedMatch());

      const handlers = createCacheHandlers({ dbPath });
      const log = createLogCapture();
      await handlers.clear(false, log.onLog, () => {});
      expect(log.output).toBe("Cache clear cancelled");
      expect(cache.has("a")).toBe(true);
    });
  });
});
