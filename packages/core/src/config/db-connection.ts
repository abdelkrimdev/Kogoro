import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { LibraryRepository } from "../library/library-repository";
import { anime, episodes, watchStatus } from "../library/schema";
import { MatchRepository } from "../match/match-repository";
import { ScanStateRepository } from "../match/scan-state-repository";
import { matches, scanState } from "../match/schema";

const MIGRATIONS_FOLDER = join(import.meta.dir, "../../drizzle");

export interface MatchCacheConnection {
  matchRepo: MatchRepository;
  scanStateRepo: ScanStateRepository;
}

export function createMatchCacheConnection(dbPath: string): MatchCacheConnection {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema: { matches, scanState } });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    matchRepo: new MatchRepository(db),
    scanStateRepo: new ScanStateRepository(db),
  };
}

export function createLibraryConnection(dbPath: string): LibraryRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, { schema: { anime, episodes, watchStatus } });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return new LibraryRepository(db);
}
