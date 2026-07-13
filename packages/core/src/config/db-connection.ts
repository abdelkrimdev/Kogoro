import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { journal, migrations } from "../../drizzle/embedded-migrations";
import { EventRepository } from "../events/event-repository";
import { createEventsTable, events as eventsSchema } from "../events/schema";
import { LibraryRepository } from "../library/library-repository";
import {
  anilistCache,
  anime,
  animeTrackerMappings,
  episodeGroups,
  episodes,
  franchises,
  groupTrackerMappings,
} from "../library/schema";
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

function computeRawHash(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

function computeIdempotentHash(sql: string): string {
  return createHash("sha256").update(makeIdempotent(sql)).digest("hex");
}

function isMigrationApplied(applied: Set<string>, sql: string): boolean {
  return applied.has(computeRawHash(sql)) || applied.has(computeIdempotentHash(sql));
}

function getAppliedMigrationHashes(sqlite: Database): Set<string> {
  const rows = sqlite.query("SELECT hash FROM __drizzle_migrations").all() as Array<{
    hash: string;
  }>;
  return new Set(rows.map((r) => r.hash));
}

function recordMigration(sqlite: Database, tag: string, when: number): void {
  const rawSql = migrations[tag];
  if (!rawSql) return;
  const hash = computeIdempotentHash(rawSql);
  sqlite.run("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)", [hash, when]);
}

function isAlreadyAppliedMessage(msg: string): boolean {
  return msg.includes("duplicate column name") || msg.includes("already exists");
}

function isAlreadyAppliedError(err: unknown): boolean {
  if (err instanceof Error) {
    if (isAlreadyAppliedMessage(err.message)) return true;
    if (err.cause instanceof Error && isAlreadyAppliedMessage(err.cause.message)) return true;
  }
  return false;
}

function safeMigrate(db: ReturnType<typeof drizzle>): void {
  try {
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } catch (err) {
    if (!isAlreadyAppliedError(err)) throw err;

    const sqlite = db.$client as Database;
    const applied = getAppliedMigrationHashes(sqlite);
    for (const entry of journal.entries) {
      const rawSql = migrations[entry.tag];
      if (!rawSql) continue;
      if (isMigrationApplied(applied, rawSql)) continue;

      try {
        sqlite.exec(makeIdempotent(rawSql));
      } catch (innerErr) {
        if (!isAlreadyAppliedError(innerErr)) throw innerErr;
      }
      recordMigration(sqlite, entry.tag, entry.when);
    }
  }
}

export interface MatchCacheConnection {
  matchRepo: MatchRepository;
  scanStateRepo: ScanStateRepository;
}

export function createMatchCacheConnection(dbPath: string): MatchCacheConnection {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema: { matches, scanState } });
  safeMigrate(db);
  return {
    matchRepo: new MatchRepository(db),
    scanStateRepo: new ScanStateRepository(db),
  };
}

export function createLibraryConnection(dbPath: string): LibraryRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle(sqlite, {
    schema: {
      anime,
      episodeGroups,
      episodes,
      groupTrackerMappings,
      franchises,
      animeTrackerMappings,
      anilistCache,
    },
  });
  safeMigrate(db);
  return new LibraryRepository(db);
}

export function createEventsConnection(dbPath: string): EventRepository {
  const sqlite = new Database(dbPath);
  sqlite.run("PRAGMA foreign_keys = ON");
  createEventsTable(sqlite);
  const db = drizzle(sqlite, { schema: { events: eventsSchema } });
  return new EventRepository(db);
}
