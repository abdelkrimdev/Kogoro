import { index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  anidbId: integer("anidb_id").primaryKey(),
  type: text("type"),
  anilistId: integer("anilist_id"),
  malId: integer("mal_id"),
  kitsuId: integer("kitsu_id"),
  tvdbId: integer("tvdb_id"),
  imdbIds: text("imdb_ids", { mode: "json" }).$type<string[]>(),
  tmdbTvId: integer("tmdb_tv_id"),
  tmdbMovieIds: text("tmdb_movie_ids", { mode: "json" }).$type<number[]>(),
  animecountdownId: integer("animecountdown_id"),
  animenewsnetworkId: integer("animenewsnetwork_id"),
  animePlanetId: text("anime_planet_id"),
  anisearchId: integer("anisearch_id"),
  livechartId: integer("livechart_id"),
  simklId: integer("simkl_id"),
  seasonTvdb: integer("season_tvdb"),
  seasonTmdb: integer("season_tmdb"),
  episodeOffsetTvdb: integer("episode_offset_tvdb"),
  episodeOffsetTmdb: integer("episode_offset_tmdb"),
});

export const idxAnilist = sqliteTable(
  "idx_anilist",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_anilist_source_id").on(t.sourceId)],
);

export const idxMal = sqliteTable(
  "idx_mal",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_mal_source_id").on(t.sourceId)],
);

export const idxKitsu = sqliteTable(
  "idx_kitsu",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_kitsu_source_id").on(t.sourceId)],
);

export const idxTvdb = sqliteTable(
  "idx_tvdb",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_tvdb_source_id").on(t.sourceId)],
);

export const idxAnimecountdown = sqliteTable(
  "idx_animecountdown",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_animecountdown_source_id").on(t.sourceId)],
);

export const idxAnimenewsnetwork = sqliteTable(
  "idx_animenewsnetwork",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_animenewsnetwork_source_id").on(t.sourceId)],
);

export const idxAnisearch = sqliteTable(
  "idx_anisearch",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_anisearch_source_id").on(t.sourceId)],
);

export const idxLivechart = sqliteTable(
  "idx_livechart",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_livechart_source_id").on(t.sourceId)],
);

export const idxSimkl = sqliteTable(
  "idx_simkl",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_simkl_source_id").on(t.sourceId)],
);

export const idxTmdbTv = sqliteTable(
  "idx_tmdb_tv",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_tmdb_tv_source_id").on(t.sourceId)],
);

export const idxAnidb = sqliteTable(
  "idx_anidb",
  {
    sourceId: integer("source_id").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [index("idx_anidb_source_id").on(t.sourceId)],
);

export const collections = sqliteTable(
  "collections",
  {
    collectionName: text("collection_name").notNull(),
    anidbId: integer("anidb_id")
      .notNull()
      .references(() => entries.anidbId, { onDelete: "cascade" }),
  },
  (t) => [
    index("idx_collections_anidb_id").on(t.anidbId),
    unique("idx_collections_name_anidb_id_unique").on(t.collectionName, t.anidbId),
  ],
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

const INDEX_TABLES = [
  "idx_anidb",
  "idx_anilist",
  "idx_mal",
  "idx_kitsu",
  "idx_tvdb",
  "idx_animecountdown",
  "idx_animenewsnetwork",
  "idx_anisearch",
  "idx_livechart",
  "idx_simkl",
  "idx_tmdb_tv",
];

export function createSchemaSql(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS entries (
      anidb_id INTEGER PRIMARY KEY,
      type TEXT,
      anilist_id INTEGER,
      mal_id INTEGER,
      kitsu_id INTEGER,
      tvdb_id INTEGER,
      imdb_ids TEXT,
      tmdb_tv_id INTEGER,
      tmdb_movie_ids TEXT,
      animecountdown_id INTEGER,
      animenewsnetwork_id INTEGER,
      anime_planet_id TEXT,
      anisearch_id INTEGER,
      livechart_id INTEGER,
      simkl_id INTEGER,
      season_tvdb INTEGER,
      season_tmdb INTEGER,
      episode_offset_tvdb INTEGER,
      episode_offset_tmdb INTEGER
    )`,
    ...INDEX_TABLES.flatMap((name) => [
      `CREATE TABLE IF NOT EXISTS ${name} (
        source_id INTEGER NOT NULL,
        anidb_id INTEGER NOT NULL REFERENCES entries(anidb_id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS ${name}_source_id_idx ON ${name}(source_id)`,
    ]),
    `CREATE TABLE IF NOT EXISTS collections (
      collection_name TEXT NOT NULL,
      anidb_id INTEGER NOT NULL REFERENCES entries(anidb_id) ON DELETE CASCADE,
      UNIQUE(collection_name, anidb_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_collections_anidb_id ON collections(anidb_id)`,
    `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ];
}
