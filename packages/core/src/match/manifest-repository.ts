import { eq, inArray, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { manifest } from "./schema";

export interface ManifestEntry {
  size: number;
  mtime: number;
  hash: string;
}

type ManifestSchema = { manifest: typeof manifest };
type ManifestDb = BunSQLiteDatabase<ManifestSchema>;

export class ManifestRepository {
  constructor(private db: ManifestDb) {}

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn);
  }

  get(path: string): ManifestEntry | null {
    const row = this.db.select().from(manifest).where(eq(manifest.path, path)).get();
    return row ? { size: row.size, mtime: row.mtime, hash: row.hash } : null;
  }

  getBatch(paths: string[]): Map<string, ManifestEntry> {
    const result = new Map<string, ManifestEntry>();
    if (paths.length === 0) return result;
    const rows = this.db.select().from(manifest).where(inArray(manifest.path, paths)).all();
    for (const row of rows) {
      result.set(row.path, { size: row.size, mtime: row.mtime, hash: row.hash });
    }
    return result;
  }

  getAllPaths(): string[] {
    return this.db
      .select({ path: manifest.path })
      .from(manifest)
      .all()
      .map((r) => r.path);
  }

  getAllHashes(): string[] {
    return this.db
      .select({ hash: manifest.hash })
      .from(manifest)
      .where(sql`${manifest.hash} != ''`)
      .all()
      .map((r) => r.hash);
  }

  set(path: string, size: number, mtime: number, hash: string): void {
    this.db
      .insert(manifest)
      .values({ path, size, mtime, hash })
      .onConflictDoUpdate({ target: manifest.path, set: { size, mtime, hash } })
      .run();
  }

  delete(path: string): void {
    this.db.delete(manifest).where(eq(manifest.path, path)).run();
  }

  deleteBatch(paths: string[]): void {
    if (paths.length === 0) return;
    this.db.delete(manifest).where(inArray(manifest.path, paths)).run();
  }

  deleteAll(): void {
    this.db.delete(manifest).run();
  }
}
