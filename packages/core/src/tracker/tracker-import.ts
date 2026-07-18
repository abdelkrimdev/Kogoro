import { type EnrichmentService, RELATION_TYPES_TO_WALK } from "../library/enrichment-service";
import type { GroupTrackerMapping } from "../library/library-repository";
import type { LibraryService } from "../library/library-service";
import type {
  EnrichmentMediaResult,
  EntryType,
  TrackerAnime,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
} from "../types";
import type { LocalWatchStatus } from "./credential-utils";
import { mapTrackerStatus } from "./credential-utils";

export type MatchStatus = "matched" | "unmatched" | "conflict";

function matchByRelation(
  trackerEntry: TrackerAnime,
  franchiseSets: Map<string, Set<string>>,
  libraryAnimeAnilistIds: Map<number, string>,
): number | null {
  const entryFranchise = franchiseSets.get(trackerEntry.trackerId);
  if (!entryFranchise) return null;

  for (const [libraryId, anilistId] of libraryAnimeAnilistIds) {
    if (entryFranchise.has(anilistId)) {
      return libraryId;
    }
  }
  return null;
}

function unionFind(parent: Map<string, string>, x: string): string {
  if (!parent.has(x)) parent.set(x, x);
  const p = parent.get(x);
  if (p !== undefined && p !== x) parent.set(x, unionFind(parent, p));
  return parent.get(x) ?? x;
}

function unionMerge(parent: Map<string, string>, a: string, b: string): void {
  const ra = unionFind(parent, a);
  const rb = unionFind(parent, b);
  if (ra !== rb) parent.set(ra, rb);
}

function buildClusters(
  entries: TrackerAnime[],
  relationsByEntry: Map<string, Set<string>>,
): Map<string, string> {
  const parent = new Map<string, string>();

  for (const [id, relatedIds] of relationsByEntry) {
    for (const relatedId of relatedIds) {
      unionMerge(parent, id, relatedId);
    }
  }

  const clusters = new Map<string, string>();
  for (const entry of entries) {
    if (relationsByEntry.has(entry.trackerId)) {
      clusters.set(entry.trackerId, unionFind(parent, entry.trackerId));
    }
  }

  return clusters;
}

function buildRelationMap(
  trackerIds: string[],
  mediaDetails: EnrichmentMediaResult[],
): Map<string, Set<string>> {
  const entrySet = new Set(trackerIds);
  const relationsByEntry = new Map<string, Set<string>>();

  for (const detail of mediaDetails) {
    const relatedIds = new Set<string>();
    for (const relation of detail.relations) {
      if (!RELATION_TYPES_TO_WALK.has(relation.relationType)) continue;
      if (!entrySet.has(relation.anilistId)) continue;

      relatedIds.add(relation.anilistId);

      const existingRels = relationsByEntry.get(relation.anilistId);
      if (existingRels) {
        existingRels.add(detail.anilistId);
      } else {
        relationsByEntry.set(relation.anilistId, new Set([detail.anilistId]));
      }
    }
    if (relatedIds.size > 0) {
      relationsByEntry.set(detail.anilistId, relatedIds);
    }
  }

  return relationsByEntry;
}

function titlesMatch(
  animeTitle: string,
  alternativeTitles: string[] | undefined,
  targetLower: string,
): boolean {
  if (animeTitle.toLowerCase() === targetLower) return true;

  if (alternativeTitles) {
    return alternativeTitles.some((alt) => alt.toLowerCase() === targetLower);
  }

  return false;
}

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

type RelationClusters = {
  clusters: Map<string, string>;
  seasonNumbers: Map<string, number | undefined>;
};

type ImportAccumulator = {
  animeToCreate: AnimeToCreate[];
  groupsToCreate: GroupToCreate[];
  mappingsToCreate: GroupTrackerMapping[];
  statusesToUpdate: StatusToUpdate[];
  titleToAnimeIndex: Map<string, number>;
  seasonNumbers: Map<string, number | undefined>;
  skipped: number;
};

export class TrackerImportService {
  private cachedTrackerList: TrackerAnime[] | null = null;
  private cachedMatchResults: Map<string, number | null> | null = null;

  constructor(
    private library: LibraryService,
    private tracker: TrackerPlugin,
    private source: TrackerSource,
    private enrichmentService?: EnrichmentService,
  ) {}

  clearCache(): void {
    this.cachedTrackerList = null;
    this.cachedMatchResults = null;
  }

