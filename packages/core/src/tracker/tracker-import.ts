import type { GroupTrackerMapping } from "../library/library-repository";
import type { LibraryService } from "../library/library-service";
import type { EntryType, TrackerAnime, TrackerPlugin, TrackerWatchStatus } from "../types";
import {
  extractSeasonNumber,
  findMatchingAnime,
  type LocalWatchStatus,
  mapTrackerStatus,
  stripSeasonFromTitle,
} from "./tracker-utils";

export type TrackerSource = "mal" | "anilist" | "kitsu";

export type MatchStatus = "matched" | "unmatched" | "conflict";

export interface ImportPreviewEntry {
  trackerId: string;
  title: string;
  entryType: string;
  watchStatus: TrackerWatchStatus;
  episodesWatched: number;
  totalEpisodes: number;
  matchStatus: MatchStatus;
  existingAnimeId?: number;
  existingGroupId?: number;
  localWatchStatus?: string;
}

export interface ImportPreview {
  totalEntries: number;
  matched: ImportPreviewEntry[];
  unmatched: ImportPreviewEntry[];
  conflicts: ImportPreviewEntry[];
  statusCounts: Record<TrackerWatchStatus, number>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface ImportSelection {
  trackerId: string;
  groupId?: number;
  resolution?: "keepLocal" | "acceptTracker";
}

type AnimeToCreate = {
  trackerIds: string[];
  title: string;
  alternativeTitles?: string[];
  totalEpisodes: number;
};

type GroupToCreate = {
  trackerId: string;
  animeId: number;
  entryType: EntryType;
  seasonNumber: number | undefined;
  watchStatus: LocalWatchStatus;
};

type StatusToUpdate = {
  groupId: number;
  watchStatus: LocalWatchStatus;
};

type ImportAccumulator = {
  animeToCreate: AnimeToCreate[];
  groupsToCreate: GroupToCreate[];
  mappingsToCreate: GroupTrackerMapping[];
  statusesToUpdate: StatusToUpdate[];
  titleToAnimeIndex: Map<string, number>;
  skipped: number;
};

export class TrackerImportService {
  private cachedTrackerList: TrackerAnime[] | null = null;
  private cachedMatchResults: Map<string, { id: number; title: string } | null> | null = null;

  constructor(
    private library: LibraryService,
    private tracker: TrackerPlugin,
    private source: TrackerSource,
  ) {}

  clearCache(): void {
    this.cachedTrackerList = null;
    this.cachedMatchResults = null;
  }

  private findExistingAnime(
    entry: TrackerAnime,
    selection: ImportSelection | undefined,
    matchResults: Map<string, { id: number; title: string } | null> | null,
    libraryAnime: Array<{ id: number; title: string }>,
  ): { id: number; title: string } | null {
    if (selection?.groupId) {
      const group = this.library.getEpisodeGroup(selection.groupId);
      const anime = group ? this.library.getAnime(group.animeId) : null;
      if (anime) return anime;
    }

    if (matchResults?.has(entry.trackerId)) {
      return matchResults.get(entry.trackerId) ?? null;
    }

    return findMatchingAnime(entry, libraryAnime);
  }

