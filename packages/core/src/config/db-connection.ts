import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { journal, migrations } from "../../drizzle/embedded-migrations";
import { LibraryRepository } from "../library/library-repository";
import { anime, episodes, watchStatus } from "../library/schema";
import { MatchRepository } from "../match/match-repository";
import { ScanStateRepository } from "../match/scan-state-repository";
import { matches, scanState } from "../match/schema";

function resolveMigrationsFolder(): string {
  const diskPath = join(import.meta.dir, "../../drizzle");
  if (existsSync(join(diskPath, "meta/_journal.json"))) {
    return diskPath;
  }

  const tmpDir = join(tmpdir(), "kogoro-drizzle");
  const journalPath = join(tmpDir, "meta/_journal.json");
  if (!existsSync(journalPath)) {
    mkdirSync(join(tmpDir, "meta"), { recursive: true });
    writeFileSync(journalPath, JSON.stringify(journal));
    for (const [tag, sql] of Object.entries(migrations)) {
      writeFileSync(join(tmpDir, `${tag}.sql`), sql);
    }
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
  const db = drizzle(sqlite, { schema: { anime, episodes, watchStatus } });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return new LibraryRepository(db);
}
