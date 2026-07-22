import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const anime = sqliteTable("anime", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  alternativeTitles: text("alternative_titles", { mode: "json" }).$type<string[]>(),
  episodeCount: integer("episode_count").notNull().default(0),
  coverArtPath: text("cover_art_path"),
  genres: text({ mode: "json" }).$type<string[]>(),
  libraryState: text("library_state").notNull().default("not_on_disk"),
  franchiseId: integer("franchise_id").references(() => franchises.id, { onDelete: "set null" }),
  lastSynced: text("last_synced").notNull(),
  anilistId: text("anilist_id").unique(),
});

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
    notes: text("notes"),
  },
  (t) => [
    unique("episodes_anime_id_episode_number_season_unique").on(
      t.animeId,
      t.episodeNumber,
      t.season,
    ),
  ],
);

export const franchises = sqliteTable("franchises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  anilistId: text("anilist_id").unique(),
  coverArtPath: text("cover_art_path"),
  synopsis: text("synopsis"),
  createdAt: text("created_at").notNull(),
});

export const animeSourceMappings = sqliteTable(
  "anime_source_mappings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
  },
  (t) => [unique("anime_source_mappings_source_external_id").on(t.source, t.externalId)],
);

export const anilistCache = sqliteTable("anilist_cache", {
  anilistId: text("anilist_id").primaryKey(),
  title: text("title").notNull(),
  format: text("format"),
  episodes: integer("episodes"),
  relations: text("relations").notNull(),
  externalLinks: text("external_links"),
  fetchedAt: text("fetched_at").notNull(),
});
