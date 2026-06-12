import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const matches = sqliteTable("matches", {
  hash: text("hash").primaryKey(),
  animeId: text("anime_id").notNull(),
  animeTitle: text("anime_title"),
  episodeId: text("episode_id"),
  entryType: text("entry_type").notNull(),
  season: integer("season"),
  episode: integer("episode"),
  title: text("title"),
  sourceDb: text("source_db").notNull().default("tvdb"),
  timestamp: text("timestamp").notNull(),
});

export const scanState = sqliteTable("scan_state", {
  path: text("path").primaryKey(),
  size: integer("size").notNull(),
  mtime: integer("mtime").notNull(),
  hash: text("hash").notNull().default(""),
});
