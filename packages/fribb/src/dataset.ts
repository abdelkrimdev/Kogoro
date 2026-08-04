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

function populateDb(
  sqlite: Database,
  animeList: FribbRawEntry[],
  collectionData: Array<{ source: string; collections: FribbRawCollection[] }>,
): void {
  const db = drizzle({ client: sqlite });

  db.transaction((tx) => {
    for (const raw of animeList) {
      if (raw.anidb_id == null) continue;

      const imdbIds = raw.imdb_id ?? [];
      const tmdbMovieIds = raw.themoviedb_id?.movie ?? [];

      tx.insert(entries)
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

      const indexRows: Array<{ table: SQLiteTable; sourceId: number | undefined }> = [
        { table: idxAnidb, sourceId: raw.anidb_id },
        { table: idxAnilist, sourceId: raw.anilist_id },
        { table: idxMal, sourceId: raw.mal_id },
        { table: idxKitsu, sourceId: raw.kitsu_id },
        { table: idxTvdb, sourceId: raw.tvdb_id },
        { table: idxAnimecountdown, sourceId: raw.animecountdown_id },
        { table: idxAnimenewsnetwork, sourceId: raw.animenewsnetwork_id },
        { table: idxAnisearch, sourceId: raw.anisearch_id },
        { table: idxLivechart, sourceId: raw.livechart_id },
        { table: idxSimkl, sourceId: raw.simkl_id },
        { table: idxTmdbTv, sourceId: raw.themoviedb_id?.tv },
      ];

      for (const { table, sourceId } of indexRows) {
        if (sourceId != null) {
          tx.insert(table).values({ sourceId, anidbId: raw.anidb_id }).run();
        }
      }
    }

    for (const { source, collections: colls } of collectionData) {
      for (const coll of colls) {
        for (const anidbId of coll.ids) {
          tx.insert(collectionsTable)
            .values({ collectionName: `${source}:${coll.name}`, anidbId })
            .run();
        }
      }
    }

    const now = new Date().toISOString();
    tx.insert(meta).values({ key: "dataset_version", value: now }).run();
    tx.insert(meta).values({ key: "dataset_date", value: now }).run();
    tx.insert(meta)
      .values({
        key: "entry_count",
        value: String(animeList.filter((e) => e.anidb_id != null).length),
      })
      .run();
  });
}

export async function ensureDataset(dir: string, options?: DatasetOptions): Promise<void> {
  const fetchFn = options?.fetch ?? globalThis.fetch;
  const dbPath = join(dir, "fribb.db");

  if (isFresh(dbPath)) return;

  const tmpPath = `${dbPath}.tmp`;

  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const [animeList, ...collectionResults] = await Promise.all([
      downloadJson<FribbRawEntry[]>(ANIME_LIST_URL, fetchFn),
      ...COLLECTION_SOURCES.map((source) =>
        downloadJson<FribbRawCollection[]>(
          `${BASE_URL}/collections/${source}_collection.json`,
          fetchFn,
        ).then((collections) => ({ source, collections })),
      ),
    ]);

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
