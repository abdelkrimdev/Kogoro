import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { journal, migrations } from "../../drizzle/embedded-migrations";
import { EventRepository } from "../events/event-repository";
import { events as eventsSchema } from "../events/schema";
import { LibraryRepository } from "../library/library-repository";
import { anime, episodeGroups, episodes, groupTrackerMappings } from "../library/schema";
import { MatchRepository } from "../match/match-repository";
import { ScanStateRepository } from "../match/scan-state-repository";
import { matches, scanState } from "../match/schema";

function makeIdempotent(sql: string): string {
  return sql
    .replace(/CREATE TABLE `(\w+)`/g, "CREATE TABLE IF NOT EXISTS `$1`")
    .replace(/CREATE UNIQUE INDEX `(\w+)`/g, "CREATE UNIQUE INDEX IF NOT EXISTS `$1`")
    .replace(/CREATE INDEX `(\w+)`/g, "CREATE INDEX IF NOT EXISTS `$1`");
}

function resolveMigrationsFolder(): string {
  const tmpDir = join(tmpdir(), "kogoro-drizzle");
  mkdirSync(join(tmpDir, "meta"), { recursive: true });
  writeFileSync(join(tmpDir, "meta/_journal.json"), JSON.stringify(journal));
  for (const [tag, sql] of Object.entries(migrations)) {
    writeFileSync(join(tmpDir, `${tag}.sql`), makeIdempotent(sql));
  }
  return tmpDir;
}

const MIGRATIONS_FOLDER = resolveMigrationsFolder();

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
  const db = drizzle(sqlite, { schema: { anime, episodeGroups, episodes, groupTrackerMappings } });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return new LibraryRepository(db);
}

export function createEventsConnection(dbPath: string): EventRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL,
      pushed TEXT NOT NULL DEFAULT '[]'
    )
  `);
  sqlite.run("CREATE INDEX IF NOT EXISTS idx_events_pushed ON events (pushed)");
  const db = drizzle(sqlite, { schema: { events: eventsSchema } });
  return new EventRepository(db);
}
