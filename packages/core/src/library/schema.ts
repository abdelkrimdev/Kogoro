import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import { integer, real, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";
import type { EventRepository } from "../events/event-repository";
import { AnimeRepository } from "./anime-repository";
import { EpisodeRepository } from "./episode-repository";
import { FranchiseRepository } from "./franchise-repository";
import { GroupRepository } from "./group-repository";

export const anime = sqliteTable("anime", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  alternativeTitles: text("alternative_titles", { mode: "json" }).$type<string[]>(),
  coverArtPath: text("cover_art_path"),
  franchiseId: integer("franchise_id").references(() => franchises.id, { onDelete: "set null" }),
  anidbId: text("anidb_id").unique(),
  format: text("format"),
  updatedAt: text("updated_at").notNull(),
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
    updatedAt: text("updated_at").notNull(),
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
    groupId: integer("group_id")
      .notNull()
      .references(() => episodeGroups.id, { onDelete: "cascade" }),
    episodeNumber: integer("episode_number").notNull(),
    filePath: text("file_path").notNull(),
    title: text("title"),
    watched: integer("watched", { mode: "boolean" }).notNull().default(false),
    notes: text("notes"),
  },
  (t) => [unique("episodes_group_id_episode_number_unique").on(t.groupId, t.episodeNumber)],
);

export const franchises = sqliteTable("franchises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  coverArtPath: text("cover_art_path"),
  synopsis: text("synopsis"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const animeSourceMappings = sqliteTable(
  "anime_source_mappings",
  {
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    externalId: text("external_id").notNull(),
  },
  (t) => [unique("anime_source_mappings_anime_id_source").on(t.animeId, t.source)],
);

type LibrarySchema = {
  anime: typeof anime;
  episodeGroups: typeof episodeGroups;
  episodes: typeof episodes;
  groupTrackerMappings: typeof groupTrackerMappings;
  franchises: typeof franchises;
  animeSourceMappings: typeof animeSourceMappings;
};
export type LibraryDb = BaseSQLiteDatabase<"sync", void, LibrarySchema>;

export function createLibraryRepos(
  db: LibraryDb,
  events?: EventRepository,
): {
  animeRepo: AnimeRepository;
  episodeRepo: EpisodeRepository;
  groupRepo: GroupRepository;
  franchiseRepo: FranchiseRepository;
} {
  const createTransactionRepos = (txDb: LibraryDb) => ({
    anime: new AnimeRepository({ db: txDb }),
    episodes: new EpisodeRepository({ db: txDb, events }),
    groups: new GroupRepository({ db: txDb, events }),
  });

  return {
    animeRepo: new AnimeRepository({ db, createTransactionRepos }),
    episodeRepo: new EpisodeRepository({ db, events }),
    groupRepo: new GroupRepository({ db, events }),
    franchiseRepo: new FranchiseRepository({ db }),
  };
}
