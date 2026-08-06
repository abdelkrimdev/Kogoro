import { and, eq, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { EventRepository } from "../events/event-repository";
import { anime, episodeGroups, episodes } from "./schema";

export interface LibraryEpisode {
  id: number;
  groupId: number;
  episodeNumber: number;
  filePath: string;
  title?: string;
  watched: boolean;
  notes?: string;
}

type LibrarySchema = {
  anime: typeof anime;
  episodeGroups: typeof episodeGroups;
  episodes: typeof episodes;
};
type LibraryDb = BaseSQLiteDatabase<"sync", void, LibrarySchema>;

export interface EpisodeRepositoryDeps {
  db: LibraryDb;
  events?: EventRepository;
}

export class EpisodeRepository {
  private db: LibraryDb;
  private events?: EventRepository;

  constructor(deps: EpisodeRepositoryDeps) {
    this.db = deps.db;
    this.events = deps.events;
  }

  addEpisode(episodeData: Omit<LibraryEpisode, "id">): LibraryEpisode {
    const existing = this.db
      .select({ id: episodes.id })
      .from(episodes)
      .where(
        and(
          eq(episodes.groupId, episodeData.groupId),
          eq(episodes.episodeNumber, episodeData.episodeNumber),
        ),
      )
      .get();

    if (existing) {
      this.db
        .update(episodes)
        .set({
          filePath: episodeData.filePath,
          title: episodeData.title ?? null,
          groupId: episodeData.groupId,
          watched: episodeData.watched,
          notes: episodeData.notes || null,
        })
        .where(eq(episodes.id, existing.id))
        .run();
      return this.getEpisode(existing.id) as LibraryEpisode;
    }

    const result = this.db
      .insert(episodes)
      .values({
        groupId: episodeData.groupId,
        episodeNumber: episodeData.episodeNumber,
        filePath: episodeData.filePath,
        title: episodeData.title ?? null,
        watched: episodeData.watched,
        notes: episodeData.notes || null,
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
      .select({ episodes: episodes })
      .from(episodes)
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
      .where(eq(episodeGroups.animeId, animeId))
      .orderBy(episodes.episodeNumber)
      .all();
    return rows.map((r) => this.rowToEpisode(r.episodes));
  }

  getEpisodesByGroupId(groupId: number): LibraryEpisode[] {
    const rows = this.db
      .select()
      .from(episodes)
      .where(eq(episodes.groupId, groupId))
      .orderBy(episodes.episodeNumber)
      .all();
    return rows.map(this.rowToEpisode);
  }

  deleteEpisodesByAnimeId(animeId: number): void {
    this.db
      .delete(episodes)
      .where(
        sql`${episodes.groupId} IN (SELECT id FROM ${episodeGroups} WHERE ${episodeGroups.animeId} = ${animeId})`,
      )
      .run();
  }

  deleteEpisodesByIds(ids: number[]): void {
    if (ids.length === 0) return;
    for (const id of ids) {
      this.db.delete(episodes).where(eq(episodes.id, id)).run();
    }
  }

  setEpisodeWatched(episodeId: number, watched: boolean): LibraryEpisode | null {
    const oldWatched = this.getEpisodeWatchStatus(episodeId);
    this.db.update(episodes).set({ watched }).where(eq(episodes.id, episodeId)).run();
    const result = this.getEpisode(episodeId);
    if (result && oldWatched !== null && oldWatched !== watched && this.events) {
      this.events.append({
        entityType: "episode",
        entityId: episodeId,
        eventType: "watched_toggle",
        oldValue: String(oldWatched),
        newValue: String(watched),
      });
    }
    return result;
  }

  setEpisodeNotes(episodeId: number, notes: string): LibraryEpisode | null {
    const oldEpisode = this.getEpisode(episodeId);
    this.db
      .update(episodes)
      .set({ notes: notes || null })
      .where(eq(episodes.id, episodeId))
      .run();
    const result = this.getEpisode(episodeId);
    if (result && oldEpisode && oldEpisode.notes !== notes && this.events) {
      this.events.append({
        entityType: "episode",
        entityId: episodeId,
        eventType: "notes_update",
        oldValue: oldEpisode.notes ?? null,
        newValue: notes,
      });
    }
    return result;
  }

  getEpisodeWatchStatus(episodeId: number): boolean | null {
    const row = this.db
      .select({ watched: episodes.watched })
      .from(episodes)
      .where(eq(episodes.id, episodeId))
      .get();
    return row ? row.watched : null;
  }

  getEpisodeWatchStatusByAnimeId(animeId: number): Array<{ episodeId: number; watched: boolean }> {
    const rows = this.db
      .select({ episodeId: episodes.id, watched: episodes.watched })
      .from(episodes)
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
      .where(eq(episodeGroups.animeId, animeId))
      .all();
    return rows;
  }

  upsertEpisodeFromMatch(match: {
    groupId: number;
    episode: number;
    filePath: string;
    title?: string | null;
  }): { id: number } {
    const result = this.db
      .insert(episodes)
      .values({
        groupId: match.groupId,
        episodeNumber: match.episode,
        filePath: match.filePath,
        title: match.title ?? null,
      })
      .onConflictDoUpdate({
        target: [episodes.groupId, episodes.episodeNumber],
        set: { filePath: match.filePath, title: match.title ?? null },
      })
      .returning()
      .get();
    return { id: result.id };
  }

  migrateEpisodeWatched(episodeId: number, watched: boolean): void {
    this.db.update(episodes).set({ watched }).where(eq(episodes.id, episodeId)).run();
  }

  migrateEpisodeNotes(episodeId: number, notes: string): void {
    this.db
      .update(episodes)
      .set({ notes: notes || null })
      .where(eq(episodes.id, episodeId))
      .run();
  }

  getEpisodeCountByAnimeId(animeId: number): number {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
      .where(eq(episodeGroups.animeId, animeId))
      .get();
    return row?.count ?? 0;
  }

  getAllEpisodesWithAnime(): Array<{
    episodeId: number;
    animeId: number;
    anidbId: string | null;
    episodeNumber: number;
    watched: boolean;
  }> {
    return this.db
      .select({
        episodeId: episodes.id,
        animeId: anime.id,
        anidbId: anime.anidbId,
        episodeNumber: episodes.episodeNumber,
        watched: episodes.watched,
      })
      .from(episodes)
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
      .innerJoin(anime, eq(anime.id, episodeGroups.animeId))
      .all();
  }

  deleteAll(): void {
    this.db.delete(episodes).run();
  }

  private rowToEpisode(row: {
    id: number;
    groupId: number;
    episodeNumber: number;
    filePath: string;
    title: string | null;
    watched: boolean;
    notes: string | null;
  }): LibraryEpisode {
    return {
      id: row.id,
      groupId: row.groupId,
      episodeNumber: row.episodeNumber,
      filePath: row.filePath,
      title: row.title ?? undefined,
      watched: row.watched,
      notes: row.notes ?? undefined,
    };
  }
}
