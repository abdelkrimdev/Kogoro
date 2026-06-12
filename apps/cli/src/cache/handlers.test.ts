import { describe, expect, test } from "bun:test";
import { createMatchCacheService, makeCachedMatch, withTempDir } from "@kogoro/core";
import { createCacheHandlers } from "./handlers";

describe("cache CLI commands", () => {
  test("list returns all cached entries", async () => {
    await withTempDir("cache", async (dir) => {
      const { matchRepo, cacheService, close } = createMatchCacheService(dir);
      matchRepo.set(
        "hash1",
        makeCachedMatch({ episodeId: "101", season: 1, episode: 5, title: "Ep 5" }),
      );
      matchRepo.set(
        "hash2",
        makeCachedMatch({
          animeId: "2",
          entryType: "movie",
          title: "Movie",
          timestamp: "2026-01-02T00:00:00.000Z",
        }),
      );

      const handlers = createCacheHandlers({ cacheService });
      const entries = handlers.list();

      expect(entries).toHaveLength(2);
      expect(entries[0]?.hash).toBe("hash1");
      expect(entries[0]?.match.animeId).toBe("1");
      expect(entries[1]?.hash).toBe("hash2");
      close();
    });
  });

  test("lookup returns match for existing hash", async () => {
    await withTempDir("cache", async (dir) => {
      const { matchRepo, cacheService, close } = createMatchCacheService(dir);
      matchRepo.set(
        "existhash",
        makeCachedMatch({ animeId: "99", entryType: "ova", title: "Special" }),
      );

      const handlers = createCacheHandlers({ cacheService });
      const match = handlers.lookup("existhash");

      expect(match?.animeId).toBe("99");
      expect(match?.entryType).toBe("ova");
      close();
    });
  });

  test("lookup returns null for missing hash", async () => {
    await withTempDir("cache-empty", async (dir) => {
      const { cacheService, close } = createMatchCacheService(dir);
      const handlers = createCacheHandlers({ cacheService });
      const match = handlers.lookup("nonexistent");
      expect(match).toBeNull();
      close();
    });
  });

  test("clear removes all entries and returns true", async () => {
    await withTempDir("cache", async (dir) => {
      const { matchRepo, cacheService, close } = createMatchCacheService(dir);
      matchRepo.set("a", makeCachedMatch());
      expect(matchRepo.has("a")).toBe(true);

      const handlers = createCacheHandlers({ cacheService });
      const result = handlers.clear();
      expect(result).toBe(true);
      expect(matchRepo.has("a")).toBe(false);
      close();
    });
  });
});

describe("cache purge", () => {
  test("purge removes stale entries not in currentPaths", async () => {
    await withTempDir("cache-purge", async (dir) => {
      const { matchRepo, scanStateRepo, cacheService, close } = createMatchCacheService(dir);

      scanStateRepo.set("/old.mkv", 100, 1000, "oldHash");
      matchRepo.set("oldHash", makeCachedMatch({ animeId: "99" }));

      const handlers = createCacheHandlers({ cacheService });
      handlers.purge(["/current.mkv"]);

      expect(matchRepo.has("oldHash")).toBe(false);
      close();
    });
  });

  test("purge with empty paths clears everything", async () => {
    await withTempDir("cache-purge-all", async (dir) => {
      const { matchRepo, cacheService, close } = createMatchCacheService(dir);

      matchRepo.set("a", makeCachedMatch());

      const handlers = createCacheHandlers({ cacheService });
      handlers.purge([]);

      expect(matchRepo.list()).toHaveLength(0);
      close();
    });
  });
});
