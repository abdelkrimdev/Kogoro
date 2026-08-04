import { describe, expect, test } from "bun:test";
import { existsSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { ensureDataset } from "./dataset";
import {
  createFribbDb,
  createMockFetch,
  type FetchFn,
  makeRawCollection,
  makeRawEntry,
  mockFailingFetch,
  withTempDir,
} from "./fixtures";
import { entries } from "./schema";

describe("schema", () => {
  test("creates entries table with all source ID columns", () => {
    const { sqlite } = createFribbDb();
    try {
      const tables = sqlite
        .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("entries");
      expect(tableNames).toContain("collections");
      expect(tableNames).toContain("meta");
    } finally {
      sqlite.close();
    }
  });

  test("creates per-source index tables", () => {
    const { sqlite } = createFribbDb();
    try {
      const tables = sqlite
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'idx_%' ORDER BY name",
        )
        .all() as Array<{ name: string }>;
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("idx_anilist");
      expect(tableNames).toContain("idx_mal");
      expect(tableNames).toContain("idx_kitsu");
      expect(tableNames).toContain("idx_tvdb");
      expect(tableNames).toContain("idx_tmdb_tv");
      expect(tableNames).toContain("idx_animecountdown");
      expect(tableNames).toContain("idx_animenewsnetwork");
      expect(tableNames).toContain("idx_anisearch");
      expect(tableNames).toContain("idx_livechart");
      expect(tableNames).toContain("idx_simkl");
    } finally {
      sqlite.close();
    }
  });

  test("entries table stores imdb_ids as JSON text", () => {
    const { db, sqlite } = createFribbDb();
    try {
      db.insert(entries)
        .values({
          anidbId: 1,
          imdbIds: ["tt1234567", "tt7654321"],
        })
        .run();

      const row = sqlite.query("SELECT imdb_ids FROM entries WHERE anidb_id = 1").get() as {
        imdb_ids: string;
      };
      expect(JSON.parse(row.imdb_ids)).toEqual(["tt1234567", "tt7654321"]);
    } finally {
      sqlite.close();
    }
  });

  test("entries table stores tmdb_movie_ids as JSON text", () => {
    const { db, sqlite } = createFribbDb();
    try {
      db.insert(entries)
        .values({
          anidbId: 1,
          tmdbMovieIds: [100, 200],
        })
        .run();

      const row = sqlite.query("SELECT tmdb_movie_ids FROM entries WHERE anidb_id = 1").get() as {
        tmdb_movie_ids: string;
      };
      expect(JSON.parse(row.tmdb_movie_ids)).toEqual([100, 200]);
    } finally {
      sqlite.close();
    }
  });
});

