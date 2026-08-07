import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import type { EntryType, MatchEntry } from "../types";
import { EpisodeRepository } from "./episode-repository";
import { GroupRepository } from "./group-repository";
import type { LibraryDb } from "./schema";
import { anime, animeSourceMappings, episodeGroups, episodes } from "./schema";

export interface LibraryAnime {
  id: number;
  title: string;
  alternativeTitles?: string[];
  filesOnDisk?: number;
  coverArtPath?: string;
  franchiseId?: number;
  anidbId?: string;
  format?: string;
  updatedAt: string;
}

export interface AnimeSourceMapping {
  animeId: number;
  source: string;
  externalId: string;
}

export interface AnimeRepositoryDeps {
  db: LibraryDb;
}

export interface TransactionRepos {
  anime: AnimeRepository;
  episodes: EpisodeRepository;
  groups: GroupRepository;
}

export class AnimeRepository {
  private db: LibraryDb;

  constructor(deps: AnimeRepositoryDeps) {
    this.db = deps.db;
  }

  transaction<T>(fn: (repos: TransactionRepos) => T): T {
    return this.db.transaction((txDb) => {
      const repos: TransactionRepos = {
        anime: new AnimeRepository({ db: txDb as LibraryDb }),
        episodes: new EpisodeRepository({ db: txDb as LibraryDb }),
        groups: new GroupRepository({ db: txDb as LibraryDb }),
      };
      return fn(repos);
    });
  }

