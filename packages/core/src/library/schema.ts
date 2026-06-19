import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const anime = sqliteTable(
  "anime",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    externalId: text("external_id").notNull(),
    sourceDb: text("source_db").notNull(),
    title: text("title").notNull(),
    titleJapanese: text("title_japanese"),
    episodeCount: integer("episode_count").notNull().default(0),
    coverArtPath: text("cover_art_path"),
    genres: text({ mode: "json" }).$type<string[]>(),
    libraryState: text("library_state").notNull().default("not_on_disk"),
    lastSynced: text("last_synced").notNull(),
  },
  (t) => [unique("anime_external_id_source_db_unique").on(t.externalId, t.sourceDb)],
);

export const episodeGroups = sqliteTable(
  "episode_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    entryType: text("entry_type").notNull(),
    seasonNumber: integer("season_number"),
    watchStatus: text("watch_status").notNull().default("plan_to_watch"),
    synopsis: text("synopsis"),
    rating: real("rating"),
    coverArtPath: text("cover_art_path"),
    lastSynced: text("last_synced").notNull(),
  },
  (t) => [
    unique("episode_groups_anime_id_entry_type_season_number_unique").on(
      t.animeId,
      t.entryType,
      t.seasonNumber,
    ),
  ],
);

export const groupTrackerMappings = sqliteTable(
  "group_tracker_mappings",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => episodeGroups.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
  },
  (t) => [unique("group_tracker_mappings_source_external_id_unique").on(t.source, t.externalId)],
);

export const episodes = sqliteTable(
  "episodes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    groupId: integer("group_id")
      .notNull()
      .references(() => episodeGroups.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    filePath: text("file_path").notNull(),
    title: text("title"),
    season: integer("season").default(1),
    watched: integer("watched", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    unique("episodes_anime_id_episode_number_season_unique").on(
      t.animeId,
      t.episodeNumber,
      t.season,
    ),
  ],
);
