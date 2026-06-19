import { and, eq, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { EntryType } from "../types";
import { anime, episodeGroups, episodes, groupTrackerMappings } from "./schema";

export interface LibraryAnime {
  id: number;
  externalId: string;
  sourceDb: string;
  title: string;
  titleJapanese?: string;
  episodeCount: number;
  filesOnDisk?: number;
  coverArtPath?: string;
  genres?: string[];
  libraryState?: "on_disk" | "partially_on_disk" | "not_on_disk";
  lastSynced: string;
}

export interface LibraryEpisode {
  id: number;
  animeId: number;
  groupId: number;
  episodeNumber: number;
  filePath: string;
  title?: string;
  season?: number;
  watched: boolean;
}

export interface EpisodeGroup {
  id: number;
  animeId: number;
  entryType: EntryType;
  seasonNumber?: number;
  watchStatus: "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";
  synopsis?: string;
  rating?: number;
  coverArtPath?: string;
  lastSynced: string;
}

export interface GroupTrackerMapping {
  groupId: number;
  source: "mal" | "anilist" | "kitsu";
  externalId: string;
}

type LibrarySchema = {
  anime: typeof anime;
  episodeGroups: typeof episodeGroups;
  episodes: typeof episodes;
  groupTrackerMappings: typeof groupTrackerMappings;
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
          episodeCount: animeData.episodeCount,
          coverArtPath: animeData.coverArtPath ?? null,
          genres: animeData.genres ?? null,
          libraryState: animeData.libraryState ?? "not_on_disk",
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
        episodeCount: animeData.episodeCount,
        coverArtPath: animeData.coverArtPath ?? null,
        genres: animeData.genres ?? null,
        libraryState: animeData.libraryState ?? "not_on_disk",
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
        episodeCount: anime.episodeCount,
        coverArtPath: anime.coverArtPath,
        genres: anime.genres,
        libraryState: anime.libraryState,
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
        .set({
          filePath: episodeData.filePath,
          title: episodeData.title ?? null,
          groupId: episodeData.groupId,
          watched: episodeData.watched,
        })
        .where(eq(episodes.id, existing.id))
        .run();
      return this.getEpisode(existing.id) as LibraryEpisode;
    }

    const result = this.db
      .insert(episodes)
      .values({
        animeId: episodeData.animeId,
        groupId: episodeData.groupId,
        episodeNumber: episodeData.episodeNumber,
        filePath: episodeData.filePath,
        title: episodeData.title ?? null,
        season: episodeData.season ?? 1,
        watched: episodeData.watched,
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

  setEpisodeWatched(episodeId: number, watched: boolean): LibraryEpisode | null {
    this.db.update(episodes).set({ watched }).where(eq(episodes.id, episodeId)).run();
    return this.getEpisode(episodeId);
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
      .where(eq(episodes.animeId, animeId))
      .all();
    return rows;
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
    this.db.delete(groupTrackerMappings).run();
    this.db.delete(episodes).run();
    this.db.delete(episodeGroups).run();
    this.db.delete(anime).run();
  }

  getAllEpisodesWithAnime(): Array<{
    episodeId: number;
    animeExternalId: string;
    animeSourceDb: string;
    season: number | null;
    episodeNumber: number;
    watched: boolean;
  }> {
    return this.db
      .select({
        episodeId: episodes.id,
        animeExternalId: anime.externalId,
        animeSourceDb: anime.sourceDb,
        season: episodes.season,
        episodeNumber: episodes.episodeNumber,
        watched: episodes.watched,
      })
      .from(episodes)
      .innerJoin(anime, eq(episodes.animeId, anime.id))
      .all();
  }

  upsertEpisodeFromMatch(match: {
    animeId: number;
    groupId: number;
    episode: number;
    filePath: string;
    title?: string | null;
    season?: number | null;
  }): { id: number } {
    const result = this.db
      .insert(episodes)
      .values({
        animeId: match.animeId,
        groupId: match.groupId,
        episodeNumber: match.episode,
        filePath: match.filePath,
        title: match.title ?? null,
        season: match.season ?? 1,
      })
      .onConflictDoUpdate({
        target: [episodes.animeId, episodes.episodeNumber, episodes.season],
        set: { filePath: match.filePath, title: match.title ?? null, groupId: match.groupId },
      })
      .returning()
      .get();
    return { id: result.id };
  }

  migrateEpisodeWatched(episodeId: number, watched: boolean): void {
    this.db.update(episodes).set({ watched }).where(eq(episodes.id, episodeId)).run();
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
    groupId: number;
  }> {
    const rows = this.db
      .select({
        externalId: anime.externalId,
        sourceDb: anime.sourceDb,
        title: anime.title,
        entryType: episodeGroups.entryType,
        groupId: episodes.groupId,
        episodeNumber: episodes.episodeNumber,
        filePath: episodes.filePath,
        episodeTitle: episodes.title,
        season: episodes.season,
      })
      .from(anime)
      .innerJoin(episodes, eq(episodes.animeId, anime.id))
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
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
      groupId: row.groupId,
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

  // Episode Groups

  upsertEpisodeGroup(
    groupData: Omit<EpisodeGroup, "id" | "lastSynced"> & { lastSynced?: string },
  ): EpisodeGroup {
    const now = groupData.lastSynced ?? new Date().toISOString();
    const seasonCondition =
      groupData.seasonNumber == null
        ? isNull(episodeGroups.seasonNumber)
        : eq(episodeGroups.seasonNumber, groupData.seasonNumber);
    const existing = this.db
      .select({ id: episodeGroups.id })
      .from(episodeGroups)
      .where(
        and(
          eq(episodeGroups.animeId, groupData.animeId),
          eq(episodeGroups.entryType, groupData.entryType),
          seasonCondition,
        ),
      )
      .get();

    if (existing) {
      this.db
        .update(episodeGroups)
        .set({
          watchStatus: groupData.watchStatus,
          synopsis: groupData.synopsis ?? null,
          rating: groupData.rating ?? null,
          coverArtPath: groupData.coverArtPath ?? null,
          lastSynced: now,
        })
        .where(eq(episodeGroups.id, existing.id))
        .run();
      return this.getEpisodeGroup(existing.id) as EpisodeGroup;
    }

    const result = this.db
      .insert(episodeGroups)
      .values({
        animeId: groupData.animeId,
        entryType: groupData.entryType,
        seasonNumber: groupData.seasonNumber ?? null,
        watchStatus: groupData.watchStatus,
        synopsis: groupData.synopsis ?? null,
        rating: groupData.rating ?? null,
        coverArtPath: groupData.coverArtPath ?? null,
        lastSynced: now,
      })
      .returning()
      .get();

    return this.rowToEpisodeGroup(result);
  }

  getEpisodeGroup(id: number): EpisodeGroup | null {
    const row = this.db.select().from(episodeGroups).where(eq(episodeGroups.id, id)).get();
    return row ? this.rowToEpisodeGroup(row) : null;
  }

  getEpisodeGroupsByAnimeId(animeId: number): EpisodeGroup[] {
    const rows = this.db
      .select()
      .from(episodeGroups)
      .where(eq(episodeGroups.animeId, animeId))
      .orderBy(episodeGroups.seasonNumber)
      .all();
    return rows.map(this.rowToEpisodeGroup);
  }

  findEpisodeGroup(
    animeId: number,
    entryType: EntryType,
    seasonNumber: number | null,
  ): EpisodeGroup | null {
    const seasonCondition =
      seasonNumber === null
        ? isNull(episodeGroups.seasonNumber)
        : eq(episodeGroups.seasonNumber, seasonNumber);
    const row = this.db
      .select()
      .from(episodeGroups)
      .where(
        and(
          eq(episodeGroups.animeId, animeId),
          eq(episodeGroups.entryType, entryType),
          seasonCondition,
        ),
      )
      .get();
    return row ? this.rowToEpisodeGroup(row) : null;
  }

  deleteEpisodeGroupsByAnimeId(animeId: number): void {
    this.db.delete(episodeGroups).where(eq(episodeGroups.animeId, animeId)).run();
  }

  updateEpisodeGroupStatus(
    groupId: number,
    status: EpisodeGroup["watchStatus"],
  ): EpisodeGroup | null {
    this.db
      .update(episodeGroups)
      .set({ watchStatus: status })
      .where(eq(episodeGroups.id, groupId))
      .run();
    return this.getEpisodeGroup(groupId);
  }

  updateEpisodeGroupMetadata(
    groupId: number,
    metadata: { synopsis?: string; rating?: number; coverArtPath?: string },
  ): EpisodeGroup | null {
    const set: Record<string, unknown> = {};
    if (metadata.synopsis !== undefined) set["synopsis"] = metadata.synopsis;
    if (metadata.rating !== undefined) set["rating"] = metadata.rating;
    if (metadata.coverArtPath !== undefined) set["coverArtPath"] = metadata.coverArtPath;
    if (Object.keys(set).length === 0) return this.getEpisodeGroup(groupId);
    this.db.update(episodeGroups).set(set).where(eq(episodeGroups.id, groupId)).run();
    return this.getEpisodeGroup(groupId);
  }

  deleteEpisodeGroup(groupId: number): void {
    this.db.delete(episodeGroups).where(eq(episodeGroups.id, groupId)).run();
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

  // Group Tracker Mappings

  upsertGroupTrackerMapping(mapping: GroupTrackerMapping): void {
    this.db
      .insert(groupTrackerMappings)
      .values({
        groupId: mapping.groupId,
        source: mapping.source,
        externalId: mapping.externalId,
      })
      .onConflictDoUpdate({
        target: [groupTrackerMappings.source, groupTrackerMappings.externalId],
        set: { groupId: mapping.groupId },
      })
      .run();
  }

  getTrackerMappingsByGroupId(groupId: number): GroupTrackerMapping[] {
    const rows = this.db
      .select()
      .from(groupTrackerMappings)
      .where(eq(groupTrackerMappings.groupId, groupId))
      .all();
    return rows.map(this.rowToGroupTrackerMapping);
  }

  findGroupByTrackerExternalId(source: string, externalId: string): { groupId: number } | null {
    const row = this.db
      .select({ groupId: groupTrackerMappings.groupId })
      .from(groupTrackerMappings)
      .where(
        and(
          eq(groupTrackerMappings.source, source),
          eq(groupTrackerMappings.externalId, externalId),
        ),
      )
      .get();
    return row ? { groupId: row.groupId } : null;
  }

  deleteTrackerMappingsByGroupId(groupId: number): void {
    this.db.delete(groupTrackerMappings).where(eq(groupTrackerMappings.groupId, groupId)).run();
  }

  getTrackerMapping(groupId: number, source: string): GroupTrackerMapping | null {
    const row = this.db
      .select()
      .from(groupTrackerMappings)
      .where(
        and(eq(groupTrackerMappings.groupId, groupId), eq(groupTrackerMappings.source, source)),
      )
      .get();
    return row ? this.rowToGroupTrackerMapping(row) : null;
  }

  removeTrackerMappingsBySource(source: string): void {
    this.db.delete(groupTrackerMappings).where(eq(groupTrackerMappings.source, source)).run();
  }

  removeTrackerMapping(groupId: number, source: string): void {
    this.db
      .delete(groupTrackerMappings)
      .where(
        and(eq(groupTrackerMappings.groupId, groupId), eq(groupTrackerMappings.source, source)),
      )
      .run();
  }

  private rowToAnime(row: {
    id: number;
    externalId: string;
    sourceDb: string;
    title: string;
    titleJapanese: string | null;
    episodeCount: number;
    coverArtPath: string | null;
    genres: string[] | null;
    libraryState: string;
    lastSynced: string;
  }): LibraryAnime {
    return {
      id: row.id,
      externalId: row.externalId,
      sourceDb: row.sourceDb,
      title: row.title,
      titleJapanese: row.titleJapanese ?? undefined,
      episodeCount: row.episodeCount,
      coverArtPath: row.coverArtPath ?? undefined,
      genres: row.genres ?? undefined,
      libraryState: row.libraryState as LibraryAnime["libraryState"],
      lastSynced: row.lastSynced,
    };
  }

  private rowToEpisode(row: {
    id: number;
    animeId: number;
    groupId: number;
    episodeNumber: number;
    filePath: string;
    title: string | null;
    season: number | null;
    watched: boolean;
  }): LibraryEpisode {
    return {
      id: row.id,
      animeId: row.animeId,
      groupId: row.groupId,
      episodeNumber: row.episodeNumber,
      filePath: row.filePath,
      title: row.title ?? undefined,
      season: row.season ?? undefined,
      watched: row.watched,
    };
  }

  private rowToEpisodeGroup(row: {
    id: number;
    animeId: number;
    entryType: string;
    seasonNumber: number | null;
    watchStatus: string;
    synopsis: string | null;
    rating: number | null;
    coverArtPath: string | null;
    lastSynced: string;
  }): EpisodeGroup {
    return {
      id: row.id,
      animeId: row.animeId,
      entryType: row.entryType as EntryType,
      seasonNumber: row.seasonNumber ?? undefined,
      watchStatus: row.watchStatus as EpisodeGroup["watchStatus"],
      synopsis: row.synopsis ?? undefined,
      rating: row.rating ?? undefined,
      coverArtPath: row.coverArtPath ?? undefined,
      lastSynced: row.lastSynced,
    };
  }

  private rowToGroupTrackerMapping(row: {
    groupId: number;
    source: string;
    externalId: string;
  }): GroupTrackerMapping {
    return {
      groupId: row.groupId,
      source: row.source as GroupTrackerMapping["source"],
      externalId: row.externalId,
    };
  }
}
