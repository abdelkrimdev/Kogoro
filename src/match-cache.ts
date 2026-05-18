import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface CachedMatch {
  animeId: string;
  episodeId: string | null;
  entryType: string;
  season: number | null;
  episode: number | null;
  title: string | null;
  timestamp: string;
}

export interface MatchCacheOptions {
  dbPath?: string;
}

interface MatchRow {
  anime_id: string;
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
    const dbPath = options.dbPath ?? join(homedir(), ".config", "kogoro", "cache.db");
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS matches (
        hash TEXT PRIMARY KEY,
        anime_id TEXT NOT NULL,
        episode_id TEXT,
        entry_type TEXT NOT NULL,
        season INTEGER,
        episode INTEGER,
        title TEXT,
        timestamp TEXT NOT NULL
      )
    `);
  }

  set(hash: string, match: CachedMatch): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO matches (hash, anime_id, episode_id, entry_type, season, episode, title, timestamp)
      VALUES ($hash, $animeId, $episodeId, $entryType, $season, $episode, $title, $timestamp)
    `);
    stmt.run({
      $hash: hash,
      $animeId: match.animeId,
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
      SELECT anime_id, episode_id, entry_type, season, episode, title, timestamp
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
      SELECT hash, anime_id, episode_id, entry_type, season, episode, title, timestamp
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
    hash.update(buffer);
    return hash.digest("hex");
  }

  close(): void {
    this.db.close();
  }
}
