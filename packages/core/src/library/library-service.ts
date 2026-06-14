import { existsSync } from "node:fs";
import { dirname } from "node:path";
import type { MatchEntry } from "../types";
import type {
  LibraryAnime,
  LibraryEpisode,
  LibraryRepository,
  WatchStatus,
} from "./library-repository";

export class LibraryService {
  constructor(private library: LibraryRepository) {}

  listAnime(): LibraryAnime[] {
    return this.library.listAnime();
  }

  getAnime(id: number): LibraryAnime | null {
    return this.library.getAnime(id);
  }

  findAnime(externalId: string, sourceDb: string): LibraryAnime | null {
    return this.library.findAnime(externalId, sourceDb);
  }

  findAnimeByTitle(title: string, sourceDb: string): LibraryAnime | null {
    return this.library.findAnimeByTitle(title, sourceDb);
  }

  getEpisodesByAnimeId(animeId: number): LibraryEpisode[] {
    return this.library.getEpisodesByAnimeId(animeId);
  }

  getWatchStatus(episodeId: number): WatchStatus | null {
    return this.library.getWatchStatus(episodeId);
  }

  getWatchStatusByAnimeId(animeId: number): WatchStatus[] {
    return this.library.getWatchStatusByAnimeId(animeId);
  }

  setWatchStatus(episodeId: number, watched: boolean, notes?: string): WatchStatus {
    return this.library.setWatchStatus(episodeId, watched, notes);
  }

  getStats(): { animeCount: number; episodeCount: number } {
    return this.library.getStats();
  }

  upsertAnime(data: Omit<LibraryAnime, "id" | "lastSynced">): LibraryAnime {
    return this.library.upsertAnime(data);
  }