describe("ensureDataset", () => {
  test("downloads and creates fribb.db from raw JSON", async () => {
    await withTempDir("download", async (dir) => {
      const rawEntries = [
        makeRawEntry({ anidb_id: 1, anilist_id: 101, mal_id: 201 }),
        makeRawEntry({ anidb_id: 2, anilist_id: 102, mal_id: 202, tvdb_id: 3002 }),
      ];
      const rawCollections = [makeRawCollection({ name: "Test Series", ids: [1, 2] })];

      const fetchFn = createMockFetch(rawEntries, { anidb: rawCollections });
      await ensureDataset(dir, { fetch: fetchFn });

      const dbPath = join(dir, "fribb.db");
      expect(existsSync(dbPath)).toBe(true);

      const { sqlite } = createFribbDb(dir);
      try {
        const rows = sqlite.query("SELECT * FROM entries ORDER BY anidb_id").all();
        expect(rows).toHaveLength(2);

        const metaRows = sqlite.query("SELECT * FROM meta").all() as Array<{
          key: string;
          value: string;
        }>;
        expect(metaRows.find((m) => m.key === "entry_count")?.value).toBe("2");
      } finally {
        sqlite.close();
      }
    });
  });

  test("populates per-source index tables", async () => {
    await withTempDir("index-tables", async (dir) => {
      const rawEntries = [
        makeRawEntry({ anidb_id: 1, anilist_id: 101, mal_id: 201, tvdb_id: 3001 }),
      ];

      const fetchFn = createMockFetch(rawEntries);
      await ensureDataset(dir, { fetch: fetchFn });

      const { sqlite } = createFribbDb(dir);
      try {
        const anilistRow = sqlite
          .query("SELECT * FROM idx_anilist WHERE source_id = 101")
          .get() as { anidb_id: number };
        expect(anilistRow.anidb_id).toBe(1);

        const malRow = sqlite.query("SELECT * FROM idx_mal WHERE source_id = 201").get() as {
          anidb_id: number;
        };
        expect(malRow.anidb_id).toBe(1);

        const tvdbRow = sqlite.query("SELECT * FROM idx_tvdb WHERE source_id = 3001").get() as {
          anidb_id: number;
        };
        expect(tvdbRow.anidb_id).toBe(1);
      } finally {
        sqlite.close();
      }
    });
  });

  test("populates collections table", async () => {
    await withTempDir("collections", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 }), makeRawEntry({ anidb_id: 2 })];
      const rawCollections = [makeRawCollection({ name: "Gundam", ids: [1, 2] })];

      const fetchFn = createMockFetch(rawEntries, { anidb: rawCollections });
      await ensureDataset(dir, { fetch: fetchFn });

      const { sqlite } = createFribbDb(dir);
      try {
        const rows = sqlite
          .query("SELECT * FROM collections WHERE collection_name = ?")
          .all("anidb:Gundam") as Array<{ anidb_id: number }>;
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.anidb_id).sort()).toEqual([1, 2]);
      } finally {
        sqlite.close();
      }
    });
  });

  test("skips download when fribb.db is fresh", async () => {
    await withTempDir("freshness", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 })];
      const fetchFn = createMockFetch(rawEntries);

      await ensureDataset(dir, { fetch: fetchFn });

      let callCount = 0;
      const countingFetch: FetchFn = async (...args) => {
        callCount++;
        return fetchFn(...args);
      };

      await ensureDataset(dir, { fetch: countingFetch });
      expect(callCount).toBe(0);
    });
  });

  test("re-downloads when fribb.db is older than 7 days", async () => {
    await withTempDir("stale", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 })];
      const fetchFn = createMockFetch(rawEntries);

      await ensureDataset(dir, { fetch: fetchFn });

      const dbPath = join(dir, "fribb.db");
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      utimesSync(dbPath, eightDaysAgo / 1000, eightDaysAgo / 1000);

      let callCount = 0;
      const countingFetch: FetchFn = async (...args) => {
        callCount++;
        return fetchFn(...args);
      };

      await ensureDataset(dir, { fetch: countingFetch });
      expect(callCount).toBeGreaterThan(0);
    });
  });

  test("keeps existing fribb.db on network failure", async () => {
    await withTempDir("network-failure", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 })];
      const fetchFn = createMockFetch(rawEntries);

      await ensureDataset(dir, { fetch: fetchFn });

      const dbPath = join(dir, "fribb.db");
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      utimesSync(dbPath, eightDaysAgo / 1000, eightDaysAgo / 1000);

      await ensureDataset(dir, { fetch: mockFailingFetch() });

      expect(existsSync(dbPath)).toBe(true);
      const { sqlite } = createFribbDb(dir);
      try {
        const rows = sqlite.query("SELECT * FROM entries").all();
        expect(rows).toHaveLength(1);
      } finally {
        sqlite.close();
      }
    });
  });

  test("throws when no cached db exists and download fails", async () => {
    await withTempDir("no-cache-failure", async (dir) => {
      await expect(ensureDataset(dir, { fetch: mockFailingFetch() })).rejects.toThrow(
        "Failed to download Fribb dataset and no cached fribb.db exists",
      );
    });
  });

  test("stores null for missing optional fields", async () => {
    await withTempDir("missing-fields", async (dir) => {
      const rawEntries = [
        makeRawEntry({
          anidb_id: 1,
          anilist_id: undefined,
          mal_id: undefined,
          tvdb_id: undefined,
          imdb_id: undefined,
          themoviedb_id: undefined,
        }),
      ];

      const fetchFn = createMockFetch(rawEntries);
      await ensureDataset(dir, { fetch: fetchFn });

      const { sqlite } = createFribbDb(dir);
      try {
        const row = sqlite.query("SELECT * FROM entries WHERE anidb_id = 1").get() as {
          anilist_id: number | null;
          mal_id: number | null;
          tvdb_id: number | null;
        };
        expect(row.anilist_id).toBeNull();
        expect(row.mal_id).toBeNull();
        expect(row.tvdb_id).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  test("creates db in specified directory", async () => {
    await withTempDir("custom-dir", async (dir) => {
      const rawEntries = [makeRawEntry({ anidb_id: 1 })];
      const fetchFn = createMockFetch(rawEntries);
      await ensureDataset(dir, { fetch: fetchFn });

      expect(existsSync(join(dir, "fribb.db"))).toBe(true);
      expect(existsSync(join(dir, "fribb.db.tmp"))).toBe(false);
    });
  });
});
