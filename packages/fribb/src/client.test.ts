import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { FranchiseIndex, IdentityResolverEntry } from "@kogoro/core";
import { createFribbConnection } from "./client";
import { createFribbDb, withTempDir } from "./fixtures";
import { collections, entries, idxAnilist, idxMal, idxTmdbTv, meta } from "./schema";

describe("FribbClient", () => {
  test("createFribbConnection opens database and returns client implementing both interfaces", async () => {
    await withTempDir("client-open", async (dir) => {
      const dbPath = join(dir, "fribb.db");
      // create a minimal database
      const { sqlite } = createFribbDb(dir);
      sqlite.close();

      const client = createFribbConnection(dbPath);
      expect(client).toBeDefined();
      expect(typeof client.resolveToAnidb).toBe("function");
      expect(typeof client.resolveBatchToAnidb).toBe("function");
      expect(typeof client.getMetadata).toBe("function");
      expect(typeof client.getCollectionForAnidb).toBe("function");
      expect(typeof client.getAllCollections).toBe("function");
    });
  });

  describe("IdentityResolver", () => {
    test("returns anidb_id for known anilist source", async () => {
      await withTempDir("resolve-anilist", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        // insert entry
        db.insert(entries).values({ anidbId: 123, anilistId: 456 }).run();
        db.insert(idxAnilist).values({ sourceId: 456, anidbId: 123 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const result = await client.resolveToAnidb("anilist", "456");
        expect(result).toBe("123");
      });
    });

    test("returns null for unknown source ID", async () => {
      await withTempDir("resolve-unknown", async (dir) => {
        const { sqlite } = createFribbDb(dir);
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const result = await client.resolveToAnidb("mal", "99999");
        expect(result).toBeNull();
      });
    });

    test("handles tmdb source via idx_tmdb_tv", async () => {
      await withTempDir("resolve-tmdb", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(entries).values({ anidbId: 789, tmdbTvId: 1011 }).run();
        db.insert(idxTmdbTv).values({ sourceId: 1011, anidbId: 789 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const result = await client.resolveToAnidb("tmdb", "1011");
        expect(result).toBe("789");
      });
    });

    test("handles imdb source via entries table", async () => {
      await withTempDir("resolve-imdb", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(entries)
          .values({ anidbId: 321, imdbIds: ["tt1234567", "tt7654321"] })
          .run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const result = await client.resolveToAnidb("imdb", "tt1234567");
        expect(result).toBe("321");
      });
    });

    test("resolves multiple entries", async () => {
      await withTempDir("batch-resolve", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(entries).values({ anidbId: 1, anilistId: 10 }).run();
        db.insert(entries).values({ anidbId: 2, malId: 20 }).run();
        db.insert(idxAnilist).values({ sourceId: 10, anidbId: 1 }).run();
        db.insert(idxMal).values({ sourceId: 20, anidbId: 2 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const entriesToResolve: IdentityResolverEntry[] = [
          { source: "anilist", sourceId: "10" },
          { source: "mal", sourceId: "20" },
          { source: "kitsu", sourceId: "999" },
        ];
        const results = await client.resolveBatchToAnidb(entriesToResolve);
        expect(results).toHaveLength(3);
        expect(results[0]).toEqual({ source: "anilist", sourceId: "10", anidbId: "1" });
        expect(results[1]).toEqual({ source: "mal", sourceId: "20", anidbId: "2" });
        expect(results[2]).toEqual({ source: "kitsu", sourceId: "999", anidbId: null });
      });
    });

    test("returns dataset info", async () => {
      await withTempDir("metadata", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(meta).values({ key: "dataset_version", value: "2026-01-01" }).run();
        db.insert(meta).values({ key: "dataset_date", value: "2026-01-02" }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const metadata = await client.getMetadata();
        expect(metadata.datasetVersion).toBe("2026-01-01");
        expect(metadata.datasetDate).toBe("2026-01-02");
        expect(metadata.supportedSources).toContain("anidb");
        expect(metadata.supportedSources).toContain("anilist");
        expect(metadata.supportedSources).toContain("imdb");
      });
    });
  });

  describe("FranchiseIndex", () => {
    test("returns collection for known anidb_id", async () => {
      await withTempDir("collection-known", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(entries).values({ anidbId: 1 }).run();
        db.insert(entries).values({ anidbId: 2 }).run();
        db.insert(collections).values({ collectionName: "anidb:Gundam", anidbId: 1 }).run();
        db.insert(collections).values({ collectionName: "anidb:Gundam", anidbId: 2 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const collection = await client.getCollectionForAnidb("1");
        expect(collection).not.toBeNull();
        expect(collection?.franchiseTitle).toBe("Gundam");
        expect(collection?.members).toContain("1");
        expect(collection?.members).toContain("2");
      });
    });

    test("returns null for unknown anidb_id", async () => {
      await withTempDir("collection-unknown", async (dir) => {
        const { sqlite } = createFribbDb(dir);
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const collection = await client.getCollectionForAnidb("999");
        expect(collection).toBeNull();
      });
    });

    test("returns all collections", async () => {
      await withTempDir("all-collections", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(entries).values({ anidbId: 1 }).run();
        db.insert(entries).values({ anidbId: 2 }).run();
        db.insert(entries).values({ anidbId: 3 }).run();
        db.insert(collections).values({ collectionName: "anidb:Gundam", anidbId: 1 }).run();
        db.insert(collections).values({ collectionName: "anidb:Gundam", anidbId: 2 }).run();
        db.insert(collections).values({ collectionName: "mal:Naruto", anidbId: 3 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const allCollections = await client.getAllCollections();
        expect(allCollections).toHaveLength(2);
        const gundam = allCollections.find((c) => c.franchiseTitle === "Gundam");
        expect(gundam).toBeDefined();
        expect(gundam?.members).toHaveLength(2);
        const naruto = allCollections.find((c) => c.franchiseTitle === "Naruto");
        expect(naruto).toBeDefined();
        expect(naruto?.members).toHaveLength(1);
      });
    });

    test("returns index info", async () => {
      await withTempDir("index-metadata", async (dir) => {
        const { db, sqlite } = createFribbDb(dir);
        db.insert(meta).values({ key: "dataset_version", value: "2026-01-01" }).run();
        db.insert(meta).values({ key: "dataset_date", value: "2026-01-02" }).run();
        db.insert(entries).values({ anidbId: 1 }).run();
        db.insert(collections).values({ collectionName: "test", anidbId: 1 }).run();
        sqlite.close();

        const client = createFribbConnection(join(dir, "fribb.db"));
        const metadata = await (client as FranchiseIndex).getMetadata();
        expect(metadata.datasetVersion).toBe("2026-01-01");
        expect(metadata.datasetDate).toBe("2026-01-02");
        expect(metadata.collectionCount).toBe(1);
      });
    });
  });
});
