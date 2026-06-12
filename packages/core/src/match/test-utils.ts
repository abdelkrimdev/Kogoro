import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { matches, scanState } from "./schema";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

export type MatchCacheDb = ReturnType<typeof createMatchCacheDb>;

export function createMatchCacheDb(dir?: string) {
  const path = dir ? `${dir}/cache.db` : ":memory:";
  const sqlite = new Database(path);
  const db = drizzle(sqlite, { schema: { matches, scanState } });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db, sqlite };
}
