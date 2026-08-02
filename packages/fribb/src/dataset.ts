import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
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

const BASE_URL = "https://raw.githubusercontent.com/Fribb/anime-lists/master";
const ANIME_LIST_URL = `${BASE_URL}/anime-list-full.json`;
const COLLECTION_SOURCES = [
  "anidb",
  "anilist",
  "mal",
  "kitsu",
  "tvdb",
  "animecountdown",
  "animenewsnetwork",
  "anisearch",
  "livechart",
  "simkl",
] as const;

const FRESHNESS_DAYS = 7;

type FetchFn = (url: string | URL, init?: RequestInit) => Promise<Response>;

interface DatasetOptions {
  fetch?: FetchFn;
}

function isFresh(dbPath: string): boolean {
  if (!existsSync(dbPath)) return false;
  const stat = statSync(dbPath);
  const ageMs = Date.now() - stat.mtimeMs;
  const maxAgeMs = FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
  return ageMs <= maxAgeMs;
}

async function downloadJson<T>(url: string, fetchFn: FetchFn): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

function createTables(sqlite: Database): void {
  for (const sql of createSchemaSql()) {
    sqlite.run(sql);
  }
}

function insertEntry(db: ReturnType<typeof drizzle>, raw: FribbRawEntry): void {
  if (raw.anidb_id == null) return;

  const imdbIds = raw.imdb_id ?? [];
  const tmdbMovieIds = raw.themoviedb_id?.movie ?? [];

  db.insert(entries)
    .values({
      anidbId: raw.anidb_id,
      type: raw.type ?? null,
      anilistId: raw.anilist_id ?? null,
      malId: raw.mal_id ?? null,
      kitsuId: raw.kitsu_id ?? null,
      tvdbId: raw.tvdb_id ?? null,
      imdbIds: imdbIds.length > 0 ? imdbIds : null,
      tmdbTvId: raw.themoviedb_id?.tv ?? null,
      tmdbMovieIds: tmdbMovieIds.length > 0 ? tmdbMovieIds : null,
      animecountdownId: raw.animecountdown_id ?? null,
      animenewsnetworkId: raw.animenewsnetwork_id ?? null,
      animePlanetId: raw["anime-planet_id"] ?? null,
      anisearchId: raw.anisearch_id ?? null,
      livechartId: raw.livechart_id ?? null,
      simklId: raw.simkl_id ?? null,
      seasonTvdb: raw.season?.tvdb ?? null,
      seasonTmdb: raw.season?.tmdb ?? null,
      episodeOffsetTvdb: raw.episode_offset?.tvdb ?? null,
      episodeOffsetTmdb: raw.episode_offset?.tmdb ?? null,
    })
    .run();
}

function insertIndexRow(
  db: ReturnType<typeof drizzle>,
  table: SQLiteTable,
  sourceId: number | undefined,
  anidbId: number,
): void {
  if (sourceId == null) return;
  db.insert(table).values({ sourceId, anidbId }).run();
}

function insertCollection(
  db: ReturnType<typeof drizzle>,
  collectionName: string,
  anidbId: number,
): void {
  db.insert(collectionsTable).values({ collectionName, anidbId }).run();
}

function populateDb(
  sqlite: Database,
  animeList: FribbRawEntry[],
  collectionData: Array<{ source: string; collections: FribbRawCollection[] }>,
): void {
  const db = drizzle(sqlite);

  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec("BEGIN TRANSACTION");

  try {
    for (const raw of animeList) {
      insertEntry(db, raw);

      if (raw.anidb_id != null) {
        insertIndexRow(db, idxAnidb, raw.anidb_id, raw.anidb_id);
        insertIndexRow(db, idxAnilist, raw.anilist_id, raw.anidb_id);
        insertIndexRow(db, idxMal, raw.mal_id, raw.anidb_id);
        insertIndexRow(db, idxKitsu, raw.kitsu_id, raw.anidb_id);
        insertIndexRow(db, idxTvdb, raw.tvdb_id, raw.anidb_id);
        insertIndexRow(db, idxAnimecountdown, raw.animecountdown_id, raw.anidb_id);
        insertIndexRow(db, idxAnimenewsnetwork, raw.animenewsnetwork_id, raw.anidb_id);
        insertIndexRow(db, idxAnisearch, raw.anisearch_id, raw.anidb_id);
        insertIndexRow(db, idxLivechart, raw.livechart_id, raw.anidb_id);
        insertIndexRow(db, idxSimkl, raw.simkl_id, raw.anidb_id);
        insertIndexRow(db, idxTmdbTv, raw.themoviedb_id?.tv, raw.anidb_id);
      }
    }

    for (const { source, collections: colls } of collectionData) {
      for (const coll of colls) {
        for (const anidbId of coll.ids) {
          insertCollection(db, `${source}:${coll.name}`, anidbId);
        }
      }
    }

    const now = new Date().toISOString();
    db.insert(meta).values({ key: "dataset_version", value: now }).run();
    db.insert(meta).values({ key: "dataset_date", value: now }).run();
    db.insert(meta)
      .values({
        key: "entry_count",
        value: String(animeList.filter((e) => e.anidb_id != null).length),
      })
      .run();

    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
}

export async function ensureDataset(dir: string, options?: DatasetOptions): Promise<void> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const dbPath = join(dir, "fribb.db");

  if (isFresh(dbPath)) return;

  const tmpPath = `${dbPath}.tmp`;

  try {
    const [animeList, ...collectionResults] = await Promise.all([
      downloadJson<FribbRawEntry[]>(ANIME_LIST_URL, fetchFn),
      ...COLLECTION_SOURCES.map((source) =>
        downloadJson<FribbRawCollection[]>(
          `${BASE_URL}/collections/${source}_collection.json`,
          fetchFn,
        ).then((collections) => ({ source, collections })),
      ),
    ]);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const sqlite = new Database(tmpPath);
    try {
      createTables(sqlite);
      populateDb(sqlite, animeList, collectionResults);
    } finally {
      sqlite.close();
    }

    renameSync(tmpPath, dbPath);
  } catch (error) {
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }

    if (existsSync(dbPath)) return;

    throw new Error(
      `Failed to download Fribb dataset and no cached fribb.db exists: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