  getAnimeDir(animeId: number): string | null {
    const episodes = this.library.getEpisodesByAnimeId(animeId);
    if (episodes.length === 0) return null;
    const paths = episodes.map((ep) => ep.filePath);
    const first = paths[0];
    if (!first) return null;
    if (paths.length === 1) return dirname(first);
    let commonParent = dirname(first);
    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];
      if (!path) continue;
      while (commonParent && !path.startsWith(commonParent)) {
        commonParent = dirname(commonParent);
      }
    }
    return commonParent;
  }

  updateCoverArtPath(animeId: number, coverArtPath: string): void {
    const existing = this.library.getAnime(animeId);
    if (!existing) return;
    this.library.upsertAnime({
      externalId: existing.externalId,
      sourceDb: existing.sourceDb,
      title: existing.title,
      titleJapanese: existing.titleJapanese,
      entryType: existing.entryType,
      episodeCount: existing.episodeCount,
      coverArtPath,
    });
  }

  isAnimeInLibrary(externalId: string, sourceDb = "tvdb"): boolean {
    return this.library.findAnime(externalId, sourceDb) !== null;
  }

  exportMatches(): MatchEntry[] {
    return this.library.exportMatches().map((row) => ({
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

  rebuild(sourceDb?: string): void {
    const allMatches = this.exportMatches();
    const filtered = sourceDb ? allMatches.filter((m) => m.sourceDb === sourceDb) : allMatches;
    const matches = filtered.filter((m) => existsSync(m.filePath));
    this.rebuildFromMatches(matches);
  }

  rebuildFromMatches(matches: MatchEntry[]): void {
    this.library.transaction((tx) => {
      const oldState = tx.getAllEpisodesWithAnime();

      const oldEpisodeKey = new Map<string, number>();
      for (const row of oldState) {
        const key = `${row.animeExternalId}:${row.animeSourceDb}:${row.season ?? 1}:${row.episodeNumber}`;
        oldEpisodeKey.set(key, row.episodeId);
      }

      const oldStatuses = new Map<number, { watched: boolean; notes: string | null }>();
      for (const row of oldState) {
        if (row.watched !== null) {
          oldStatuses.set(row.episodeId, { watched: row.watched, notes: row.notes });
        }
      }

      tx.deleteAll();

      const now = new Date().toISOString();
      const animeIds = new Set<number>();

      for (const match of matches) {
        const libraryAnime = tx.upsertAnime({
          externalId: match.animeId,
          sourceDb: match.sourceDb,
          title: match.animeTitle,
          entryType: match.entryType,
          episodeCount: 0,
          lastSynced: now,
        });
        const animeId = libraryAnime.id;

        animeIds.add(animeId);

        if (match.episode !== null && match.filePath) {
          const epResult = tx.upsertEpisodeFromMatch({
            animeId,
            episode: match.episode,
            filePath: match.filePath,
            title: match.title,
            season: match.season,
          });

          const oldKey = `${match.animeId}:${match.sourceDb}:${match.season ?? 1}:${match.episode}`;
          const oldEpId = oldEpisodeKey.get(oldKey);
          if (oldEpId !== undefined) {
            const oldStatus = oldStatuses.get(oldEpId);
            if (oldStatus) {
              tx.migrateWatchStatus(epResult.id, oldStatus.watched, oldStatus.notes, now);
            }
          }
        }
      }

      for (const id of animeIds) {
        tx.updateEpisodeCount(id);
      }
    });
  }

  mergeFromMatches(matches: MatchEntry[]): void {
    const grouped = new Map<string, MatchEntry[]>();
    for (const match of matches) {
      const key = `${match.animeTitle}\0${match.sourceDb}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(key, [match]);
      }
    }

    this.library.transaction((tx) => {
      const newFilePaths = new Set<string>();
      const sourceDbs = new Set<string>();
      for (const match of matches) {
        if (match.filePath) {
          newFilePaths.add(match.filePath);
        }
        sourceDbs.add(match.sourceDb);
      }

      if (newFilePaths.size > 0) {
        const excludeSourceDb = sourceDbs.size === 1 ? sourceDbs.values().next().value : undefined;
        this.deleteStaleEpisodes(tx, newFilePaths, excludeSourceDb);
      }

      this.deleteAnimeFromOtherSourceDbs(tx, sourceDbs);

      for (const [, group] of grouped) {
        const first = group[0];
        if (!first) continue;

        const canonicalId =
          group
            .map((m) => m.animeId)
            .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))[0] ?? first.animeId;

        let libraryAnime =
          tx.findAnimeByTitle(first.animeTitle, first.sourceDb) ??
          tx.findAnime(canonicalId, first.sourceDb);
        if (libraryAnime) {
          if (Number.parseInt(canonicalId, 10) < Number.parseInt(libraryAnime.externalId, 10)) {
            libraryAnime = tx.upsertAnime({
              externalId: canonicalId,
              sourceDb: first.sourceDb,
              title: first.animeTitle,
              entryType: first.entryType,
              episodeCount: 0,
            });
          }
        } else {
          libraryAnime = tx.upsertAnime({
            externalId: canonicalId,
            sourceDb: first.sourceDb,
            title: first.animeTitle,
            entryType: first.entryType,
            episodeCount: 0,
          });
        }

        for (const match of group) {
          if (match.episode !== null && match.filePath) {
            tx.upsertEpisodeFromMatch({
              animeId: libraryAnime.id,
              episode: match.episode,
              filePath: match.filePath,
              title: match.title,
              season: match.season,
            });
          }
        }

        tx.updateEpisodeCount(libraryAnime.id);
      }
    });
  }

  private deleteAnimeFromOtherSourceDbs(tx: LibraryRepository, newSourceDbs: Set<string>): void {
    const allAnime = tx.listAnime();
    const animeToDelete: number[] = [];
    for (const entry of allAnime) {
      if (!newSourceDbs.has(entry.sourceDb)) {
        animeToDelete.push(entry.id);
      }
    }
    if (animeToDelete.length > 0) {
      tx.deleteAnimeByIds(animeToDelete);
    }
  }

  private deleteStaleEpisodes(
    tx: LibraryRepository,
    filePaths: Set<string>,
    excludeSourceDb?: string,
  ): void {
    const allEpisodes = tx.getEpisodesWithSourceDb();

    const episodeIdsToDelete: number[] = [];
    const affectedAnimeIds = new Set<number>();

    for (const ep of allEpisodes) {
      if (filePaths.has(ep.filePath) && ep.sourceDb !== excludeSourceDb) {
        episodeIdsToDelete.push(ep.id);
        affectedAnimeIds.add(ep.animeId);
      }
    }

    tx.deleteEpisodesByIds(episodeIdsToDelete);

    const orphanedAnimeIds: number[] = [];
    for (const animeId of affectedAnimeIds) {
      if (tx.getEpisodeCountByAnimeId(animeId) === 0) {
        orphanedAnimeIds.push(animeId);
      }
    }

    tx.deleteAnimeByIds(orphanedAnimeIds);
  }
}
