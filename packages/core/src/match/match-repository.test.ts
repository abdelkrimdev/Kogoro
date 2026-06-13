import { describe, expect, test } from "bun:test";
import { makeCachedMatch } from "../fixtures";
import { MatchRepository } from "./match-repository";
import { createMatchCacheDb } from "./test-utils";

describe("MatchRepository", () => {
  test("set stores a match and get retrieves it", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      const match = makeCachedMatch({
        animeTitle: "Test",
        episodeId: "101",
        season: 1,
        episode: 5,
        title: "Test Episode",
      });
      repo.set("abc123", match);
      const result = repo.get("abc123");
      expect(result).toEqual(match);
    } finally {
      sqlite.close();
    }
  });

  test("get returns null for missing key", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      expect(repo.get("nonexistent")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("has returns true for existing key and false for missing", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      expect(repo.has("abc")).toBe(false);
      repo.set("abc", makeCachedMatch({ entryType: "movie" }));
      expect(repo.has("abc")).toBe(true);
    } finally {
      sqlite.close();
    }
  });

  test("clear removes all entries", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      repo.set("a", makeCachedMatch({ timestamp: "2026-01-01T00:00:00.000Z" }));
      repo.set(
        "b",
        makeCachedMatch({
          animeId: "2",
          entryType: "movie",
          timestamp: "2026-01-02T00:00:00.000Z",
        }),
      );
      repo.clear();
      expect(repo.has("a")).toBe(false);
      expect(repo.has("b")).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  test("getByHashAndSourceDb returns match only when both hash and sourceDb match", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      repo.set("hashA", makeCachedMatch({ animeId: "1", sourceDb: "tvdb" }));
      repo.set("hashB", makeCachedMatch({ animeId: "2", sourceDb: "mal" }));

      expect(repo.getByHashAndSourceDb("hashA", "tvdb")?.animeId).toBe("1");
      expect(repo.getByHashAndSourceDb("hashA", "mal")).toBeNull();
      expect(repo.getByHashAndSourceDb("hashB", "mal")?.animeId).toBe("2");
      expect(repo.getByHashAndSourceDb("hashB", "tvdb")).toBeNull();
      expect(repo.getByHashAndSourceDb("hashC", "tvdb")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("list returns all entries ordered by timestamp", () => {
    const { db, sqlite } = createMatchCacheDb();
    try {
      const repo = new MatchRepository(db);
      repo.set("a", makeCachedMatch({ timestamp: "2026-01-01T00:00:00.000Z" }));
      repo.set(
        "b",
        makeCachedMatch({
          animeId: "2",
          entryType: "movie",
          timestamp: "2026-01-03T00:00:00.000Z",
        }),
      );
      repo.set(
        "c",
        makeCachedMatch({ animeId: "3", entryType: "ova", timestamp: "2026-01-02T00:00:00.000Z" }),
      );
      const entries = repo.list();
      expect(entries).toHaveLength(3);
      expect(entries[0]?.hash).toBe("a");
      expect(entries[1]?.hash).toBe("c");
      expect(entries[2]?.hash).toBe("b");
    } finally {
      sqlite.close();
    }
  });
});
