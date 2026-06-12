import { and, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { EntryType } from "../types";
import { anime, episodes, watchStatus } from "./schema";

export interface LibraryAnime {
  id: number;
  externalId: string;
  sourceDb: string;
  title: string;
  titleJapanese?: string;
  entryType: EntryType;
  episodeCount: number;
  filesOnDisk?: number;
  coverArtPath?: string;
  lastSynced: string;
}

export interface LibraryEpisode {
  id: number;
  animeId: number;
  episodeNumber: number;
  filePath: string;
  title?: string;
  season?: number;
}

export interface WatchStatus {
  episodeId: number;
  watched: boolean;
  notes?: string;
  updatedAt: string;
}

type LibrarySchema = {
  anime: typeof anime;
  episodes: typeof episodes;
  watchStatus: typeof watchStatus;
};
type LibraryDb = BaseSQLiteDatabase<"sync", void, LibrarySchema>;

export class LibraryRepository {
  constructor(private db: LibraryDb) {}

  upsertAnime(
    animeData: Omit<LibraryAnime, "id" | "lastSynced"> & { lastSynced?: string },
  ): LibraryAnime {
    const now = animeData.lastSynced ?? new Date().toISOString();
    const existing = this.db
      .select({ id: anime.id })
      .from(anime)
      .where(
        and(eq(anime.externalId, animeData.externalId), eq(anime.sourceDb, animeData.sourceDb)),
      )
      .get();

    if (existing) {
      this.db
        .update(anime)
        .set({
          title: animeData.title,
          titleJapanese: animeData.titleJapanese ?? null,
          entryType: animeData.entryType,
          episodeCount: animeData.episodeCount,
          coverArtPath: animeData.coverArtPath ?? null,
          lastSynced: now,
        })
        .where(eq(anime.id, existing.id))
        .run();
      return this.getAnime(existing.id) as LibraryAnime;
    }

    const result = this.db
      .insert(anime)
      .values({
        externalId: animeData.externalId,
        sourceDb: animeData.sourceDb,
        title: animeData.title,
        titleJapanese: animeData.titleJapanese ?? null,
        entryType: animeData.entryType,
        episodeCount: animeData.episodeCount,
        coverArtPath: animeData.coverArtPath ?? null,
        lastSynced: now,
      })
      .returning()
      .get();

    return this.rowToAnime(result);
  }

  getAnime(id: number): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.id, id)).get();
    return row ? this.rowToAnime(row) : null;
  }

  findAnime(externalId: string, sourceDb: string): LibraryAnime | null {
    const row = this.db
      .select()
      .from(anime)
      .where(and(eq(anime.externalId, externalId), eq(anime.sourceDb, sourceDb)))
      .get();
    return row ? this.rowToAnime(row) : null;
  }

  findAnimeByTitle(title: string, sourceDb: string): LibraryAnime | null {
    const row = this.db
      .select()
      .from(anime)
      .where(and(eq(anime.title, title), eq(anime.sourceDb, sourceDb)))
      .get();
    return row ? this.rowToAnime(row) : null;
  }

  listAnime(): LibraryAnime[] {
    const rows = this.db
      .select({
        id: anime.id,
        externalId: anime.externalId,
        sourceDb: anime.sourceDb,
        title: anime.title,
        titleJapanese: anime.titleJapanese,
        entryType: anime.entryType,
        episodeCount: anime.episodeCount,
        coverArtPath: anime.coverArtPath,
        lastSynced: anime.lastSynced,
        filesOnDisk: sql<number>`cast(count(${episodes.id}) as int)`,
      })
      .from(anime)
      .leftJoin(episodes, eq(episodes.animeId, anime.id))
      .groupBy(anime.id)
      .orderBy(anime.title)
      .all();

    return rows.map((row) => ({
      ...this.rowToAnime(row),
      filesOnDisk: row.filesOnDisk,
    }));
  }

  addEpisode(episodeData: Omit<LibraryEpisode, "id">): LibraryEpisode {
    const existing = this.db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.animeId, episodeData.animeId),
          eq(episodes.episodeNumber, episodeData.episodeNumber),
          eq(episodes.season, episodeData.season ?? 1),
        ),
      )
      .get();

    if (existing) {
      this.db
        .update(episodes)
        .set({ filePath: episodeData.filePath, title: episodeData.title ?? null })
        .where(eq(episodes.id, existing.id))
        .run();
      return this.getEpisode(existing.id) as LibraryEpisode;
    }

    const result = this.db
      .insert(episodes)
      .values({
        animeId: episodeData.animeId,
        episodeNumber: episodeData.episodeNumber,
        filePath: episodeData.filePath,
        title: episodeData.title ?? null,
        season: episodeData.season ?? 1,
      })
      .returning()
      .get();

    return this.rowToEpisode(result);
  }

  getEpisode(id: number): LibraryEpisode | null {
    const row = this.db.select().from(episodes).where(eq(episodes.id, id)).get();
    return row ? this.rowToEpisode(row) : null;
  }

  getEpisodesByAnimeId(animeId: number): LibraryEpisode[] {
    const rows = this.db
      .select()
      .from(episodes)
      .where(eq(episodes.animeId, animeId))
      .orderBy(episodes.season, episodes.episodeNumber)
      .all();
    return rows.map(this.rowToEpisode);
  }

  deleteEpisodesByAnimeId(animeId: number): void {
    this.db.delete(episodes).where(eq(episodes.animeId, animeId)).run();
  }

  setWatchStatus(episodeId: number, watched: boolean, notes?: string): WatchStatus {
    const now = new Date().toISOString();
    this.db
      .insert(watchStatus)
      .values({ episodeId, watched, notes: notes ?? null, updatedAt: now })
      .onConflictDoUpdate({
        target: watchStatus.episodeId,
        set: { watched, notes: notes ?? null, updatedAt: now },
      })
      .run();
    return { episodeId, watched, notes, updatedAt: now };
  }

  getWatchStatus(episodeId: number): WatchStatus | null {
    const row = this.db
      .select()
      .from(watchStatus)
      .where(eq(watchStatus.episodeId, episodeId))
      .get();
    return row
      ? {
          episodeId: row.episodeId,
          watched: row.watched,
          notes: row.notes ?? undefined,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  getWatchStatusByAnimeId(animeId: number): WatchStatus[] {
    const rows = this.db
      .select({
        episodeId: watchStatus.episodeId,
        watched: watchStatus.watched,
        notes: watchStatus.notes,
        updatedAt: watchStatus.updatedAt,
      })
      .from(watchStatus)
      .innerJoin(episodes, eq(watchStatus.episodeId, episodes.id))
      .where(eq(episodes.animeId, animeId))
      .all();
    return rows.map((row) => ({
      episodeId: row.episodeId,
      watched: row.watched,
      notes: row.notes ?? undefined,
      updatedAt: row.updatedAt,
    }));
  }

  updateEpisodeCount(animeId: number): void {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .where(eq(episodes.animeId, animeId))
      .get();
    this.db
      .update(anime)
      .set({ episodeCount: row?.count ?? 0 })
      .where(eq(anime.id, animeId))
      .run();
  }

  getStats(): { animeCount: number; episodeCount: number } {
    const animeRow = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(anime)
      .get();
    const episodeRow = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .get();
    return { animeCount: animeRow?.count ?? 0, episodeCount: episodeRow?.count ?? 0 };
  }

  deleteAll(): void {
    this.db.delete(watchStatus).run();
    this.db.delete(episodes).run();
    this.db.delete(anime).run();
  }

  getAllEpisodesWithAnime(): Array<{
    episodeId: number;
    animeExternalId: string;
    animeSourceDb: string;
    season: number | null;
    episodeNumber: number;
    watched: boolean | null;
    notes: string | null;
  }> {
    return this.db
      .select({
        episodeId: episodes.id,
        animeExternalId: anime.externalId,
        animeSourceDb: anime.sourceDb,
        season: episodes.season,
        episodeNumber: episodes.episodeNumber,
        watched: watchStatus.watched,
        notes: watchStatus.notes,
      })
      .from(episodes)
      .innerJoin(anime, eq(episodes.animeId, anime.id))
      .leftJoin(watchStatus, eq(watchStatus.episodeId, episodes.id))
      .all();
  }

  upsertEpisodeFromMatch(match: {
    animeId: number;
    episode: number;
    filePath: string;
    title?: string | null;
    season?: number | null;
  }): { id: number } {
    const result = this.db
      .insert(episodes)
      .values({
        animeId: match.animeId,
        episodeNumber: match.episode,
        filePath: match.filePath,
        title: match.title ?? null,
        season: match.season ?? 1,
      })
      .onConflictDoUpdate({
        target: [episodes.animeId, episodes.episodeNumber, episodes.season],
        set: { filePath: match.filePath, title: match.title ?? null },
      })
      .returning()
      .get();
    return { id: result.id };
  }

  migrateWatchStatus(
    newEpisodeId: number,
    watched: boolean,
    notes: string | null,
    updatedAt: string,
  ): void {
    this.db
      .insert(watchStatus)
      .values({ episodeId: newEpisodeId, watched, notes, updatedAt })
      .onConflictDoUpdate({
        target: watchStatus.episodeId,
        set: { watched, notes, updatedAt },
      })
      .run();
  }

  transaction<T>(fn: (repo: LibraryRepository) => T): T {
    return this.db.transaction((tx) => {
      const txRepo = new LibraryRepository(tx);
      return fn(txRepo);
    });
  }

  exportMatches(): Array<{
    animeId: string;
    animeTitle: string;
    entryType: EntryType;
    episode: number;
    filePath: string;
    episodeTitle: string | null;
    season: number | null;
    sourceDb: string;
  }> {
    const rows = this.db
      .select({
        externalId: anime.externalId,
        sourceDb: anime.sourceDb,
        title: anime.title,
        entryType: anime.entryType,
        episodeNumber: episodes.episodeNumber,
        filePath: episodes.filePath,
        episodeTitle: episodes.title,
        season: episodes.season,
      })
      .from(anime)
      .innerJoin(episodes, eq(episodes.animeId, anime.id))
      .orderBy(anime.title, episodes.season, episodes.episodeNumber)
      .all();

    return rows.map((row) => ({
      animeId: row.externalId,
      animeTitle: row.title,
      entryType: row.entryType as EntryType,
      episode: row.episodeNumber,
      filePath: row.filePath,
      episodeTitle: row.episodeTitle ?? null,
      season: row.season ?? null,
      sourceDb: row.sourceDb,
    }));
  }

  deleteAnime(id: number): void {
    this.db.delete(anime).where(eq(anime.id, id)).run();
  }

  getEpisodesWithSourceDb(): Array<{
    id: number;
    animeId: number;
    filePath: string;
    sourceDb: string;
  }> {
    return this.db
      .select({
        id: episodes.id,
        animeId: episodes.animeId,
        filePath: episodes.filePath,
        sourceDb: anime.sourceDb,
      })
      .from(episodes)
      .innerJoin(anime, eq(episodes.animeId, anime.id))
      .all();
  }

  deleteEpisodesByIds(ids: number[]): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      this.db.delete(episodes).where(eq(episodes.id, id)).run();
    }
  }

  deleteAnimeByIds(ids: number[]): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      this.db.delete(anime).where(eq(anime.id, id)).run();
    }
  }

  getEpisodeCountByAnimeId(animeId: number): number {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .where(eq(episodes.animeId, animeId))
      .get();
    return row?.count ?? 0;
  }

  private rowToAnime(row: {
    id: number;
    externalId: string;
    sourceDb: string;
    title: string;
    titleJapanese: string | null;
    entryType: string;
    episodeCount: number;
    coverArtPath: string | null;
    lastSynced: string;
  }): LibraryAnime {
    return {
      id: row.id,
      externalId: row.externalId,
      sourceDb: row.sourceDb,
      title: row.title,
      titleJapanese: row.titleJapanese ?? undefined,
      entryType: row.entryType as EntryType,
      episodeCount: row.episodeCount,
      coverArtPath: row.coverArtPath ?? undefined,
      lastSynced: row.lastSynced,
    };
  }

  private rowToEpisode(row: {
    id: number;
    animeId: number;
    episodeNumber: number;
    filePath: string;
    title: string | null;
    season: number | null;
  }): LibraryEpisode {
    return {
      id: row.id,
      animeId: row.animeId,
      episodeNumber: row.episodeNumber,
      filePath: row.filePath,
      title: row.title ?? undefined,
      season: row.season ?? undefined,
    };
  }
}