  private findExistingAnime(
    entry: TrackerAnime,
    selection: ImportSelection | undefined,
    matchResults: Map<string, number | null> | null,
  ): { id: number } | null {
    if (selection?.groupId) {
      const group = this.library.getEpisodeGroup(selection.groupId);
      const anime = group ? this.library.getAnime(group.animeId) : null;
      if (anime) return anime;
    }

    if (matchResults?.has(entry.trackerId)) {
      const animeId = matchResults.get(entry.trackerId);
      if (animeId != null) {
        return { id: animeId };
      }
    }

    return null;
  }

  private async buildRelationMatchContext(trackerList: TrackerAnime[]): Promise<{
    franchiseSets: Map<string, Set<string>> | null;
    libraryAnimeAnilistIds: Map<number, string> | null;
  }> {
    if (!this.enrichmentService) {
      return { franchiseSets: null, libraryAnimeAnilistIds: null };
    }

    const uniqueTrackerIds = [...new Set(trackerList.map((e) => e.trackerId))];
    await this.library.getMediaDetails(uniqueTrackerIds);

    const franchiseSets = this.enrichmentService.buildFranchiseSets(uniqueTrackerIds);

    const knownAnilistIds = this.library.getKnownAnilistIds();
    const animeAnilistIds = this.library.getAnimeAnilistIds();
    const libraryAnimeAnilistIds = new Map<number, string>();

    for (const [anilistId, animeIds] of knownAnilistIds) {
      const firstAnimeId = animeIds[0];
      if (firstAnimeId !== undefined) {
        libraryAnimeAnilistIds.set(firstAnimeId, anilistId);
      }
    }

    for (const [anilistId, animeIds] of animeAnilistIds) {
      const firstAnimeId = animeIds[0];
      if (firstAnimeId !== undefined && !libraryAnimeAnilistIds.has(firstAnimeId)) {
        libraryAnimeAnilistIds.set(firstAnimeId, anilistId);
      }
    }

    return { franchiseSets, libraryAnimeAnilistIds };
  }

  private async resolveMatchResults(
    trackerList: TrackerAnime[],
  ): Promise<Map<string, number | null>> {
    const matchResults = new Map<string, number | null>();
    const { franchiseSets, libraryAnimeAnilistIds } =
      await this.buildRelationMatchContext(trackerList);
    const libraryAnime = this.library.listAnime();

    for (const entry of trackerList) {
      if (matchResults.has(entry.trackerId)) continue;

      const existingMapping = this.library.findGroupByTrackerExternalId(
        this.source,
        entry.trackerId,
      );
      if (existingMapping) continue;

      let existingAnimeId: number | null = null;

      if (franchiseSets && libraryAnimeAnilistIds) {
        existingAnimeId = matchByRelation(entry, franchiseSets, libraryAnimeAnilistIds);
      }

      if (existingAnimeId === null) {
        const titleMatch = this.findExactTitleMatch(entry, libraryAnime);
        existingAnimeId = titleMatch?.id ?? null;
      }

      matchResults.set(entry.trackerId, existingAnimeId);
    }

    return matchResults;
  }

  private findExactTitleMatch(
    entry: TrackerAnime,
    libraryAnime: Array<{ id: number; title: string; alternativeTitles?: string[] }>,
  ): { id: number } | null {
    const titleLower = entry.title.toLowerCase();

    for (const anime of libraryAnime) {
      if (titlesMatch(anime.title, anime.alternativeTitles, titleLower)) {
        return anime;
      }
    }

    if (entry.alternativeTitles) {
      for (const altTitle of entry.alternativeTitles) {
        const altLower = altTitle.toLowerCase();
        for (const anime of libraryAnime) {
          if (titlesMatch(anime.title, anime.alternativeTitles, altLower)) {
            return anime;
          }
        }
      }
    }

    return null;
  }

