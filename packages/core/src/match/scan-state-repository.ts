import { eq, inArray, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { scanState } from "./schema";

export interface ScanStateEntry {
  size: number;
  mtime: number;
  hash: string;
}

type ScanStateSchema = { scanState: typeof scanState };
type ScanStateDb = BunSQLiteDatabase<ScanStateSchema>;

export class ScanStateRepository {
  constructor(private db: ScanStateDb) {}

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn);
  }

  get(path: string): ScanStateEntry | null {
    const row = this.db.select().from(scanState).where(eq(scanState.path, path)).get();
    return row ? { size: row.size, mtime: row.mtime, hash: row.hash } : null;
  }

  getBatch(paths: string[]): Map<string, ScanStateEntry> {
    const result = new Map<string, ScanStateEntry>();
    if (paths.length === 0) return result;
    const rows = this.db.select().from(scanState).where(inArray(scanState.path, paths)).all();
    for (const row of rows) {
      result.set(row.path, { size: row.size, mtime: row.mtime, hash: row.hash });
    }
    return result;
  }

  getAllPaths(): string[] {
    return this.db
      .select({ path: scanState.path })
      .from(scanState)
      .all()
      .map((r) => r.path);
  }

  getAllHashes(): string[] {
    return this.db
      .select({ hash: scanState.hash })
      .from(scanState)
      .where(sql`${scanState.hash} != ''`)
      .all()
      .map((r) => r.hash);
  }

  set(path: string, size: number, mtime: number, hash: string): void {
    this.db
      .insert(scanState)
      .values({ path, size, mtime, hash })
      .onConflictDoUpdate({ target: scanState.path, set: { size, mtime, hash } })
      .run();
  }

  delete(path: string): void {
    this.db.delete(scanState).where(eq(scanState.path, path)).run();
  }

  deleteBatch(paths: string[]): void {
    if (paths.length === 0) return;
    this.db.delete(scanState).where(inArray(scanState.path, paths)).run();
  }

  deleteAll(): void {
    this.db.delete(scanState).run();
  }
}
