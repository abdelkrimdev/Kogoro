import { describe, expect, test } from "bun:test";
import { makeCachedMatch, makeMatchResult } from "../fixtures";
import { CacheService } from "./cache-service";
import { ManifestRepository } from "./manifest-repository";
import { MatchRepository } from "./match-repository";
import { createMatchCacheDb } from "./test-utils";

describe("CacheService", () => {
  test("purgeStale removes manifest entries not in currentPaths", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      manifestRepo.set("/a.mkv", 100, 1000, "hashA");
      manifestRepo.set("/b.mkv", 200, 2000, "hashB");
      manifestRepo.set("/c.mkv", 300, 3000, "hashC");

      service.purgeStale(["/a.mkv", "/c.mkv"]);

      expect(manifestRepo.get("/a.mkv")).toEqual({ size: 100, mtime: 1000, hash: "hashA" });
      expect(manifestRepo.get("/b.mkv")).toBeNull();
      expect(manifestRepo.get("/c.mkv")).toEqual({ size: 300, mtime: 3000, hash: "hashC" });
    } finally {
      sqlite.close();
    }
  });

  test("purgeStale removes orphaned match entries", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch({ animeId: "1" }));
      matchRepo.set("hashB", makeCachedMatch({ animeId: "2" }));
      matchRepo.set("hashC", makeCachedMatch({ animeId: "3" }));

      manifestRepo.set("/a.mkv", 100, 1000, "hashA");
      manifestRepo.set("/b.mkv", 200, 2000, "hashB");
      manifestRepo.set("/c.mkv", 300, 3000, "hashC");

      service.purgeStale(["/a.mkv", "/c.mkv"]);

      expect(matchRepo.has("hashA")).toBe(true);
      expect(matchRepo.has("hashB")).toBe(false);
      expect(matchRepo.has("hashC")).toBe(true);
    } finally {
      sqlite.close();
    }
  });

  test("get returns cached match by hash", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch({ animeId: "1" }));

      const result = service.get("hashA");

      expect(result).not.toBeNull();
      expect(result?.animeId).toBe("1");
    } finally {
      sqlite.close();
    }
  });

  test("get returns null for unknown hash", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      expect(service.get("nonexistent")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("get filters by sourceDb when provided", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch({ animeId: "1", sourceDb: "tvdb" }));

      expect(service.get("hashA", "tvdb")?.animeId).toBe("1");
      expect(service.get("hashA", "mal")).toBeNull();
      expect(service.get("hashA")?.animeId).toBe("1");
    } finally {
      sqlite.close();
    }
  });

  test("clear removes all cached entries", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch({ animeId: "1" }));
      matchRepo.set("hashB", makeCachedMatch({ animeId: "2" }));
      manifestRepo.set("/a.mkv", 100, 1000, "hashA");

      service.clear();

      expect(matchRepo.list()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  test("list returns all cached entries ordered by timestamp", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set(
        "hashB",
        makeCachedMatch({ animeId: "2", timestamp: "2026-01-02T00:00:00.000Z" }),
      );
      matchRepo.set(
        "hashA",
        makeCachedMatch({ animeId: "1", timestamp: "2026-01-01T00:00:00.000Z" }),
      );

      const entries = service.list();

      expect(entries).toHaveLength(2);
      expect(entries[0]?.hash).toBe("hashA");
      expect(entries[1]?.hash).toBe("hashB");
    } finally {
      sqlite.close();
    }
  });

  test("purgeStale with empty currentPaths clears everything", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch());
      manifestRepo.set("/a.mkv", 100, 1000, "hashA");

      service.purgeStale([]);

      expect(manifestRepo.getAllPaths()).toHaveLength(0);
      expect(matchRepo.list()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });

  describe("storeMatchFromResult", () => {
    test("converts MatchResult to CachedMatch and stores it", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const matchRepo = new MatchRepository(db);
        const manifestRepo = new ManifestRepository(db);
        const service = new CacheService(matchRepo, manifestRepo);

        const match = makeMatchResult();

        service.storeMatchFromResult("hash123", match, "tvdb");

        const stored = service.get("hash123");
        expect(stored).not.toBeNull();
        expect(stored?.animeId).toBe("1");
        expect(stored?.animeTitle).toBe("Jujutsu Kaisen");
        expect(stored?.episodeId).toBe("101");
        expect(stored?.entryType).toBe("tv");
        expect(stored?.season).toBe(1);
        expect(stored?.episode).toBe(13);
        expect(stored?.title).toBe("Tomorrow");
      } finally {
        sqlite.close();
      }
    });

    test("handles match without episode", () => {
      const { db, sqlite } = createMatchCacheDb();
      try {
        const matchRepo = new MatchRepository(db);
        const manifestRepo = new ManifestRepository(db);
        const service = new CacheService(matchRepo, manifestRepo);

        const match = makeMatchResult({ episode: undefined });

        service.storeMatchFromResult("hash-no-ep", match, "tvdb");

        const stored = service.get("hash-no-ep");
        expect(stored).not.toBeNull();
        expect(stored?.animeId).toBe("1");
        expect(stored?.episodeId).toBeNull();
        expect(stored?.episode).toBeNull();
        expect(stored?.title).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  test("clear also removes manifest entries", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const matchRepo = new MatchRepository(db);
      const manifestRepo = new ManifestRepository(db);
      const service = new CacheService(matchRepo, manifestRepo);

      matchRepo.set("hashA", makeCachedMatch({ animeId: "1" }));
      manifestRepo.set("/a.mkv", 100, 1000, "hashA");
      manifestRepo.set("/b.mkv", 200, 2000, "hashB");

      service.clear();

      expect(matchRepo.list()).toHaveLength(0);
      expect(manifestRepo.getAllPaths()).toHaveLength(0);
    } finally {
      sqlite.close();
    }
  });
});
