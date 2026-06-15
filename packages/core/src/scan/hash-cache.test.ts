import { describe, expect, test } from "bun:test";
import { basename } from "node:path";
import {
  createMatchCacheService,
  makeCachedMatch,
  makeMatchResult,
  withTempDir,
  writeTempFile,
} from "../fixtures";
import { OverrideStore } from "../match/override-store";
import { computeFileHash, HashCache } from "./hash-cache";

describe("computeFileHash", () => {
  test("produces consistent hash for same input", () => {
    const hash1 = computeFileHash("test.mkv");
    const hash2 = computeFileHash("test.mkv");
    expect(hash1).toBe(hash2);
  });

  test("produces different hashes for different inputs", () => {
    const hash1 = computeFileHash("file1.mkv");
    const hash2 = computeFileHash("file2.mkv");
    expect(hash1).not.toBe(hash2);
  });
});

describe("HashCache", () => {
  describe("prepareFile", () => {
    test("returns empty hash when no cache service", async () => {
      const hashCache = new HashCache({});
      const result = await hashCache.prepareFile("/fake/file.mkv");

      expect(result.hash).toBe("");
      expect(result.cachedMatch).toBeNull();
      expect(result.override).toBeNull();
      expect(result.overrideKey).toBeTruthy();
    });

    test("computes hash and looks up cache when cache service provided", async () => {
      await withTempDir("hashcache-prepare", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService(dir);
        const hashCache = new HashCache({ cacheService });

        const result = await hashCache.prepareFile(filePath);

        expect(result.hash).toBeTruthy();
        expect(result.cachedMatch).toBeNull();
        expect(result.overrideKey).toBe(computeFileHash(basename(filePath)));
      });
    });

    test("returns cached match when file was previously matched", async () => {
      await withTempDir("hashcache-cached", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService(dir);
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
      await withTempDir("hashcache-force", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "video content");
        const { cacheService } = createMatchCacheService(dir);
        const hashCache = new HashCache({ cacheService });

        const first = await hashCache.prepareFile(filePath);
        cacheService.storeMatchFromResult(first.hash, makeMatchResult(), "tvdb");

        const second = await hashCache.prepareFile(filePath, undefined, true);
        expect(second.cachedMatch).toBeNull();
      });
    });

    test("returns override when one exists", async () => {
      await withTempDir("hashcache-override", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");
        const overrideStore = new OverrideStore(dir);
        const hashCache = new HashCache({ overrideStore });

        const overrideKey = computeFileHash(basename(filePath));
        overrideStore.set(overrideKey, { animeId: "tvdb-99" });

        const result = await hashCache.prepareFile(filePath);
        expect(result.override).not.toBeNull();
        expect(result.override?.animeId).toBe("tvdb-99");
      });
    });

    test("uses sourceDb for cache lookup", async () => {
      await withTempDir("hashcache-sourcedb", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content");
        const { cacheService } = createMatchCacheService(dir);
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
  });

  describe("persistMatch", () => {
    test("stores match in cache service", async () => {
      await withTempDir("hashcache-persist", async (dir) => {
        const { cacheService } = createMatchCacheService(dir);
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
      await withTempDir("hashcache-persist-hash", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content");
        const { cacheService } = createMatchCacheService(dir);
        const hashCache = new HashCache({ cacheService });

        const resultHash = await hashCache.persistMatch(filePath, "", makeMatchResult());

        expect(resultHash).toBeTruthy();
        expect(cacheService.has(resultHash)).toBe(true);
      });
    });

    test("returns hash unchanged when no cache service", async () => {
      const hashCache = new HashCache({});
      const resultHash = await hashCache.persistMatch(
        "/fake/file.mkv",
        "abc123",
        makeMatchResult(),
      );
      expect(resultHash).toBe("abc123");
    });
  });

  describe("persistOverride", () => {
    test("stores override in override store", async () => {
      await withTempDir("hashcache-persist-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        const hashCache = new HashCache({ overrideStore });

        const match = makeMatchResult();
        hashCache.persistOverride("hash123", match);

        const stored = overrideStore.get("hash123");
        expect(stored).not.toBeNull();
        expect(stored?.animeId).toBe("1");
        expect(stored?.episodeId).toBe("101");
        expect(stored?.entryType).toBe("tv");
      });
    });

    test("does nothing when no override store", () => {
      const hashCache = new HashCache({});
      hashCache.persistOverride("hash123", makeMatchResult());
    });

    test("does nothing when overrideKey is undefined", async () => {
      await withTempDir("hashcache-no-key", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        const hashCache = new HashCache({ overrideStore });

        hashCache.persistOverride(undefined, makeMatchResult());

        expect(overrideStore.list()).toHaveLength(0);
      });
    });
  });
});
