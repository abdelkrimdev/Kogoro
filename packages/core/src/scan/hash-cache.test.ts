import { describe, expect, test } from "bun:test";
import { statSync } from "node:fs";
import {
  createMatchCacheService,
  hashFile,
  makeCachedMatch,
  makeMatchResult,
  overrideKey,
  withTempDir,
  writeTempFile,
} from "../fixtures";
import { OverrideStore } from "../match/override-store";
import { HashCache } from "./hash-cache";

describe("HashCache", () => {
  describe("prepareFile", () => {
    test("computes hash and looks up cache", async () => {
      await withTempDir("hashcache-prepare", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });

        const result = await hashCache.prepareFile(filePath);

        expect(result.hash).toBeTruthy();
        expect(result.cachedMatch).toBeNull();
        expect(result.overrideKey).toBe(overrideKey(filePath));
        expect(result.sourceDb).toBe("tvdb");
      });
    });

    test("returns cached match when file was previously matched", async () => {
      await withTempDir("hashcache-cached", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });

        const first = await hashCache.prepareFile(filePath);
        expect(first.cachedMatch).toBeNull();

        cacheService.storeMatchFromResult(first.hash, makeMatchResult(), "tvdb");

        const second = await hashCache.prepareFile(filePath);
        expect(second.cachedMatch).not.toBeNull();
        expect(second.cachedMatch?.animeId).toBe("1");
      });
    });

    test("skips cache lookup when force is true", async () => {
      await withTempDir("hashcache-force", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });

        const first = await hashCache.prepareFile(filePath);
        cacheService.storeMatchFromResult(first.hash, makeMatchResult(), "tvdb");

        const second = await hashCache.prepareFile(filePath, true);
        expect(second.cachedMatch).toBeNull();
      });
    });

    test("returns override when one exists", async () => {
      await withTempDir("hashcache-override", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");
        const { cacheService } = createMatchCacheService();
        const overrideStore = new OverrideStore(dir);
        const hashCache = new HashCache({ cacheService, overrideStore });

        const key = overrideKey(filePath);
        overrideStore.set(key, { animeId: "tvdb-99" });

        const result = await hashCache.prepareFile(filePath);
        expect(result.override).not.toBeNull();
        expect(result.override?.animeId).toBe("tvdb-99");
      });
    });

    test("uses sourceDb for cache lookup", async () => {
      await withTempDir("hashcache-sourcedb", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "content");
        const { cacheService } = createMatchCacheService();
        const hash = await import("../io/file-hash").then((m) => m.hashFile(filePath));
        cacheService.set(hash, makeCachedMatch({ sourceDb: "tvdb" }));

        const hashCacheTvdb = new HashCache({ cacheService, sourceDb: "tvdb" });
        const resultTvdb = await hashCacheTvdb.prepareFile(filePath);
        expect(resultTvdb.cachedMatch).not.toBeNull();

        const hashCacheAnidb = new HashCache({ cacheService, sourceDb: "anidb" });
        const resultAnidb = await hashCacheAnidb.prepareFile(filePath);
        expect(resultAnidb.cachedMatch).toBeNull();
      });
    });

    test("skips re-hashing when scan state is up to date", async () => {
      await withTempDir("hashcache-skip-hash", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService, scanStateService, close } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService, scanStateService });

        const first = await hashCache.prepareFile(filePath);
        expect(first.hash).toBeTruthy();

        const stat = statSync(filePath);
        const stored = scanStateService.get(filePath);
        expect(stored).not.toBeNull();
        expect(stored?.hash).toBe(first.hash);
        expect(stored?.size).toBe(stat.size);
        expect(stored?.mtime).toBe(Math.floor(stat.mtimeMs / 1000));

        const second = await hashCache.prepareFile(filePath);
        expect(second.hash).toBe(first.hash);

        close();
      });
    });

    test("stores scan state after hashing", async () => {
      await withTempDir("hashcache-store-state", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService, scanStateService, close } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService, scanStateService });

        const result = await hashCache.prepareFile(filePath);

        const stat = statSync(filePath);
        const stored = scanStateService.get(filePath);
        expect(stored).not.toBeNull();
        expect(stored?.hash).toBe(result.hash);
        expect(stored?.size).toBe(stat.size);
        expect(stored?.mtime).toBe(Math.floor(stat.mtimeMs / 1000));

        close();
      });
    });

    test("falls through to full hash when scan state is stale", async () => {
      await withTempDir("hashcache-stale-state", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService, scanStateService, close } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService, scanStateService });

        scanStateService.set(filePath, 999, 999, "stale-hash");

        const result = await hashCache.prepareFile(filePath);
        expect(result.hash).toBeTruthy();
        expect(result.hash).not.toBe("stale-hash");

        const stored = scanStateService.get(filePath);
        expect(stored?.hash).toBe(result.hash);

        close();
      });
    });

    test("returns cached match from scan state hash without re-hashing", async () => {
      await withTempDir("hashcache-cached-from-state", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService, scanStateService, close } = createMatchCacheService();

        const hash = await hashFile(filePath);
        const stat = statSync(filePath);
        scanStateService.set(filePath, stat.size, Math.floor(stat.mtimeMs / 1000), hash);
        cacheService.set(hash, makeCachedMatch({ animeId: "42", episodeId: "200" }));

        const hashCache = new HashCache({ cacheService, scanStateService });
        const result = await hashCache.prepareFile(filePath);

        expect(result.hash).toBe(hash);
        expect(result.cachedMatch).not.toBeNull();
        expect(result.cachedMatch?.animeId).toBe("42");
        expect(result.cachedMatch?.episodeId).toBe("200");

        close();
      });
    });

    test("force bypasses scan state cache and re-hashes", async () => {
      await withTempDir("hashcache-force-bypass", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService, scanStateService, close } = createMatchCacheService();

        const hash = await hashFile(filePath);
        const stat = statSync(filePath);
        scanStateService.set(filePath, stat.size, Math.floor(stat.mtimeMs / 1000), hash);

        const hashCache = new HashCache({ cacheService, scanStateService });
        const result = await hashCache.prepareFile(filePath, true);

        expect(result.hash).toBe(hash);

        close();
      });
    });
  });

  describe("persistMatch", () => {
    test("stores match in cache service", async () => {
      await withTempDir("hashcache-persist", async (_dir) => {
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });

        const resultHash = await hashCache.persistMatch(
          "/fake/file.mkv",
          "abc123",
          makeMatchResult(),
        );

        expect(resultHash).toBe("abc123");
        expect(cacheService.has("abc123")).toBe(true);
      });
    });

    test("computes hash when not provided", async () => {
      await withTempDir("hashcache-persist-hash", async (_dir) => {
        const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "content");
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });

        const resultHash = await hashCache.persistMatch(filePath, "", makeMatchResult());

        expect(resultHash).toBeTruthy();
        expect(cacheService.has(resultHash)).toBe(true);
      });
    });
  });

  describe("persistOverride", () => {
    test("stores override in override store", async () => {
      await withTempDir("hashcache-persist-override", async (dir) => {
        const { cacheService } = createMatchCacheService();
        const overrideStore = new OverrideStore(dir);
        const hashCache = new HashCache({ cacheService, overrideStore });

        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");
        const match = makeMatchResult();
        hashCache.persistOverride(filePath, match);

        const stored = overrideStore.get(overrideKey(filePath));
        expect(stored).not.toBeNull();
        expect(stored?.animeId).toBe("1");
        expect(stored?.episodeId).toBe("101");
        expect(stored?.entryType).toBe("tv");
      });
    });

    test("does nothing when no override store", async () => {
      await withTempDir("hashcache-no-store", async (dir) => {
        const { cacheService } = createMatchCacheService();
        const hashCache = new HashCache({ cacheService });
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");
        hashCache.persistOverride(filePath, makeMatchResult());
      });
    });
  });
});