  upsertAnime(
    animeData: Omit<LibraryAnime, "id" | "updatedAt"> & {
      updatedAt?: string;
    },
  ): LibraryAnime {
    const updatedAt = animeData.updatedAt ?? new Date().toISOString();

    let existingId: number | null = null;
    if (animeData.anidbId) {
      const existing = this.db
        .select({ id: anime.id })
        .from(anime)
        .where(eq(anime.anidbId, animeData.anidbId))
        .get();
      existingId = existing?.id ?? null;
    }

    if (existingId) {
      this.db
        .update(anime)
        .set({
          title: animeData.title,
          alternativeTitles: animeData.alternativeTitles ?? null,
          coverArtPath: animeData.coverArtPath ?? null,
          anidbId: animeData.anidbId ?? null,
          format: animeData.format ?? null,
          updatedAt,
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
        coverArtPath: animeData.coverArtPath ?? null,
        anidbId: animeData.anidbId ?? null,
        format: animeData.format ?? null,
        updatedAt,
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
      coverArtPath?: string;
      anidbId?: string | null;
      format?: string | null;
    },
  ): void {
    this.db
      .update(anime)
      .set({
        ...(fields.title !== undefined && { title: fields.title }),
        ...(fields.alternativeTitles !== undefined && {
          alternativeTitles: fields.alternativeTitles ?? null,
        }),
        ...(fields.coverArtPath !== undefined && { coverArtPath: fields.coverArtPath ?? null }),
        ...(fields.anidbId !== undefined && { anidbId: fields.anidbId ?? null }),
        ...(fields.format !== undefined && { format: fields.format ?? null }),
      })
      .where(eq(anime.id, id))
      .run();
  }

  findAnime(externalId: string, source: string): LibraryAnime | null {
    const mapping = this.db
      .select({ animeId: animeSourceMappings.animeId })
      .from(animeSourceMappings)
      .where(
        and(eq(animeSourceMappings.externalId, externalId), eq(animeSourceMappings.source, source)),
      )
      .get();
    if (!mapping) return null;
    return this.getAnime(mapping.animeId);
  }

  findAnimeByTitle(title: string): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.title, title)).get();
    return row ? this.rowToAnime(row) : null;
  }

  findAnimeByAnidbId(anidbId: string): LibraryAnime | null {
    const row = this.db.select().from(anime).where(eq(anime.anidbId, anidbId)).get();
    return row ? this.rowToAnime(row) : null;
  }

  listAnime(): LibraryAnime[] {
    const rows = this.db
      .select({
        id: anime.id,
        title: anime.title,
        alternativeTitles: anime.alternativeTitles,
        coverArtPath: anime.coverArtPath,
        franchiseId: anime.franchiseId,
        anidbId: anime.anidbId,
        format: anime.format,
        updatedAt: anime.updatedAt,
        filesOnDisk: sql<number>`cast(count(${episodes.id}) as int)`,
      })
      .from(anime)
      .leftJoin(episodeGroups, eq(episodeGroups.animeId, anime.id))
      .leftJoin(episodes, eq(episodes.groupId, episodeGroups.id))
      .groupBy(anime.id)
      .orderBy(anime.title)
      .all();

    return rows.map((row) => ({
      ...this.rowToAnime(row),
      filesOnDisk: row.filesOnDisk,
    }));
  }

  deleteAnime(id: number): void {
    this.db.delete(anime).where(eq(anime.id, id)).run();
  }

  deleteAnimeByIds(ids: number[]): void {
    if (ids.length === 0) return;
    this.db.delete(anime).where(sql`${anime.id} IN ${ids}`).run();
  }

  upsertAnimeBatch(
    items: Array<
      Omit<LibraryAnime, "id" | "updatedAt"> & {
        updatedAt?: string;
      }
    >,
  ): LibraryAnime[] {
    if (items.length === 0) return [];
    const results: LibraryAnime[] = [];

    for (const item of items) {
      const result = this.upsertAnime(item);
      results.push(result);
    }

    return results;
  }

  updateAnimeAnidbId(animeId: number, anidbId: string): void {
    this.db.update(anime).set({ anidbId }).where(eq(anime.id, animeId)).run();
  }

  findPendingAnime(): LibraryAnime[] {
    const rows = this.db
      .select()
      .from(anime)
      .where(
        or(isNull(anime.anidbId), like(anime.anidbId, "temp:%"), like(anime.anidbId, "tracker:%")),
      )
      .all();
    return rows.map(this.rowToAnime);
  }

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

  deleteAll(): void {
    this.db.delete(animeSourceMappings).run();
    this.db.delete(anime).run();
  }

  createAnimeSourceMapping(data: { animeId: number; source: string; externalId: string }): void {
    this.db
      .insert(animeSourceMappings)
      .values({
        animeId: data.animeId,
        source: data.source,
        externalId: data.externalId,
      })
      .onConflictDoUpdate({
        target: [animeSourceMappings.animeId, animeSourceMappings.source],
        set: { externalId: data.externalId },
      })
      .run();
  }

  findAnimeSourceMapping(source: string, externalId: string): AnimeSourceMapping | null {
    return (
      this.db
        .select()
        .from(animeSourceMappings)
        .where(
          and(
            eq(animeSourceMappings.source, source),
            eq(animeSourceMappings.externalId, externalId),
          ),
        )
        .get() ?? null
    );
  }

  getAnimeSourceMappingsByAnimeId(animeId: number): AnimeSourceMapping[] {
    return this.db
      .select()
      .from(animeSourceMappings)
      .where(eq(animeSourceMappings.animeId, animeId))
      .all();
  }

  hasAnimeSourceMapping(animeId: number, source: string): boolean {
    return (
      this.db
        .select({ animeId: animeSourceMappings.animeId })
        .from(animeSourceMappings)
        .where(
          and(eq(animeSourceMappings.animeId, animeId), eq(animeSourceMappings.source, source)),
        )
        .get() !== undefined
    );
  }

  getAnimeSourceMapping(animeId: number, source: string): AnimeSourceMapping | null {
    return (
      this.db
        .select()
        .from(animeSourceMappings)
        .where(
          and(eq(animeSourceMappings.animeId, animeId), eq(animeSourceMappings.source, source)),
        )
        .get() ?? null
    );
  }

  getAllAnimeSourceMappings(): AnimeSourceMapping[] {
    return this.db.select().from(animeSourceMappings).all();
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

  exportMatches(): Array<{
    anidbId: string | null;
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
        anidbId: anime.anidbId,
        title: anime.title,
        entryType: episodeGroups.entryType,
        seasonNumber: episodeGroups.seasonNumber,
        groupId: episodes.groupId,
        episodeNumber: episodes.episodeNumber,
        filePath: episodes.filePath,
        episodeTitle: episodes.title,
        sourceExternalId: animeSourceMappings.externalId,
        sourceDb: animeSourceMappings.source,
      })
      .from(anime)
      .innerJoin(episodeGroups, eq(episodeGroups.animeId, anime.id))
      .innerJoin(episodes, eq(episodes.groupId, episodeGroups.id))
      .leftJoin(
        animeSourceMappings,
        and(
          eq(animeSourceMappings.animeId, anime.id),
          eq(
            animeSourceMappings.source,
            this.db
              .select({ source: sql<string>`min(${animeSourceMappings.source})` })
              .from(animeSourceMappings)
              .where(eq(animeSourceMappings.animeId, anime.id)),
          ),
        ),
      )
      .orderBy(anime.title, episodes.episodeNumber)
      .all();

    return rows.map((row) => ({
      anidbId: row.anidbId ?? null,
      sourceDb: row.sourceDb ?? "unknown",
      animeId: row.sourceExternalId ?? String(row.animeId),
      animeTitle: row.title,
      entryType: row.entryType as EntryType,
      episode: row.episodeNumber,
      filePath: row.filePath,
      episodeTitle: row.episodeTitle ?? null,
      season: row.seasonNumber ?? 1,
      groupId: row.groupId,
    }));
  }

  private rowToAnime(row: {
    id: number;
    title: string;
    alternativeTitles: string[] | null;
    coverArtPath: string | null;
    franchiseId: number | null;
    anidbId: string | null;
    format: string | null;
    updatedAt: string;
  }): LibraryAnime {
    return {
      id: row.id,
      title: row.title,
      alternativeTitles: row.alternativeTitles ?? undefined,
      coverArtPath: row.coverArtPath ?? undefined,
      franchiseId: row.franchiseId ?? undefined,
      anidbId: row.anidbId ?? undefined,
      format: row.format ?? undefined,
      updatedAt: row.updatedAt,
    };
  }
}

export function resolveAnidbIdByTitle(anime: AnimeRepository, title: string): string | null {
  const titleLower = title.toLowerCase();
  const allAnime = anime.listAnime();
  for (const a of allAnime) {
    if (a.title.toLowerCase() === titleLower && a.anidbId) {
      return a.anidbId;
    }
    if (a.alternativeTitles) {
      for (const alt of a.alternativeTitles) {
        if (alt.toLowerCase() === titleLower && a.anidbId) {
          return a.anidbId;
        }
      }
    }
  }
  return null;
}

export function exportMatchesFromRepo(anime: AnimeRepository): MatchEntry[] {
  return anime.exportMatches().map((row) => ({
    animeId: row.animeId,
    animeTitle: row.animeTitle,
    entryType: row.entryType,
    episodeId: null,
    episode: row.episode,
    season: row.season,
    title: row.episodeTitle,
    filePath: row.filePath,
    sourceDb: row.sourceDb,
  }));
}
