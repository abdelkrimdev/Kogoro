import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_DIR } from "../config/schema";

export interface CachedMatch {
  animeId: string;
  animeTitle?: string;
  episodeId: string | null;
  entryType: string;
  season: number | null;
  episode: number | null;
  title: string | null;
  timestamp: string;
}

export interface ScanStateEntry {
  size: number;
  mtime: number;
  hash: string;
}

interface MatchCacheOptions {
  dbPath?: string;
}

interface MatchRow {
  anime_id: string;
  anime_title: string | null;
  episode_id: string | null;
  entry_type: string;
  season: number | null;
  episode: number | null;
  title: string | null;
  timestamp: string;
}

export class MatchCache {
  private db: Database;

  constructor(options: MatchCacheOptions = {}) {
    const dbPath = options.dbPath ?? join(CONFIG_DIR, "cache.db");
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        hash TEXT PRIMARY KEY,
        anime_id TEXT NOT NULL,
        anime_title TEXT,
        episode_id TEXT,
        entry_type TEXT NOT NULL,
        season INTEGER,
        episode INTEGER,
        title TEXT,
        timestamp TEXT NOT NULL
      )
    `);
    try {
      this.db.run("ALTER TABLE matches ADD COLUMN anime_title TEXT");
    } catch {
      // Column already exists in newer tables
    }
    this.db.run(`
      CREATE TABLE IF NOT EXISTS scan_state (
        path TEXT PRIMARY KEY,
        size INTEGER NOT NULL,
        mtime INTEGER NOT NULL,
        hash TEXT NOT NULL DEFAULT ''
      )
    `);
  }

  set(hash: string, match: CachedMatch): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO matches (hash, anime_id, anime_title, episode_id, entry_type, season, episode, title, timestamp)
      VALUES ($hash, $animeId, $animeTitle, $episodeId, $entryType, $season, $episode, $title, $timestamp)
    `);
    stmt.run({
      $hash: hash,
      $animeId: match.animeId,
      $animeTitle: match.animeTitle ?? null,
      $episodeId: match.episodeId,
      $entryType: match.entryType,
      $season: match.season,
      $episode: match.episode,
      $title: match.title,
      $timestamp: match.timestamp,
    });
  }

  get(hash: string): CachedMatch | null {
    const stmt = this.db.prepare(`
      SELECT anime_id, anime_title, episode_id, entry_type, season, episode, title, timestamp
      FROM matches WHERE hash = $hash
    `);
    const row = stmt.get({ $hash: hash }) as MatchRow | null;
    return row ? this.rowToMatch(row) : null;
  }

  has(hash: string): boolean {
    const stmt = this.db.prepare("SELECT 1 FROM matches WHERE hash = $hash");
    const row = stmt.get({ $hash: hash });
    return row !== null;
  }

  list(): Array<{ hash: string; match: CachedMatch }> {
    const stmt = this.db.prepare(`
      SELECT hash, anime_id, anime_title, episode_id, entry_type, season, episode, title, timestamp
      FROM matches ORDER BY timestamp
    `);
    const rows = stmt.all() as Array<MatchRow & { hash: string }>;
    return rows.map((row) => ({
      hash: row.hash,
      match: this.rowToMatch(row),
    }));
  }

  private rowToMatch(row: MatchRow): CachedMatch {
    return {
      animeId: row.anime_id,
      animeTitle: row.anime_title ?? undefined,
      episodeId: row.episode_id,
      entryType: row.entry_type,
      season: row.season,
      episode: row.episode,
      title: row.title,
      timestamp: row.timestamp,
    };
  }

  clear(): void {
    this.db.run("DELETE FROM matches");
  }

  static async hashFile(filePath: string): Promise<string> {
    const file = Bun.file(filePath);
    const buffer = await file.arrayBuffer();
    const hash = new Bun.CryptoHasher("sha256");
    hash.update(new Uint8Array(buffer));
    return hash.digest("hex");
  }

  getScanState(path: string): ScanStateEntry | null {
    const stmt = this.db.prepare("SELECT size, mtime, hash FROM scan_state WHERE path = $path");
    const row = stmt.get({ $path: path }) as ScanStateEntry | null;
    return row ? { size: row.size, mtime: row.mtime, hash: row.hash } : null;
  }

  getScanStateBatch(paths: string[]): Map<string, ScanStateEntry> {
    const result = new Map<string, ScanStateEntry>();
    if (paths.length === 0) return result;
    const placeholders = paths.map((_, i) => `$p${i}`).join(", ");
    const params: Record<string, string> = {};
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (p !== undefined) params[`$p${i}`] = p;
    }
    const stmt = this.db.prepare(
      `SELECT path, size, mtime, hash FROM scan_state WHERE path IN (${placeholders})`,
    );
    const rows = stmt.all(params) as Array<{
      path: string;
      size: number;
      mtime: number;
      hash: string;
    }>;
    for (const row of rows) {
      result.set(row.path, { size: row.size, mtime: row.mtime, hash: row.hash });
    }
    return result;
  }

  setScanState(path: string, size: number, mtime: number, hash: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO scan_state (path, size, mtime, hash)
      VALUES ($path, $size, $mtime, $hash)
    `);
    stmt.run({
      $path: path,
      $size: size,
      $mtime: mtime,
      $hash: hash,
    });
  }

  deleteScanState(path: string): void {
    const stmt = this.db.prepare("DELETE FROM scan_state WHERE path = $path");
    stmt.run({ $path: path });
  }

  deleteScanStateBatch(paths: string[]): void {
    if (paths.length === 0) return;
    const placeholders = paths.map((_, i) => `$p${i}`).join(", ");
    const params: Record<string, string> = {};
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      if (p !== undefined) params[`$p${i}`] = p;
    }
    const stmt = this.db.prepare(`DELETE FROM scan_state WHERE path IN (${placeholders})`);
    stmt.run(params);
  }

  clearScanState(): void {
    this.db.run("DELETE FROM scan_state");
  }

  close(): void {
    this.db.close();
  }
}
