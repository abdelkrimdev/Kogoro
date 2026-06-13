import { and, eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { EntryType } from "../types";
import { matches } from "./schema";

export interface CachedMatch {
  animeId: string;
  animeTitle?: string;
  episodeId: string | null;
  entryType: EntryType;
  season: number | null;
  episode: number | null;
  title: string | null;
  sourceDb: string;
  timestamp: string;
}

type MatchSchema = { matches: typeof matches };
type MatchDb = BunSQLiteDatabase<MatchSchema>;

export class MatchRepository {
  constructor(private db: MatchDb) {}

  private rowToCachedMatch(row: typeof matches.$inferSelect): CachedMatch {
    return {
      animeId: row.animeId,
      animeTitle: row.animeTitle ?? undefined,
      episodeId: row.episodeId,
      entryType: row.entryType as EntryType,
      season: row.season,
      episode: row.episode,
      title: row.title,
      sourceDb: row.sourceDb,
      timestamp: row.timestamp,
    };
  }

  set(hash: string, match: CachedMatch): void {
    this.db
      .insert(matches)
      .values({
        hash,
        animeId: match.animeId,
        animeTitle: match.animeTitle ?? null,
        episodeId: match.episodeId,
        entryType: match.entryType,
        season: match.season,
        episode: match.episode,
        title: match.title,
        sourceDb: match.sourceDb,
        timestamp: match.timestamp,
      })
      .onConflictDoUpdate({
        target: matches.hash,
        set: {
          animeId: match.animeId,
          animeTitle: match.animeTitle ?? null,
          episodeId: match.episodeId,
          entryType: match.entryType,
          season: match.season,
          episode: match.episode,
          title: match.title,
          sourceDb: match.sourceDb,
          timestamp: match.timestamp,
        },
      })
      .run();
  }

  get(hash: string): CachedMatch | null {
    const row = this.db.select().from(matches).where(eq(matches.hash, hash)).get();
    return row ? this.rowToCachedMatch(row) : null;
  }

  getByHashAndSourceDb(hash: string, sourceDb: string): CachedMatch | null {
    const row = this.db
      .select()
      .from(matches)
      .where(and(eq(matches.hash, hash), eq(matches.sourceDb, sourceDb)))
      .get();
    return row ? this.rowToCachedMatch(row) : null;
  }

  has(hash: string): boolean {
    const row = this.db
      .select({ hash: matches.hash })
      .from(matches)
      .where(eq(matches.hash, hash))
      .get();
    return row != null;
  }

  list(): Array<{ hash: string; match: CachedMatch }> {
    const rows = this.db.select().from(matches).orderBy(matches.timestamp).all();
    return rows.map((row) => ({
      hash: row.hash,
      match: this.rowToCachedMatch(row),
    }));
  }

  clear(): void {
    this.db.delete(matches).run();
  }

  delete(hash: string): void {
    this.db.delete(matches).where(eq(matches.hash, hash)).run();
  }
}