  async getImportPreview(): Promise<ImportPreview> {
    const trackerList = await this.tracker.getUserList();
    this.cachedTrackerList = trackerList;

    const matched: ImportPreviewEntry[] = [];
    const unmatched: ImportPreviewEntry[] = [];
    const conflicts: ImportPreviewEntry[] = [];
    const seenTrackerIds = new Set<string>();

    this.cachedMatchResults = await this.resolveMatchResults(trackerList);

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

      const existingAnimeId = this.cachedMatchResults.get(entry.trackerId) ?? null;

      const previewEntry: ImportPreviewEntry = {
        trackerId: entry.trackerId,
        title: entry.title,
        entryType: entry.entryType,
        watchStatus: entry.watchStatus,
        episodesWatched: entry.episodesWatched,
        totalEpisodes: entry.totalEpisodes,
        matchStatus: "unmatched",
        existingAnimeId: existingAnimeId ?? undefined,
      };

      if (existingAnimeId !== null) {
        const groups = this.library.getEpisodeGroupsByAnimeId(existingAnimeId);
        const existingGroup = groups.find((g) => g.entryType === entry.entryType);

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
    let matchResults = this.cachedMatchResults;
    this.cachedMatchResults = null;

    if (!matchResults) {
      matchResults = await this.resolveMatchResults(trackerList);
    }

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
      seasonNumbers: new Map(),
      skipped: 0,
    };

    const newEntries: TrackerAnime[] = [];
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
      const existingAnime = this.findExistingAnime(entry, selection, matchResults);

      if (existingAnime) {
        this.processEntryForExistingAnime(entry, selection, existingAnime, acc);
      } else {
        newEntries.push(entry);
      }
    }

    const relationClusters = await this.groupByRelations(newEntries);

    if (relationClusters) {
      for (const [id, num] of relationClusters.seasonNumbers) {
        acc.seasonNumbers.set(id, num);
      }
    }

    for (const entry of newEntries) {
      this.processEntryForNewAnime(entry, acc, relationClusters);
    }

    const createdAnimeIds = this.executeImportTransaction(acc);

    if (createdAnimeIds.length > 0) {
      const knownEntries =
        this.source === "anilist"
          ? trackerList.map((e) => ({ anilistId: e.trackerId, title: e.title }))
          : undefined;
      await this.library.enrichAnime(createdAnimeIds, knownEntries);
    }

    return { imported: trackerList.length - acc.skipped, skipped: acc.skipped };
  }

  private async groupByRelations(entries: TrackerAnime[]): Promise<RelationClusters | null> {
    if (entries.length === 0) return null;

    const trackerIds = entries.map((e) => e.trackerId);
    let mediaDetails: EnrichmentMediaResult[] | null;
    try {
      mediaDetails = await this.library.getMediaDetails(trackerIds);
    } catch {
      return null;
    }
    if (!mediaDetails) return null;

    const relationsByEntry = buildRelationMap(trackerIds, mediaDetails);

    const clusters = buildClusters(entries, relationsByEntry);
    if (clusters.size === 0) return null;

    const seasonNumbers = new Map<string, number | undefined>();
    if (this.enrichmentService) {
      const clusterGroups = new Map<string, string[]>();
      for (const [trackerId, clusterRoot] of clusters) {
        const existing = clusterGroups.get(clusterRoot);
        if (existing) {
          existing.push(trackerId);
        } else {
          clusterGroups.set(clusterRoot, [trackerId]);
        }
      }

      for (const clusterIds of clusterGroups.values()) {
        const clusterSeasonNumbers = this.enrichmentService.assignSeasonNumbers(clusterIds);
        for (const [id, num] of clusterSeasonNumbers) {
          seasonNumbers.set(id, num);
        }
      }
    }

    return { clusters, seasonNumbers };
  }

  private processEntryForExistingAnime(
    entry: TrackerAnime,
    selection: ImportSelection | undefined,
    existingAnime: { id: number },
    acc: ImportAccumulator,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(existingAnime.id);
    const seasonNumber = acc.seasonNumbers.get(entry.trackerId);

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

  private processEntryForNewAnime(
    entry: TrackerAnime,
    acc: ImportAccumulator,
    relationClusters: RelationClusters | null = null,
  ): void {
    const clusterKey = relationClusters?.clusters.get(entry.trackerId);
    const groupingKey = clusterKey ? `cluster:${clusterKey}` : entry.title.toLowerCase();

    const existingIndex = acc.titleToAnimeIndex.get(groupingKey);
    const newIndex = existingIndex ?? acc.animeToCreate.length;

    if (existingIndex === undefined) {
      acc.titleToAnimeIndex.set(groupingKey, newIndex);
      acc.animeToCreate.push({
        trackerIds: [entry.trackerId],
        title: entry.title,
        alternativeTitles: entry.alternativeTitles,
        totalEpisodes: entry.totalEpisodes,
      });
    } else {
      acc.animeToCreate[newIndex]?.trackerIds.push(entry.trackerId);
    }

    const seasonNumber = acc.seasonNumbers.get(entry.trackerId);

    acc.groupsToCreate.push({
      trackerId: entry.trackerId,
      animeId: -(newIndex + 1),
      entryType: entry.entryType,
      seasonNumber,
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
