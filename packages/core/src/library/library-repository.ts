import { and, eq, isNull, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import type { EnrichmentRelation, EntryType } from "../types";
import {
  anilistCache,
  anime,
  animeSourceMappings,
  episodeGroups,
  episodes,
  franchises,
  groupTrackerMappings,
} from "./schema";

export interface LibraryAnime {
  id: number;
  title: string;
  alternativeTitles?: string[];
  episodeCount: number;
  filesOnDisk?: number;
  coverArtPath?: string;
  genres?: string[];
  libraryState?: "on_disk" | "partially_on_disk" | "not_on_disk";
  franchiseId?: number;
  lastSynced: string;
  anilistId?: string;
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
  notes?: string;
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

export interface Franchise {
  id: number;
  title: string;
  anilistId: string | null;
  coverArtPath: string | null;
  synopsis: string | null;
  createdAt: string;
}

export interface AnimeSourceMapping {
  id: number;
  animeId: number;
  source: string;
  externalId: string;
}

export interface AnilistCacheEntry {
  anilistId: string;
  title: string;
  format: string | null;
  episodes: number | null;
  relations: import("../types").EnrichmentRelation[];
  externalLinks: { site: string; id: string }[] | null;
  fetchedAt: string;
}

type LibrarySchema = {
  anime: typeof anime;
  episodeGroups: typeof episodeGroups;
  episodes: typeof episodes;
  groupTrackerMappings: typeof groupTrackerMappings;
  franchises: typeof franchises;
  animeSourceMappings: typeof animeSourceMappings;
  anilistCache: typeof anilistCache;
};
type LibraryDb = BaseSQLiteDatabase<"sync", void, LibrarySchema>;

export class LibraryRepository {
  constructor(private db: LibraryDb) {}

  upsertAnime(
    animeData: Omit<LibraryAnime, "id" | "lastSynced"> & { lastSynced?: string },
  ): LibraryAnime {
    const now = animeData.lastSynced ?? new Date().toISOString();

    let existingId: number | null = null;
    if (animeData.anilistId) {
      const existing = this.db
        .select({ id: anime.id })
        .from(anime)
        .where(eq(anime.anilistId, animeData.anilistId))
        .get();
      existingId = existing?.id ?? null;
    }

    if (existingId) {
      this.db
        .update(anime)
        .set({
          title: animeData.title,
          alternativeTitles: animeData.alternativeTitles ?? null,
          episodeCount: animeData.episodeCount,
          coverArtPath: animeData.coverArtPath ?? null,
          genres: animeData.genres ?? null,
          libraryState: animeData.libraryState ?? "not_on_disk",
          lastSynced: now,
        })
        .where(eq(anime.id, existingId))
        .run();
      return this.getAnime(existingId) as LibraryAnime;
    }

    const result = this.db
      .insert(anime)
      .values({
        title: animeData.title,
        alternativeTitles: animeData.alternativeTitles ?? null,
        episodeCount: animeData.episodeCount,
        coverArtPath: animeData.coverArtPath ?? null,
        genres: animeData.genres ?? null,
        libraryState: animeData.libraryState ?? "not_on_disk",
        lastSynced: now,
        anilistId: animeData.anilistId ?? null,
      })
      .returning()
      .get();

    return this.rowToAnime(result);
  }

  getAnime(id: number): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.id, id)).get();
    return row ? this.rowToAnime(row) : null;
  }

  updateAnime(
    id: number,
    fields: {
      title?: string;
      alternativeTitles?: string[];
      episodeCount?: number;
      coverArtPath?: string;
      genres?: string[];
      libraryState?: string;
    },
  ): void {
    this.db
      .update(anime)
      .set({
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.alternativeTitles !== undefined && {
          alternativeTitles: fields.alternativeTitles ?? null,
        }),
        ...(fields.episodeCount !== undefined && { episodeCount: fields.episodeCount }),
        ...(fields.coverArtPath !== undefined && { coverArtPath: fields.coverArtPath ?? null }),
        ...(fields.genres !== undefined && { genres: fields.genres ?? null }),
        ...(fields.libraryState !== undefined && { libraryState: fields.libraryState }),
      })
      .where(eq(anime.id, id))
      .run();
  }

  findAnime(externalId: string, sourceDb: string): LibraryAnime | null {
    const mapping = this.db
      .select({ animeId: animeSourceMappings.animeId })
      .from(animeSourceMappings)
      .where(
        and(
          eq(animeSourceMappings.externalId, externalId),
          eq(animeSourceMappings.source, sourceDb),
        ),
      )
      .get();
    if (!mapping) return null;
    return this.getAnime(mapping.animeId);
  }

  findAnimeByTitle(title: string): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.title, title)).get();
    return row ? this.rowToAnime(row) : null;
  }

  findAnimeByAnilistId(anilistId: string): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.anilistId, anilistId)).get();
    return row ? this.rowToAnime(row) : null;
  }

  createAnimeSourceMapping(data: { animeId: number; source: string; externalId: string }): void {
    this.db
      .insert(animeSourceMappings)
      .values({
        animeId: data.animeId,
        source: data.source,
        externalId: data.externalId,
      })
      .onConflictDoNothing()
      .run();
  }

  updateAnimeAnilistId(animeId: number, anilistId: string): void {
    this.db.update(anime).set({ anilistId }).where(eq(anime.id, animeId)).run();
  }

  findAnilistCacheByTitle(title: string): AnilistCacheEntry | null {
    const row = this.db.select().from(anilistCache).where(eq(anilistCache.title, title)).get();
    return row ? this.rowToAnilistCacheEntry(row) : null;
  }

  listAnime(): LibraryAnime[] {
    const rows = this.db
      .select({
        id: anime.id,
        title: anime.title,
        alternativeTitles: anime.alternativeTitles,
        episodeCount: anime.episodeCount,
        coverArtPath: anime.coverArtPath,
        genres: anime.genres,
        libraryState: anime.libraryState,
        franchiseId: anime.franchiseId,
        lastSynced: anime.lastSynced,
        anilistId: anime.anilistId,
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
          notes: episodeData.notes || null,
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

  setEpisodeNotes(episodeId: number, notes: string): LibraryEpisode | null {
    this.db
      .update(episodes)
      .set({ notes: notes || null })
      .where(eq(episodes.id, episodeId))
      .run();
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
    this.db.delete(animeSourceMappings).run();
    this.db.delete(anime).run();
  }

  getAllEpisodesWithAnime(): Array<{
    episodeId: number;
    animeId: number;
    anilistId: string | null;
    season: number | null;
    episodeNumber: number;
    watched: boolean;
  }> {
    return this.db
      .select({
        episodeId: episodes.id,
        animeId: anime.id,
        anilistId: anime.anilistId,
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

  migrateEpisodeNotes(episodeId: number, notes: string): void {
    this.db
      .update(episodes)
      .set({ notes: notes || null })
      .where(eq(episodes.id, episodeId))
      .run();
  }

  transaction<T>(fn: (repo: LibraryRepository) => T): T {
    return this.db.transaction((tx) => {
      const txRepo = new LibraryRepository(tx);
      return fn(txRepo);
    });
  }

  exportMatches(): Array<{
    anilistId: string | null;
    sourceDb: string;
    animeId: string;
    animeTitle: string;
    entryType: EntryType;
    episode: number;
    filePath: string;
    episodeTitle: string | null;
    season: number | null;
    groupId: number;
  }> {
    const rows = this.db
      .select({
        animeId: anime.id,
        anilistId: anime.anilistId,
        title: anime.title,
        entryType: episodeGroups.entryType,
        groupId: episodes.groupId,
        episodeNumber: episodes.episodeNumber,
        filePath: episodes.filePath,
        episodeTitle: episodes.title,
        season: episodes.season,
        sourceExternalId: animeSourceMappings.externalId,
        sourceDb: animeSourceMappings.source,
      })
      .from(anime)
      .innerJoin(episodes, eq(episodes.animeId, anime.id))
      .innerJoin(episodeGroups, eq(episodeGroups.id, episodes.groupId))
      .leftJoin(
        animeSourceMappings,
        and(
          eq(animeSourceMappings.animeId, anime.id),
          eq(
            animeSourceMappings.id,
            this.db
              .select({ id: sql<number>`min(${animeSourceMappings.id})` })
              .from(animeSourceMappings)
              .where(eq(animeSourceMappings.animeId, anime.id)),
          ),
        ),
      )
      .orderBy(anime.title, episodes.season, episodes.episodeNumber)
      .all();

    return rows.map((row) => ({
      anilistId: row.anilistId ?? null,
      sourceDb: row.sourceDb ?? "unknown",
      animeId: row.sourceExternalId ?? String(row.animeId),
      animeTitle: row.title,
      entryType: row.entryType as EntryType,
      episode: row.episodeNumber,
      filePath: row.filePath,
      episodeTitle: row.episodeTitle ?? null,
      season: row.season ?? null,
      groupId: row.groupId,
    }));
  }

  deleteAnime(id: number): void {
    this.db.delete(anime).where(eq(anime.id, id)).run();
  }

  mergeAnimeInto(pendingAnimeId: number, canonicalAnimeId: number): void {
    const pendingGroups = this.getEpisodeGroupsByAnimeId(pendingAnimeId);
    const canonicalGroups = this.getEpisodeGroupsByAnimeId(canonicalAnimeId);
    const canonicalGroupKeys = new Map<string, EpisodeGroup>();
    for (const g of canonicalGroups) {
      canonicalGroupKeys.set(`${g.entryType}:${g.seasonNumber ?? "null"}`, g);
    }

    for (const pendingGroup of pendingGroups) {
      const key = `${pendingGroup.entryType}:${pendingGroup.seasonNumber ?? "null"}`;
      const targetGroup = canonicalGroupKeys.get(key);

      if (targetGroup) {
        const pendingEpisodes = this.getEpisodesByGroupId(pendingGroup.id);
        for (const ep of pendingEpisodes) {
          const upsertedEpisode = this.upsertEpisodeFromMatch({
            animeId: canonicalAnimeId,
            groupId: targetGroup.id,
            episode: ep.episodeNumber,
            filePath: ep.filePath,
            title: ep.title,
            season: ep.season,
          });
          if (ep.watched) {
            this.setEpisodeWatched(upsertedEpisode.id, true);
          }
        }

        const pendingMappings = this.getTrackerMappingsByGroupId(pendingGroup.id);
        for (const mapping of pendingMappings) {
          this.upsertGroupTrackerMapping({
            groupId: targetGroup.id,
            source: mapping.source,
            externalId: mapping.externalId,
          });
        }
      } else {
        this.db
          .update(episodeGroups)
          .set({ animeId: canonicalAnimeId })
          .where(eq(episodeGroups.id, pendingGroup.id))
          .run();

        this.db
          .update(episodes)
          .set({ animeId: canonicalAnimeId })
          .where(eq(episodes.groupId, pendingGroup.id))
          .run();
      }
    }

    const pendingSourceMappings = this.db
      .select()
      .from(animeSourceMappings)
      .where(eq(animeSourceMappings.animeId, pendingAnimeId))
      .all();
    for (const mapping of pendingSourceMappings) {
      this.createAnimeSourceMapping({
        animeId: canonicalAnimeId,
        source: mapping.source,
        externalId: mapping.externalId,
      });
    }

    this.deleteAnime(pendingAnimeId);
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

  getAllEpisodeGroups(): EpisodeGroup[] {
    const rows = this.db.select().from(episodeGroups).all();
    return rows.map(this.rowToEpisodeGroup);
  }

  getAllTrackerMappings(): GroupTrackerMapping[] {
    const rows = this.db.select().from(groupTrackerMappings).all();
    return rows.map(this.rowToGroupTrackerMapping);
  }

  getFilesOnDiskByGroupId(groupId: number): number {
    const row = this.db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(episodes)
      .where(eq(episodes.groupId, groupId))
      .get();
    return row?.count ?? 0;
  }

  updateLibraryState(
    animeId: number,
    libraryState: "on_disk" | "partially_on_disk" | "not_on_disk",
  ): void {
    this.db.update(anime).set({ libraryState }).where(eq(anime.id, animeId)).run();
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

  updateEpisodeGroupStatusBatch(
    updates: Array<{ groupId: number; watchStatus: EpisodeGroup["watchStatus"] }>,
  ): void {
    if (updates.length === 0) return;

    for (const update of updates) {
      this.db
        .update(episodeGroups)
        .set({ watchStatus: update.watchStatus })
        .where(eq(episodeGroups.id, update.groupId))
        .run();
    }
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

  upsertAnimeBatch(
    items: Array<Omit<LibraryAnime, "id" | "lastSynced"> & { lastSynced?: string }>,
  ): LibraryAnime[] {
    if (items.length === 0) return [];
    const results: LibraryAnime[] = [];

    for (const item of items) {
      const result = this.upsertAnime(item);
      results.push(result);
    }

    return results;
  }

  upsertEpisodeGroupBatch(
    items: Array<Omit<EpisodeGroup, "id" | "lastSynced"> & { lastSynced?: string }>,
  ): EpisodeGroup[] {
    if (items.length === 0) return [];
    const now = new Date().toISOString();

    const rows = this.db
      .insert(episodeGroups)
      .values(
        items.map((item) => ({
          animeId: item.animeId,
          entryType: item.entryType,
          seasonNumber: item.seasonNumber ?? null,
          watchStatus: item.watchStatus,
          synopsis: item.synopsis ?? null,
          rating: item.rating ?? null,
          coverArtPath: item.coverArtPath ?? null,
          lastSynced: item.lastSynced ?? now,
        })),
      )
      .onConflictDoUpdate({
        target: [episodeGroups.animeId, episodeGroups.entryType, episodeGroups.seasonNumber],
        set: {
          watchStatus: sql.raw("excluded.watch_status"),
          synopsis: sql.raw("excluded.synopsis"),
          rating: sql.raw("excluded.rating"),
          coverArtPath: sql.raw("excluded.cover_art_path"),
          lastSynced: sql.raw("excluded.last_synced"),
        },
      })
      .returning()
      .all();

    return rows.map(this.rowToEpisodeGroup);
  }

  upsertGroupTrackerMappingBatch(items: GroupTrackerMapping[]): void {
    if (items.length === 0) return;

    this.db
      .insert(groupTrackerMappings)
      .values(
        items.map((item) => ({
          groupId: item.groupId,
          source: item.source,
          externalId: item.externalId,
        })),
      )
      .onConflictDoUpdate({
        target: [groupTrackerMappings.source, groupTrackerMappings.externalId],
        set: {
          groupId: sql.raw("excluded.group_id"),
        },
      })
      .run();
  }

  // Franchise operations

  createFranchise(data: {
    title: string;
    anilistId?: string;
    coverArtPath?: string;
    synopsis?: string;
  }): Franchise {
    const result = this.db
      .insert(franchises)
      .values({
        title: data.title,
        anilistId: data.anilistId ?? null,
        coverArtPath: data.coverArtPath ?? null,
        synopsis: data.synopsis ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();
    return this.rowToFranchise(result);
  }

  findFranchiseByAnilistId(anilistId: string): Franchise | null {
    const row = this.db.select().from(franchises).where(eq(franchises.anilistId, anilistId)).get();
    return row ? this.rowToFranchise(row) : null;
  }

  assignAnimeToFranchise(animeId: number, franchiseId: number): void {
    this.db.update(anime).set({ franchiseId }).where(eq(anime.id, animeId)).run();
  }

  getFranchiseById(id: number): Franchise | null {
    const row = this.db.select().from(franchises).where(eq(franchises.id, id)).get();
    return row ? this.rowToFranchise(row) : null;
  }

  getFranchises(): Franchise[] {
    const rows = this.db.select().from(franchises).orderBy(franchises.title).all();
    return rows.map(this.rowToFranchise);
  }

  // Anime source mapping operations

  findAnimeSourceMapping(source: string, externalId: string): AnimeSourceMapping | null {
    const row = this.db
      .select()
      .from(animeSourceMappings)
      .where(
        and(eq(animeSourceMappings.source, source), eq(animeSourceMappings.externalId, externalId)),
      )
      .get();
    return row ? this.rowToAnimeSourceMapping(row) : null;
  }

  getAnimeSourceMappingsByAnimeId(animeId: number): AnimeSourceMapping[] {
    const rows = this.db
      .select()
      .from(animeSourceMappings)
      .where(eq(animeSourceMappings.animeId, animeId))
      .all();
    return rows.map(this.rowToAnimeSourceMapping);
  }

  hasAnimeSourceMapping(animeId: number, source: string): boolean {
    return (
      this.db
        .select({ id: animeSourceMappings.id })
        .from(animeSourceMappings)
        .where(
          and(eq(animeSourceMappings.animeId, animeId), eq(animeSourceMappings.source, source)),
        )
        .get() !== undefined
    );
  }

  getAnimeSourceMapping(animeId: number, source: string): AnimeSourceMapping | null {
    const row = this.db
      .select()
      .from(animeSourceMappings)
      .where(and(eq(animeSourceMappings.animeId, animeId), eq(animeSourceMappings.source, source)))
      .get();
    return row ? this.rowToAnimeSourceMapping(row) : null;
  }

  getAllAnimeSourceMappings(): AnimeSourceMapping[] {
    const rows = this.db.select().from(animeSourceMappings).all();
    return rows.map(this.rowToAnimeSourceMapping);
  }

  // AniList cache operations

  getAnilistCacheEntry(anilistId: string): AnilistCacheEntry | null {
    const row = this.db
      .select()
      .from(anilistCache)
      .where(eq(anilistCache.anilistId, anilistId))
      .get();
    return row ? this.rowToAnilistCacheEntry(row) : null;
  }

  setAnilistCacheEntry(entry: AnilistCacheEntry): void {
    const serializedRelations = JSON.stringify(entry.relations);
    const serializedExternalLinks = entry.externalLinks
      ? JSON.stringify(entry.externalLinks)
      : null;
    this.db
      .insert(anilistCache)
      .values({
        anilistId: entry.anilistId,
        title: entry.title,
        format: entry.format,
        episodes: entry.episodes,
        relations: serializedRelations,
        externalLinks: serializedExternalLinks,
        fetchedAt: entry.fetchedAt,
      })
      .onConflictDoUpdate({
        target: [anilistCache.anilistId],
        set: {
          title: entry.title,
          format: entry.format,
          episodes: entry.episodes,
          relations: serializedRelations,
          externalLinks: serializedExternalLinks,
          fetchedAt: entry.fetchedAt,
        },
      })
      .run();
  }

  getUncachedAnilistIds(anilistIds: string[]): string[] {
    if (anilistIds.length === 0) return [];
    const cached = this.db
      .select({ anilistId: anilistCache.anilistId })
      .from(anilistCache)
      .where(
        sql`${anilistCache.anilistId} IN (${sql.join(
          anilistIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .all();
    const cachedSet = new Set(cached.map((row) => row.anilistId));
    return anilistIds.filter((id) => !cachedSet.has(id));
  }

  // Known AniList IDs from group tracker mappings

  getKnownAnilistIds(): Map<string, number[]> {
    const rows = this.db
      .select({
        anilistId: groupTrackerMappings.externalId,
        animeId: anime.id,
      })
      .from(groupTrackerMappings)
      .innerJoin(episodeGroups, eq(episodeGroups.id, groupTrackerMappings.groupId))
      .innerJoin(anime, eq(anime.id, episodeGroups.animeId))
      .where(eq(groupTrackerMappings.source, "anilist"))
      .all();

    const result = new Map<string, number[]>();
    for (const row of rows) {
      const existing = result.get(row.anilistId);
      if (existing) {
        existing.push(row.animeId);
      } else {
        result.set(row.anilistId, [row.animeId]);
      }
    }
    return result;
  }

  // Known AniList IDs from anime source mappings

  getAnimeAnilistIds(): Map<string, number[]> {
    const rows = this.db
      .select({
        anilistId: animeSourceMappings.externalId,
        animeId: animeSourceMappings.animeId,
      })
      .from(animeSourceMappings)
      .where(eq(animeSourceMappings.source, "anilist"))
      .all();

    const result = new Map<string, number[]>();
    for (const row of rows) {
      const existing = result.get(row.anilistId);
      if (existing) {
        existing.push(row.animeId);
      } else {
        result.set(row.anilistId, [row.animeId]);
      }
    }
    return result;
  }

  // Pending identification

  findPendingAnime(): LibraryAnime[] {
    const rows = this.db.select().from(anime).where(isNull(anime.anilistId)).all();
    return rows.map(this.rowToAnime);
  }

  // Anime enrichment status

  getUnenrichedAnimeIds(): number[] {
    const rows = this.db
      .select({ id: anime.id })
      .from(anime)
      .where(
        and(
          isNull(anime.franchiseId),
          sql`${anime.id} NOT IN (SELECT anime_id FROM anime_source_mappings)`,
        ),
      )
      .all();
    return rows.map((row) => row.id);
  }

  private rowToAnime(row: {
    id: number;
    title: string;
    alternativeTitles: string[] | null;
    episodeCount: number;
    coverArtPath: string | null;
    genres: string[] | null;
    libraryState: string;
    franchiseId: number | null;
    lastSynced: string;
    anilistId: string | null;
  }): LibraryAnime {
    return {
      id: row.id,
      title: row.title,
      alternativeTitles: row.alternativeTitles ?? undefined,
      episodeCount: row.episodeCount,
      coverArtPath: row.coverArtPath ?? undefined,
      genres: row.genres ?? undefined,
      libraryState: row.libraryState as LibraryAnime["libraryState"],
      franchiseId: row.franchiseId ?? undefined,
      lastSynced: row.lastSynced,
      anilistId: row.anilistId ?? undefined,
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
    notes: string | null;
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
      notes: row.notes ?? undefined,
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

  private rowToFranchise(row: {
    id: number;
    title: string;
    anilistId: string | null;
    coverArtPath: string | null;
    synopsis: string | null;
    createdAt: string;
  }): Franchise {
    return {
      id: row.id,
      title: row.title,
      anilistId: row.anilistId,
      coverArtPath: row.coverArtPath,
      synopsis: row.synopsis,
      createdAt: row.createdAt,
    };
  }

  private rowToAnimeSourceMapping(row: {
    id: number;
    animeId: number;
    source: string;
    externalId: string;
  }): AnimeSourceMapping {
    return {
      id: row.id,
      animeId: row.animeId,
      source: row.source,
      externalId: row.externalId,
    };
  }

  private rowToAnilistCacheEntry(row: {
    anilistId: string;
    title: string;
    format: string | null;
    episodes: number | null;
    relations: string;
    externalLinks: string | null;
    fetchedAt: string;
  }): AnilistCacheEntry {
    return {
      anilistId: row.anilistId,
      title: row.title,
      format: row.format,
      episodes: row.episodes,
      relations: JSON.parse(row.relations) as EnrichmentRelation[],
      externalLinks: row.externalLinks
        ? (JSON.parse(row.externalLinks) as { site: string; id: string }[])
        : null,
      fetchedAt: row.fetchedAt,
    };
  }
}
