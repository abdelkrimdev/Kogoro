import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import {
  anilistCache,
  anime,
  animeSourceMappings,
  animeTrackerMappings,
  episodeGroups,
  episodes,
  franchises,
  groupTrackerMappings,
} from "./schema";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

export type LibraryDbInstance = ReturnType<typeof createLibraryDb>;

export function createLibraryDb(dir?: string) {
  const path = dir ? `${dir}/library.db` : ":memory:";
  const sqlite = new Database(path);
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, {
    schema: {
      anime,
      episodeGroups,
      episodes,
      groupTrackerMappings,
      franchises,
      animeTrackerMappings,
      animeSourceMappings,
      anilistCache,
    },
  });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite };
}