  async getImportPreview(): Promise<ImportPreview> {
    const trackerList = await this.tracker.getUserList();
    this.cachedTrackerList = trackerList;
    const libraryAnime = this.library.listAnime();

    const matched: ImportPreviewEntry[] = [];
    const unmatched: ImportPreviewEntry[] = [];
    const conflicts: ImportPreviewEntry[] = [];
    const seenTrackerIds = new Set<string>();
    this.cachedMatchResults = new Map();

    for (const entry of trackerList) {
      if (seenTrackerIds.has(entry.trackerId)) continue;
      seenTrackerIds.add(entry.trackerId);

      const existingMapping = this.library.findGroupByTrackerExternalId(
        this.source,
        entry.trackerId,
      );
      if (existingMapping) {
        continue;
      }

      const existingAnime = findMatchingAnime(entry, libraryAnime);
      this.cachedMatchResults.set(entry.trackerId, existingAnime);

      const previewEntry: ImportPreviewEntry = {
        trackerId: entry.trackerId,
        title: entry.title,
        entryType: entry.entryType,
        watchStatus: entry.watchStatus,
        episodesWatched: entry.episodesWatched,
        totalEpisodes: entry.totalEpisodes,
        matchStatus: "unmatched",
        existingAnimeId: existingAnime?.id,
      };

      if (existingAnime) {
        const groups = this.library.getEpisodeGroupsByAnimeId(existingAnime.id);
        const seasonNumber = extractSeasonNumber(entry);
        const existingGroup = groups.find(
          (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
        );

        if (existingGroup) {
          const localStatus = mapTrackerStatus(entry.watchStatus);
          if (existingGroup.watchStatus !== localStatus) {
            previewEntry.matchStatus = "conflict";
            previewEntry.existingGroupId = existingGroup.id;
            previewEntry.localWatchStatus = existingGroup.watchStatus;
            conflicts.push(previewEntry);
          } else {
            previewEntry.matchStatus = "matched";
            previewEntry.existingGroupId = existingGroup.id;
            matched.push(previewEntry);
          }
        } else {
          previewEntry.matchStatus = "matched";
          matched.push(previewEntry);
        }
      } else {
        unmatched.push(previewEntry);
      }
    }

    const statusCounts: Record<TrackerWatchStatus, number> = {
      watching: 0,
      completed: 0,
      "plan-to-watch": 0,
      "on-hold": 0,
      dropped: 0,
    };
    for (const entry of [...matched, ...unmatched, ...conflicts]) {
      statusCounts[entry.watchStatus]++;
    }

    return {
      totalEntries: matched.length + unmatched.length + conflicts.length,
      matched,
      unmatched,
      conflicts,
      statusCounts,
    };
  }

  async confirmImport(selections?: ImportSelection[]): Promise<ImportResult> {
    const trackerList = this.cachedTrackerList ?? (await this.tracker.getUserList());
    this.cachedTrackerList = null;
    const matchResults = this.cachedMatchResults;
    this.cachedMatchResults = null;

    const selectionMap = new Map<string, ImportSelection>();
    for (const selection of selections ?? []) {
      selectionMap.set(selection.trackerId, selection);
    }

    const acc: ImportAccumulator = {
      animeToCreate: [],
      groupsToCreate: [],
      mappingsToCreate: [],
      statusesToUpdate: [],
      titleToAnimeIndex: new Map(),
      skipped: 0,
    };

    const libraryAnime = this.library.listAnime();

    for (const entry of trackerList) {
      const existingMapping = this.library.findGroupByTrackerExternalId(
        this.source,
        entry.trackerId,
      );
      if (existingMapping) {
        acc.skipped++;
        continue;
      }

      const selection = selectionMap.get(entry.trackerId);
      const existingAnime = this.findExistingAnime(entry, selection, matchResults, libraryAnime);

      if (existingAnime) {
        this.processEntryForExistingAnime(entry, selection, existingAnime, acc);
      } else {
        this.processEntryForNewAnime(entry, acc);
      }
    }

    const createdAnimeIds = this.executeImportTransaction(acc);

    if (createdAnimeIds.length > 0) {
      await this.library.enrichAnime(createdAnimeIds);
    }

    return { imported: trackerList.length - acc.skipped, skipped: acc.skipped };
  }

  private processEntryForExistingAnime(
    entry: TrackerAnime,
    selection: ImportSelection | undefined,
    existingAnime: { id: number; title: string },
    acc: ImportAccumulator,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(existingAnime.id);
    const seasonNumber = extractSeasonNumber(entry);

    let targetGroup = groups.find(
      (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
    );

    if (selection?.groupId) {
      const linkedGroup = this.library.getEpisodeGroup(selection.groupId);
      if (linkedGroup) {
        targetGroup = linkedGroup;
      }
    }

    if (!targetGroup) {
      acc.groupsToCreate.push({
        trackerId: entry.trackerId,
        animeId: existingAnime.id,
        entryType: entry.entryType,
        seasonNumber,
        watchStatus: mapTrackerStatus(entry.watchStatus),
      });
    } else {
      if (selection?.resolution !== "keepLocal") {
        acc.statusesToUpdate.push({
          groupId: targetGroup.id,
          watchStatus: mapTrackerStatus(entry.watchStatus),
        });
      }
      acc.mappingsToCreate.push({
        groupId: targetGroup.id,
        source: this.source,
        externalId: entry.trackerId,
      });
    }
  }

  private processEntryForNewAnime(entry: TrackerAnime, acc: ImportAccumulator): void {
    const baseTitle = stripSeasonFromTitle(entry.title.toLowerCase());

    const existingIndex = acc.titleToAnimeIndex.get(baseTitle);
    const newIndex = existingIndex ?? acc.animeToCreate.length;

    if (existingIndex === undefined) {
      acc.titleToAnimeIndex.set(baseTitle, newIndex);
      acc.animeToCreate.push({
        trackerIds: [entry.trackerId],
        title: entry.title,
        alternativeTitles: entry.alternativeTitles,
        totalEpisodes: entry.totalEpisodes,
      });
    } else {
      acc.animeToCreate[newIndex]?.trackerIds.push(entry.trackerId);
    }

    acc.groupsToCreate.push({
      trackerId: entry.trackerId,
      animeId: -(newIndex + 1),
      entryType: entry.entryType,
      seasonNumber: extractSeasonNumber(entry),
      watchStatus: mapTrackerStatus(entry.watchStatus),
    });
  }

  private executeImportTransaction(acc: ImportAccumulator): number[] {
    const createdAnimeIds: number[] = [];

    this.library.transaction((tx) => {
      if (acc.animeToCreate.length > 0) {
        const createdAnime = tx.upsertAnimeBatch(
          acc.animeToCreate.map((item) => ({
            externalId: `tracker-${item.trackerIds[0]}`,
            sourceDb: this.source,
            title: item.title,
            alternativeTitles: item.alternativeTitles,
            episodeCount: item.totalEpisodes,
          })),
        );

        const animeIndexToId = new Map<number, number>();
        for (let i = 0; i < createdAnime.length; i++) {
          const anime = createdAnime[i];
          if (anime) {
            animeIndexToId.set(i, anime.id);
            createdAnimeIds.push(anime.id);
          }
        }

        for (const group of acc.groupsToCreate) {
          if (group.animeId < 0) {
            const index = -(group.animeId + 1);
            group.animeId = animeIndexToId.get(index) ?? group.animeId;
          }
        }
      }

      if (acc.groupsToCreate.length > 0) {
        const createdGroups = tx.upsertEpisodeGroupBatch(
          acc.groupsToCreate.map((item) => ({
            animeId: item.animeId,
            entryType: item.entryType,
            seasonNumber: item.seasonNumber,
            watchStatus: item.watchStatus,
          })),
        );

        for (let i = 0; i < createdGroups.length; i++) {
          const item = acc.groupsToCreate[i];
          const group = createdGroups[i];
          if (item && group) {
            acc.mappingsToCreate.push({
              groupId: group.id,
              source: this.source,
              externalId: item.trackerId,
            });
          }
        }
      }

      if (acc.statusesToUpdate.length > 0) {
        tx.updateEpisodeGroupStatusBatch(acc.statusesToUpdate);
      }

      if (acc.mappingsToCreate.length > 0) {
        tx.upsertGroupTrackerMappingBatch(acc.mappingsToCreate);
      }
    });

    return createdAnimeIds;
  }
}
