import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { CONFIG_DIR } from "./config/schema";

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
    const stream = file.stream();
    const hash = new Bun.CryptoHasher("sha256");
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
    }
    return hash.digest("hex");
  }

  close(): void {
    this.db.close();
  }
}
