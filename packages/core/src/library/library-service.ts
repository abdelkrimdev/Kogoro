import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { stripTypeDir } from "../config/schema";
import type { EntryType, MatchEntry } from "../types";
import type {
  EpisodeGroup,
  GroupTrackerMapping,
  LibraryAnime,
  LibraryEpisode,
  LibraryRepository,
} from "./library-repository";
import { computeLibraryState, type GroupFilesOnDisk } from "./library-state";

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
    if (commonParent) {
      commonParent = stripTypeDir(commonParent);
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
      episodeCount: existing.episodeCount,
      coverArtPath,
      genres: existing.genres,
      libraryState: existing.libraryState,
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

      const oldWatched = new Map<number, boolean>();
      for (const row of oldState) {
        oldWatched.set(row.episodeId, row.watched);
      }

      const oldGroups = tx.getAllEpisodeGroups();
      const oldAnimeById = new Map<number, { externalId: string; sourceDb: string }>();
      const allAnime = tx.listAnime();
      for (const a of allAnime) {
        oldAnimeById.set(a.id, { externalId: a.externalId, sourceDb: a.sourceDb });
      }

      const groupCompositeKey = (
        animeExternalId: string,
        sourceDb: string,
        entryType: string,
        seasonNumber: number | undefined,
      ) => `${animeExternalId}:${sourceDb}:${entryType}:${seasonNumber ?? "null"}`;

      const groupStateByKey = new Map<
        string,
        {
          watchStatus: EpisodeGroup["watchStatus"];
          synopsis?: string;
          rating?: number;
          coverArtPath?: string;
        }
      >();
      for (const group of oldGroups) {
        const animeInfo = oldAnimeById.get(group.animeId);
        if (!animeInfo) continue;
        const key = groupCompositeKey(
          animeInfo.externalId,
          animeInfo.sourceDb,
          group.entryType,
          group.seasonNumber,
        );
        groupStateByKey.set(key, {
          watchStatus: group.watchStatus,
          synopsis: group.synopsis,
          rating: group.rating,
          coverArtPath: group.coverArtPath,
        });
      }

      const oldMappings = tx.getAllTrackerMappings();
      const mappingsByKey = new Map<string, GroupTrackerMapping[]>();
      for (const mapping of oldMappings) {
        const group = oldGroups.find((g) => g.id === mapping.groupId);
        if (!group) continue;
        const animeInfo = oldAnimeById.get(group.animeId);
        if (!animeInfo) continue;
        const compositeKey = groupCompositeKey(
          animeInfo.externalId,
          animeInfo.sourceDb,
          group.entryType,
          group.seasonNumber,
        );
        const existing = mappingsByKey.get(compositeKey);
        if (existing) {
          existing.push({ groupId: 0, source: mapping.source, externalId: mapping.externalId });
        } else {
          mappingsByKey.set(compositeKey, [
            { groupId: 0, source: mapping.source, externalId: mapping.externalId },
          ]);
        }
      }

      tx.deleteAll();

      const now = new Date().toISOString();
      const animeIds = new Set<number>();

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      for (const match of matches) {
        const libraryAnime = tx.upsertAnime({
          externalId: match.animeId,
          sourceDb: match.sourceDb,
          title: match.animeTitle,
          episodeCount: 0,
          lastSynced: now,
        });
        const animeId = libraryAnime.id;

        animeIds.add(animeId);

        if (match.episode !== null && match.filePath) {
          const seasonNum = match.season ?? 1;
          const groupKey = `${animeId}:${match.entryType}:${seasonNum}`;

          let groupEntry = groupKeyToGroup.get(groupKey);
          if (!groupEntry) {
            const compositeKey = groupCompositeKey(
              match.animeId,
              match.sourceDb,
              match.entryType,
              match.season ?? 1,
            );
            const savedState = groupStateByKey.get(compositeKey);

            const group = tx.upsertEpisodeGroup({
              animeId,
              entryType: match.entryType as EntryType,
              seasonNumber: seasonNum,
              watchStatus: savedState?.watchStatus ?? "plan_to_watch",
              synopsis: savedState?.synopsis,
              rating: savedState?.rating,
              coverArtPath: savedState?.coverArtPath,
              lastSynced: now,
            });
            groupEntry = { animeId, groupId: group.id };
            groupKeyToGroup.set(groupKey, groupEntry);

            const savedMappings = mappingsByKey.get(compositeKey);
            if (savedMappings) {
              for (const mapping of savedMappings) {
                tx.upsertGroupTrackerMapping({
                  groupId: group.id,
                  source: mapping.source,
                  externalId: mapping.externalId,
                });
              }
            }
          }

          const epResult = tx.upsertEpisodeFromMatch({
            animeId,
            groupId: groupEntry.groupId,
            episode: match.episode,
            filePath: match.filePath,
            title: match.title,
            season: match.season,
          });

          const oldKey = `${match.animeId}:${match.sourceDb}:${match.season ?? 1}:${match.episode}`;
          const oldEpId = oldEpisodeKey.get(oldKey);
          if (oldEpId !== undefined) {
            const oldWatchedValue = oldWatched.get(oldEpId);
            if (oldWatchedValue !== undefined) {
              tx.migrateEpisodeWatched(epResult.id, oldWatchedValue);
            }
          }
        }
      }

      for (const id of animeIds) {
        tx.updateEpisodeCount(id);
      }

      for (const id of animeIds) {
        this.computeAndPersistLibraryState(id, tx);
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

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      const affectedAnimeIds = new Set<number>();

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
              episodeCount: 0,
            });
          }
        } else {
          libraryAnime = tx.upsertAnime({
            externalId: canonicalId,
            sourceDb: first.sourceDb,
            title: first.animeTitle,
            episodeCount: 0,
          });
        }

        affectedAnimeIds.add(libraryAnime.id);

        for (const match of group) {
          if (match.episode !== null && match.filePath) {
            const seasonNum = match.season ?? 1;
            const groupKey = `${libraryAnime.id}:${match.entryType}:${seasonNum}`;

            let groupEntry = groupKeyToGroup.get(groupKey);
            if (!groupEntry) {
              const existingGroup = tx.findEpisodeGroup(
                libraryAnime.id,
                match.entryType,
                seasonNum,
              );
              const group = existingGroup
                ? tx.upsertEpisodeGroup({
                    animeId: libraryAnime.id,
                    entryType: match.entryType as EntryType,
                    seasonNumber: seasonNum,
                    watchStatus: existingGroup.watchStatus,
                    lastSynced: new Date().toISOString(),
                  })
                : tx.upsertEpisodeGroup({
                    animeId: libraryAnime.id,
                    entryType: match.entryType as EntryType,
                    seasonNumber: seasonNum,
                    watchStatus: "plan_to_watch",
                  });
              groupEntry = { animeId: libraryAnime.id, groupId: group.id };
              groupKeyToGroup.set(groupKey, groupEntry);
            }

            tx.upsertEpisodeFromMatch({
              animeId: libraryAnime.id,
              groupId: groupEntry.groupId,
              episode: match.episode,
              filePath: match.filePath,
              title: match.title,
              season: match.season,
            });
          }
        }

        tx.updateEpisodeCount(libraryAnime.id);
      }

      for (const id of affectedAnimeIds) {
        this.computeAndPersistLibraryState(id, tx);
      }
    });
  }

  // Episode Groups

  getEpisodeGroupsByAnimeId(animeId: number): EpisodeGroup[] {
    return this.library.getEpisodeGroupsByAnimeId(animeId);
  }

  getEpisodeGroup(id: number): EpisodeGroup | null {
    return this.library.getEpisodeGroup(id);
  }

  upsertEpisodeGroup(data: Omit<EpisodeGroup, "id" | "lastSynced">): EpisodeGroup {
    return this.library.upsertEpisodeGroup(data);
  }

  setGroupWatchStatus(groupId: number, status: EpisodeGroup["watchStatus"]): EpisodeGroup | null {
    return this.library.updateEpisodeGroupStatus(groupId, status);
  }

  updateEpisodeGroupMetadata(
    groupId: number,
    metadata: { synopsis?: string; rating?: number; coverArtPath?: string },
  ): EpisodeGroup | null {
    return this.library.updateEpisodeGroupMetadata(groupId, metadata);
  }

  deleteEpisodeGroup(groupId: number): void {
    this.library.deleteEpisodeGroup(groupId);
  }

  getEpisodesByGroupId(groupId: number): LibraryEpisode[] {
    return this.library.getEpisodesByGroupId(groupId);
  }

  getAllEpisodeGroups(): EpisodeGroup[] {
    return this.library.getAllEpisodeGroups();
  }

  getAllTrackerMappings(): GroupTrackerMapping[] {
    return this.library.getAllTrackerMappings();
  }

  computeAndPersistLibraryState(animeId: number, repo?: LibraryRepository): void {
    const r = repo ?? this.library;
    const groups = r.getEpisodeGroupsByAnimeId(animeId);
    const groupFiles: GroupFilesOnDisk[] = groups.map((g) => ({
      groupId: g.id,
      filesOnDisk: r.getFilesOnDiskByGroupId(g.id),
    }));
    const state = computeLibraryState(groupFiles);
    r.updateLibraryState(animeId, state);
  }

  // Tracker Mappings

  getTrackerMappingsByGroupId(groupId: number): GroupTrackerMapping[] {
    return this.library.getTrackerMappingsByGroupId(groupId);
  }

  upsertGroupTrackerMapping(mapping: GroupTrackerMapping): void {
    this.library.upsertGroupTrackerMapping(mapping);
  }

  findGroupByTrackerExternalId(source: string, externalId: string): { groupId: number } | null {
    return this.library.findGroupByTrackerExternalId(source, externalId);
  }

  getTrackerMapping(groupId: number, source: string): GroupTrackerMapping | null {
    return this.library.getTrackerMapping(groupId, source);
  }

  removeTrackerMappingsBySource(source: string): void {
    this.library.removeTrackerMappingsBySource(source);
  }

  removeTrackerMapping(groupId: number, source: string): void {
    this.library.removeTrackerMapping(groupId, source);
  }

  // Watched status

  setEpisodeWatched(episodeId: number, watched: boolean): LibraryEpisode | null {
    return this.library.setEpisodeWatched(episodeId, watched);
  }

  getEpisodeWatchStatus(episodeId: number): boolean | null {
    return this.library.getEpisodeWatchStatus(episodeId);
  }

  getEpisodeWatchStatusByAnimeId(animeId: number): Array<{ episodeId: number; watched: boolean }> {
    return this.library.getEpisodeWatchStatusByAnimeId(animeId);
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
