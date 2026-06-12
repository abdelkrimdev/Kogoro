import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const anime = sqliteTable(
  "anime",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id").notNull(),
    sourceDb: text("source_db").notNull(),
    title: text("title").notNull(),
    titleJapanese: text("title_japanese"),
    entryType: text("entry_type").notNull().default("tv"),
    episodeCount: integer("episode_count").notNull().default(0),
    coverArtPath: text("cover_art_path"),
    lastSynced: text("last_synced").notNull(),
  },
  (t) => [unique("anime_external_id_source_db_unique").on(t.externalId, t.sourceDb)],
);

export const episodes = sqliteTable(
  "episodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    filePath: text("file_path").notNull(),
    title: text("title"),
    season: integer("season").default(1),
  },
  (t) => [
    unique("episodes_anime_id_episode_number_season_unique").on(
      t.animeId,
      t.episodeNumber,
      t.season,
    ),
  ],
);

export const watchStatus = sqliteTable("watch_status", {
  episodeId: integer("episode_id")
    .primaryKey()
    .references(() => episodes.id, { onDelete: "cascade" }),
  watched: integer("watched", { mode: "boolean" }).notNull().default(false),
  notes: text("notes"),
  updatedAt: text("updated_at").notNull(),
});
