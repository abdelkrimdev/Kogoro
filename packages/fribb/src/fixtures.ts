import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import {
  collections as collectionsTable,
  createSchemaSql,
  entries,
  idxAnidb,
  idxAnilist,
  idxAnimecountdown,
  idxAnimenewsnetwork,
  idxAnisearch,
  idxKitsu,
  idxLivechart,
  idxMal,
  idxSimkl,
  idxTmdbTv,
  idxTvdb,
  meta,
} from "./schema";
import type { FribbRawCollection, FribbRawEntry } from "./types";

const SCHEMA_TABLES = {
  entries,
  idxAnidb,
  idxAnilist,
  idxMal,
  idxKitsu,
  idxTvdb,
  idxAnimecountdown,
  idxAnimenewsnetwork,
  idxAnisearch,
  idxLivechart,
  idxSimkl,
  idxTmdbTv,
  collections: collectionsTable,
  meta,
};

export type FribbDbInstance = ReturnType<typeof createFribbDb>;

export function createFribbDb(dir?: string) {
  const path = dir ? `${dir}/fribb.db` : ":memory:";
  const sqlite = new Database(path);
  sqlite.run("PRAGMA foreign_keys = ON");

  for (const sql of createSchemaSql()) {
    sqlite.run(sql);
  }

  const db = drizzle(sqlite, { schema: SCHEMA_TABLES });
  return { db, sqlite };
}

export function makeRawEntry(overrides: Partial<FribbRawEntry> = {}): FribbRawEntry {
  return {
    anidb_id: 1,
    type: "TV",
    anilist_id: 100,
    mal_id: 100,
    kitsu_id: 100,
    tvdb_id: 1000,
    imdb_id: ["tt1234567"],
    themoviedb_id: { tv: 1000, movie: [100] },
    animecountdown_id: 10000,
    animenewsnetwork_id: 1000,
    "anime-planet_id": "test-anime",
    anisearch_id: 1000,
    livechart_id: 1000,
    simkl_id: 10000,
    season: { tvdb: 1, tmdb: 1 },
    episode_offset: { tvdb: 0, tmdb: 0 },
    ...overrides,
  };
}

export function makeRawCollection(overrides: Partial<FribbRawCollection> = {}): FribbRawCollection {
  return {
    name: "Test Franchise",
    ids: [1, 2, 3],
    ...overrides,
  };
}

export type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

export function createMockFetch(
  animeList: unknown[],
  collections: Record<string, unknown[]> = {},
): FetchFn {
  return async (url: string | URL) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    if (urlStr.includes("anime-list-full.json")) {
      return new Response(JSON.stringify(animeList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (urlStr.includes("_collection.json")) {
      for (const [source, data] of Object.entries(collections)) {
        if (urlStr.includes(`${source}_collection.json`)) {
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  };
}

export function mockFailingFetch(): FetchFn {
  return async () => {
    throw new Error("Network error");
  };
}

export async function withTempDir(
  label: string,
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), `kogoro-fribb-test-${label}-`));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
