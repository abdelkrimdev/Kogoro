import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { stripTypeDir } from "../config/schema";
import type { LocalWatchStatus } from "../tracker/credential-utils";
import { mapTrackerStatus } from "../tracker/credential-utils";
import type {
  EnrichmentMediaResult,
  EnrichmentProvider,
  EntryType,
  KnownEntry,
  MatchEntry,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
} from "../types";
import { FranchiseAggregate, RELATION_TYPES_TO_WALK } from "./franchise-aggregate";
import type {
  EpisodeGroup,
  GroupTrackerMapping,
  LibraryAnime,
  LibraryEpisode,
  LibraryRepository,
} from "./library-repository";
import { computeLibraryState, type GroupFilesOnDisk } from "./library-state";

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface ImportSelection {
  trackerId: string;
  groupId?: number;
  resolution?: "keepLocal" | "acceptTracker";
}

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

type ImportAccumulator = {
  animeToCreate: Array<{
    trackerIds: string[];
    title: string;
    alternativeTitles?: string[];
    totalEpisodes: number;
  }>;
  groupsToCreate: Array<{
    trackerId: string;
    animeId: number;
    entryType: EntryType;
    seasonNumber: number | undefined;
    watchStatus: LocalWatchStatus;
  }>;
  mappingsToCreate: GroupTrackerMapping[];
  statusesToUpdate: Array<{
    groupId: number;
    watchStatus: LocalWatchStatus;
  }>;
  titleToAnimeIndex: Map<string, number>;
  seasonNumbers: Map<string, number | undefined>;
  skipped: number;
};

export interface ScanMergeEntry {
  kind: "scan";
  title: string;
  entryType: EntryType;
  anilistId?: string;
  season?: number;
  episodes: Array<{
    episode: number;
    filePath: string;
    title?: string;
  }>;
}

export interface ImportMergeEntry {
  kind: "import";
  title: string;
  entryType: EntryType;
  anilistId: string;
  season?: number;
  trackerSource: TrackerSource;
  trackerId: string;
  watchStatus: TrackerWatchStatus;
}

export type MergeEntry = ScanMergeEntry | ImportMergeEntry;

export interface ResolveAndMergeInput {
  entries: MergeEntry[];
  source: string;
}

export interface ResolveAndMergeResult {
  animeIds: number[];
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

function matchByRelation(
  trackerEntry: { trackerId: string },
  franchiseSets: Map<string, Set<string>>,
  libraryAnimeAnilistIds: Map<number, string>,
): number | null {
  const entryFranchise = franchiseSets.get(trackerEntry.trackerId);
  if (!entryFranchise) return null;
  for (const [libraryId, anilistId] of libraryAnimeAnilistIds) {
    if (entryFranchise.has(anilistId)) return libraryId;
  }
  return null;
}

function findAnimeByTitleMatch(
  entry: { title: string; alternativeTitles?: string[] },
  libraryAnime: Array<{ id: number; title: string; alternativeTitles?: string[] }>,
): number | null {
  const titleLower = entry.title.toLowerCase();
  for (const anime of libraryAnime) {
    if (titlesMatch(anime.title, anime.alternativeTitles, titleLower)) {
      return anime.id;
    }
  }
  if (entry.alternativeTitles) {
    for (const altTitle of entry.alternativeTitles) {
      const altLower = altTitle.toLowerCase();
      for (const anime of libraryAnime) {
        if (titlesMatch(anime.title, anime.alternativeTitles, altLower)) {
          return anime.id;
        }
      }
    }
  }
  return null;
}

function buildClusters(
  entries: Array<{ trackerId: string }>,
  relationsByEntry: Map<string, Set<string>>,
): Map<string, string> {
  const parent = new Map<string, string>();
  function unionFind(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    const p = parent.get(x);
    if (p !== undefined && p !== x) parent.set(x, unionFind(p));
    return parent.get(x) ?? x;
  }
  function unionMerge(a: string, b: string): void {
    const ra = unionFind(a);
    const rb = unionFind(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const [id, relatedIds] of relationsByEntry) {
    for (const relatedId of relatedIds) {
      unionMerge(id, relatedId);
    }
  }

  const clusters = new Map<string, string>();
  for (const entry of entries) {
    if (relationsByEntry.has(entry.trackerId)) {
      clusters.set(entry.trackerId, unionFind(entry.trackerId));
    }
  }
  return clusters;
}

function groupCompositeKey(
  animeExternalId: string,
  sourceDb: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${animeExternalId}:${sourceDb}:${entryType}:${seasonNumber ?? "null"}`;
}

export interface AnimeAggregateDeps {
  library: LibraryRepository;
  replayUnpushedEvents: (oldSnapshot: {
    groupByCompositeKey: Map<string, number>;
    episodeByCompositeKey: Map<string, number>;
  }) => void;
  computeAndPersistLibraryState: (animeId: number, repo?: LibraryRepository) => void;
  enrichmentProviderFactory?: () => Promise<EnrichmentProvider | undefined>;
}

export class AnimeAggregate {
  private franchiseAggregate: FranchiseAggregate | null = null;

  constructor(private deps: AnimeAggregateDeps) {}

  get library(): LibraryRepository {
    return this.deps.library;
  }

  private async ensureFranchiseAggregate(): Promise<FranchiseAggregate | null> {
    if (this.franchiseAggregate) return this.franchiseAggregate;
    if (!this.deps.enrichmentProviderFactory) return null;
    const provider = await this.deps.enrichmentProviderFactory();
    if (!provider) return null;
    this.franchiseAggregate = new FranchiseAggregate({ library: this.deps.library, provider });
    return this.franchiseAggregate;
  }

  private async ensureEnrichmentProvider(): Promise<EnrichmentProvider | null> {
    if (!this.deps.enrichmentProviderFactory) return null;
    return (await this.deps.enrichmentProviderFactory()) ?? null;
  }

  async enrichAnime(animeIds: number[], knownEntries?: KnownEntry[]): Promise<void> {
    const franchiseAggregate = await this.ensureFranchiseAggregate();
    if (!franchiseAggregate) return;
    await franchiseAggregate.enrichAnime(animeIds, knownEntries);
  }

  async retryPendingIdentification(): Promise<{
    resolved: Array<{ id: number; mergedInto?: number }>;
    stillPending: LibraryAnime[];
  }> {
    const provider = await this.ensureEnrichmentProvider();
    const pendingAnime = this.deps.library.findPendingAnime();
    const resolved: Array<{ id: number; mergedInto?: number }> = [];
    const enrichedIds: number[] = [];

    for (const entry of pendingAnime) {
      const resolvedAnilistId = await this.resolveAnilistId(entry.title, provider);
      if (!resolvedAnilistId) continue;

      const existingAnime = this.deps.library.findAnimeByAnilistId(resolvedAnilistId);
      if (existingAnime) {
        this.deps.library.mergeAnimeInto(entry.id, existingAnime.id);
        resolved.push({ id: entry.id, mergedInto: existingAnime.id });
        enrichedIds.push(existingAnime.id);
      } else {
        this.deps.library.updateAnimeAnilistId(entry.id, resolvedAnilistId);
        resolved.push({ id: entry.id });
        enrichedIds.push(entry.id);
      }
    }

    if (enrichedIds.length > 0) {
      try {
        await this.enrichAnime(enrichedIds);
      } catch {
        // Enrichment failure should not prevent retry from completing
      }
    }

    return {
      resolved,
      stillPending: this.deps.library.findPendingAnime(),
    };
  }

  async importFromTracker(
    tracker: TrackerPlugin,
    source: TrackerSource,
    selections?: ImportSelection[],
  ): Promise<ImportResult> {
    const trackerList = await tracker.getUserList();
    const selectionMap = new Map<string, ImportSelection>();
    for (const selection of selections ?? []) {
      selectionMap.set(selection.trackerId, selection);
    }

    const matchResults = await this.resolveTrackerMatchResults(trackerList, source);

    const acc: ImportAccumulator = {
      animeToCreate: [],
      groupsToCreate: [],
      mappingsToCreate: [],
      statusesToUpdate: [],
      titleToAnimeIndex: new Map(),
      seasonNumbers: new Map(),
      skipped: 0,
    };

    const newEntries: typeof trackerList = [];
    for (const entry of trackerList) {
      const existingMapping = this.deps.library.findGroupByTrackerExternalId(
        source,
        entry.trackerId,
      );
      if (existingMapping) {
        acc.skipped++;
        continue;
      }

      const selection = selectionMap.get(entry.trackerId);
      const existingAnime = this.findExistingAnimeForImport(entry, selection, matchResults);

      if (existingAnime) {
        this.processEntryForExistingAnime(entry, selection, existingAnime, source, acc);
      } else {
        newEntries.push(entry);
      }
    }

    const relationClusters = await this.groupNewEntriesByRelations(newEntries);

    if (relationClusters) {
      for (const [id, num] of relationClusters.seasonNumbers) {
        acc.seasonNumbers.set(id, num);
      }
    }

    for (const entry of newEntries) {
      this.processEntryForNewAnime(entry, acc, relationClusters);
    }

    const createdAnimeIds = this.executeImportTransaction(acc, source);

    if (createdAnimeIds.length > 0) {
      const knownEntries =
        source === "anilist"
          ? trackerList.map((e) => ({ anilistId: e.trackerId, title: e.title }))
          : undefined;
      await this.enrichAnime(createdAnimeIds, knownEntries);
    }

    return { imported: trackerList.length - acc.skipped, skipped: acc.skipped };
  }

  async getImportPreview(tracker: TrackerPlugin, source: TrackerSource): Promise<ImportPreview> {
    const trackerList = await tracker.getUserList();
    const matchResults = await this.resolveTrackerMatchResults(trackerList, source);

    const matched: ImportPreviewEntry[] = [];
    const unmatched: ImportPreviewEntry[] = [];
    const conflicts: ImportPreviewEntry[] = [];
    const seenTrackerIds = new Set<string>();

    for (const entry of trackerList) {
      if (seenTrackerIds.has(entry.trackerId)) continue;
      seenTrackerIds.add(entry.trackerId);

      const existingMapping = this.deps.library.findGroupByTrackerExternalId(
        source,
        entry.trackerId,
      );
      if (existingMapping) {
        continue;
      }

      const existingAnimeId = matchResults.get(entry.trackerId) ?? null;

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
        const groups = this.deps.library.getEpisodeGroupsByAnimeId(existingAnimeId);
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

  getAnimeForDisplay(filters?: {
    sourceDb?: string;
    franchiseId?: number;
    libraryState?: "on_disk" | "partially_on_disk" | "not_on_disk";
    watchStatus?: "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";
  }): Array<{
    anime: LibraryAnime;
    groups: Array<EpisodeGroup & { episodes: LibraryEpisode[] }>;
  }> {
    let animeList = this.deps.library.listAnime();

    if (filters?.sourceDb) {
      animeList = animeList.filter((a) => a.sourceDb === filters.sourceDb);
    }
    if (filters?.franchiseId !== undefined) {
      animeList = animeList.filter((a) => a.franchiseId === filters.franchiseId);
    }
    if (filters?.libraryState) {
      animeList = animeList.filter((a) => a.libraryState === filters.libraryState);
    }

    const result: Array<{
      anime: LibraryAnime;
      groups: Array<EpisodeGroup & { episodes: LibraryEpisode[] }>;
    }> = [];

    for (const anime of animeList) {
      const groups = this.deps.library.getEpisodeGroupsByAnimeId(anime.id);

      const filteredGroups = filters?.watchStatus
        ? groups.filter((g) => g.watchStatus === filters.watchStatus)
        : groups;

      if (filters?.watchStatus && filteredGroups.length === 0) continue;

      const groupsWithEpisodes = filteredGroups.map((group) => ({
        ...group,
        episodes: this.deps.library.getEpisodesByGroupId(group.id),
      }));

      result.push({ anime, groups: groupsWithEpisodes });
    }

    return result;
  }

  private findExistingAnimeForImport(
    entry: { trackerId: string },
    selection: ImportSelection | undefined,
    matchResults: Map<string, number | null>,
  ): { id: number } | null {
    if (selection?.groupId) {
      const group = this.deps.library.getEpisodeGroup(selection.groupId);
      const anime = group ? this.deps.library.getAnime(group.animeId) : null;
      if (anime) return anime;
    }
    if (matchResults.has(entry.trackerId)) {
      const animeId = matchResults.get(entry.trackerId);
      if (animeId != null) return { id: animeId };
    }
    return null;
  }

  private async resolveTrackerMatchResults(
    trackerList: Array<{
      trackerId: string;
      title: string;
      alternativeTitles?: string[];
      entryType: EntryType;
    }>,
    source: TrackerSource,
  ): Promise<Map<string, number | null>> {
    const matchResults = new Map<string, number | null>();
    const libraryAnime = this.deps.library.listAnime();

    const { franchiseSets, libraryAnimeAnilistIds } =
      await this.buildRelationMatchContext(trackerList);

    for (const entry of trackerList) {
      if (matchResults.has(entry.trackerId)) continue;

      const existingMapping = this.deps.library.findGroupByTrackerExternalId(
        source,
        entry.trackerId,
      );
      if (existingMapping) continue;

      let existingAnimeId: number | null = null;

      if (franchiseSets && libraryAnimeAnilistIds) {
        existingAnimeId = matchByRelation(entry, franchiseSets, libraryAnimeAnilistIds);
      }

      if (existingAnimeId === null) {
        existingAnimeId = findAnimeByTitleMatch(entry, libraryAnime);
      }

      matchResults.set(entry.trackerId, existingAnimeId);
    }

    return matchResults;
  }

  private async buildRelationMatchContext(trackerList: Array<{ trackerId: string }>): Promise<{
    franchiseSets: Map<string, Set<string>> | null;
    libraryAnimeAnilistIds: Map<number, string> | null;
  }> {
    const franchiseAggregate = await this.ensureFranchiseAggregate();
    if (!franchiseAggregate) return { franchiseSets: null, libraryAnimeAnilistIds: null };

    const uniqueTrackerIds = [...new Set(trackerList.map((e) => e.trackerId))];
    await this.getMediaDetails(uniqueTrackerIds);

    const franchiseSets = franchiseAggregate.buildFranchiseSets(uniqueTrackerIds);

    const knownAnilistIds = this.deps.library.getKnownAnilistIds();
    const animeAnilistIds = this.deps.library.getAnimeAnilistIds();
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

  private processEntryForExistingAnime(
    entry: {
      trackerId: string;
      entryType: EntryType;
      watchStatus: TrackerWatchStatus;
    },
    selection: ImportSelection | undefined,
    existingAnime: { id: number },
    source: TrackerSource,
    acc: ImportAccumulator,
  ): void {
    const groups = this.deps.library.getEpisodeGroupsByAnimeId(existingAnime.id);
    const seasonNumber = acc.seasonNumbers.get(entry.trackerId);

    let targetGroup = groups.find(
      (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
    );

    if (selection?.groupId) {
      const linkedGroup = this.deps.library.getEpisodeGroup(selection.groupId);
      if (linkedGroup) targetGroup = linkedGroup;
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
        source,
        externalId: entry.trackerId,
      });
    }
  }

  private processEntryForNewAnime(
    entry: {
      trackerId: string;
      title: string;
      alternativeTitles?: string[];
      entryType: EntryType;
      watchStatus: TrackerWatchStatus;
      totalEpisodes: number;
    },
    acc: ImportAccumulator,
    relationClusters: { clusters: Map<string, string> } | null = null,
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

  private async groupNewEntriesByRelations(
    entries: Array<{ trackerId: string; title: string }>,
  ): Promise<{
    clusters: Map<string, string>;
    seasonNumbers: Map<string, number | undefined>;
  } | null> {
    if (entries.length === 0) return null;

    const trackerIds = entries.map((e) => e.trackerId);
    let mediaDetails: EnrichmentMediaResult[] | null;
    try {
      mediaDetails = await this.getMediaDetails(trackerIds);
    } catch {
      return null;
    }
    if (!mediaDetails) return null;

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

    const clusters = buildClusters(entries, relationsByEntry);
    if (clusters.size === 0) return null;

    const seasonNumbers = new Map<string, number | undefined>();
    const franchiseAggregate = await this.ensureFranchiseAggregate();
    if (franchiseAggregate) {
      const clusterGroups = new Map<string, string[]>();
      for (const [trackerId, clusterRoot] of clusters) {
        const existing = clusterGroups.get(clusterRoot);
        if (existing) existing.push(trackerId);
        else clusterGroups.set(clusterRoot, [trackerId]);
      }
      for (const clusterIds of clusterGroups.values()) {
        const clusterSeasonNumbers = franchiseAggregate.assignSeasonNumbers(clusterIds);
        for (const [id, num] of clusterSeasonNumbers) {
          seasonNumbers.set(id, num);
        }
      }
    }

    return { clusters, seasonNumbers };
  }

  private executeImportTransaction(acc: ImportAccumulator, source: TrackerSource): number[] {
    const createdAnimeIds: number[] = [];

    this.deps.library.transaction((tx) => {
      if (acc.animeToCreate.length > 0) {
        const createdAnime = tx.upsertAnimeBatch(
          acc.animeToCreate.map((item) => ({
            externalId: `tracker-${item.trackerIds[0]}`,
            sourceDb: source,
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
              source,
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

  async getMediaDetails(anilistIds: string[]): Promise<EnrichmentMediaResult[] | null> {
    const provider = await this.ensureEnrichmentProvider();
    if (!provider) return null;
    try {
      return await provider.getMediaDetailsBatch(anilistIds);
    } catch {
      return null;
    }
  }

  private getFilteredMatches(sourceDb?: string): MatchEntry[] {
    const allMatches = this.exportMatches();
    const filtered = sourceDb ? allMatches.filter((m) => m.sourceDb === sourceDb) : allMatches;
    return filtered.filter((m) => existsSync(m.filePath));
  }

  exportMatches(): MatchEntry[] {
    return this.deps.library.exportMatches().map((row) => ({
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

  rebuildFromMatches(
    matches: MatchEntry[],
    onBeforeWipe?: (snapshot: {
      groupByCompositeKey: Map<string, number>;
      episodeByCompositeKey: Map<string, number>;
    }) => void,
  ): void {
    this.deps.library.transaction((tx) => {
      const oldState = tx.getAllEpisodesWithAnime();

      const oldEpisodeKey = new Map<string, number>();
      const oldWatched = new Map<number, boolean>();
      const oldNotes = new Map<number, string | undefined>();
      for (const row of oldState) {
        const key = `${row.animeExternalId}:${row.animeSourceDb}:${row.season ?? 1}:${row.episodeNumber}`;
        oldEpisodeKey.set(key, row.episodeId);
        oldWatched.set(row.episodeId, row.watched);
        const ep = tx.getEpisode(row.episodeId);
        if (ep) {
          oldNotes.set(row.episodeId, ep.notes);
        }
      }

      const oldGroups = tx.getAllEpisodeGroups();
      const oldAnimeById = new Map<number, { externalId: string; sourceDb: string }>();
      for (const a of tx.listAnime()) {
        oldAnimeById.set(a.id, { externalId: a.externalId, sourceDb: a.sourceDb });
      }

      const oldGroupById = new Map<number, EpisodeGroup>();
      const groupStateByKey = new Map<
        string,
        {
          watchStatus: EpisodeGroup["watchStatus"];
          synopsis?: string;
          rating?: number;
          coverArtPath?: string;
        }
      >();
      const groupByCompositeKey = new Map<string, number>();
      for (const group of oldGroups) {
        oldGroupById.set(group.id, group);
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
        groupByCompositeKey.set(key, group.id);
      }

      const mappingsByKey = new Map<string, GroupTrackerMapping[]>();
      for (const mapping of tx.getAllTrackerMappings()) {
        const group = oldGroupById.get(mapping.groupId);
        if (!group) continue;
        const animeInfo = oldAnimeById.get(group.animeId);
        if (!animeInfo) continue;
        const key = groupCompositeKey(
          animeInfo.externalId,
          animeInfo.sourceDb,
          group.entryType,
          group.seasonNumber,
        );
        const entry = mappingsByKey.get(key);
        const mapped: GroupTrackerMapping = {
          groupId: 0,
          source: mapping.source,
          externalId: mapping.externalId,
        };
        if (entry) {
          entry.push(mapped);
        } else {
          mappingsByKey.set(key, [mapped]);
        }
      }

      if (onBeforeWipe) {
        onBeforeWipe({ groupByCompositeKey, episodeByCompositeKey: oldEpisodeKey });
      }

      const oldAnimeTrackerMappings = tx.getAllAnimeTrackerMappings();
      const mappingByCompositeKey = new Map<string, typeof oldAnimeTrackerMappings>();
      for (const m of oldAnimeTrackerMappings) {
        const anime = oldAnimeById.get(m.animeId);
        if (!anime) continue;
        const key = `${anime.externalId}:${anime.sourceDb}`;
        const list = mappingByCompositeKey.get(key);
        if (list) {
          list.push(m);
        } else {
          mappingByCompositeKey.set(key, [m]);
        }
      }

      tx.deleteAll();

      const now = new Date().toISOString();
      const animeIds = new Set<number>();
      const externalIdToAnimeId = new Map<string, number>();

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
        externalIdToAnimeId.set(`${match.animeId}:${match.sourceDb}`, animeId);

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
            const oldNotesValue = oldNotes.get(oldEpId);
            if (oldNotesValue !== undefined) {
              tx.migrateEpisodeNotes(epResult.id, oldNotesValue);
            }
          }
        }
      }

      for (const id of animeIds) {
        tx.updateEpisodeCount(id);
      }

      for (const [compositeKey, mappings] of mappingByCompositeKey) {
        const newAnimeId = externalIdToAnimeId.get(compositeKey);
        if (newAnimeId === undefined) continue;
        for (const mapping of mappings) {
          tx.createAnimeTrackerMapping({
            animeId: newAnimeId,
            source: mapping.source,
            externalId: mapping.externalId,
          });
        }
      }

      for (const id of animeIds) {
        this.deps.computeAndPersistLibraryState(id, tx);

        const anime = tx.getAnime(id);
        if (!anime || anime.franchiseId) continue;

        const mapping = tx.getAnimeTrackerMapping(id, "anilist");
        if (!mapping) continue;

        const franchise = tx.findFranchiseByAnilistId(mapping.externalId);
        if (franchise) {
          tx.assignAnimeToFranchise(id, franchise.id);
        }
      }
    });
  }

  async rebuild(sourceDb?: string): Promise<void> {
    this.rebuildBase(sourceDb);
    const unenrichedIds = this.deps.library.getUnenrichedAnimeIds();
    if (unenrichedIds.length > 0) {
      await this.enrichAnime(unenrichedIds);
    }
  }

  async rebuildWithTrackers(sourceDb?: string): Promise<void> {
    this.rebuildBase(sourceDb);
  }

  private rebuildBase(sourceDb?: string): void {
    const matches = this.getFilteredMatches(sourceDb);
    let oldEntitySnapshot:
      | {
          groupByCompositeKey: Map<string, number>;
          episodeByCompositeKey: Map<string, number>;
        }
      | undefined;

    this.rebuildFromMatches(matches, (snapshot) => {
      oldEntitySnapshot = snapshot;
    });

    if (oldEntitySnapshot) {
      this.deps.replayUnpushedEvents(oldEntitySnapshot);
    }
  }

  async mergeFromMatches(matches: MatchEntry[]): Promise<void> {
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

    const affectedAnimeIds = new Set<number>();

    this.deps.library.transaction((tx) => {
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
              const group = tx.upsertEpisodeGroup({
                animeId: libraryAnime.id,
                entryType: match.entryType as EntryType,
                seasonNumber: seasonNum,
                watchStatus: existingGroup?.watchStatus ?? "plan_to_watch",
                lastSynced: existingGroup ? new Date().toISOString() : undefined,
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
        this.deps.computeAndPersistLibraryState(id, tx);
      }
    });

    if (affectedAnimeIds.size > 0) {
      await this.enrichAnime([...affectedAnimeIds]);
    }
  }

  async resolveAndMerge(input: ResolveAndMergeInput): Promise<ResolveAndMergeResult> {
    const provider = await this.ensureEnrichmentProvider();
    const allAnimeIds: number[] = [];
    const newAnimeIds: number[] = [];

    const entriesByAnilistId = new Map<string, MergeEntry[]>();
    const pendingEntriesByTitle = new Map<string, MergeEntry[]>();
    for (const entry of input.entries) {
      let anilistId: string | null = entry.anilistId ?? null;

      if (!anilistId) {
        anilistId = await this.resolveAnilistId(entry.title, provider);
      }

      if (!anilistId) {
        const existing = pendingEntriesByTitle.get(entry.title);
        if (existing) {
          existing.push(entry);
        } else {
          pendingEntriesByTitle.set(entry.title, [entry]);
        }
        continue;
      }

      const existing = entriesByAnilistId.get(anilistId);
      if (existing) {
        existing.push(entry);
      } else {
        entriesByAnilistId.set(anilistId, [entry]);
      }
    }

    for (const [anilistId, entries] of entriesByAnilistId) {
      const { animeId, isNew } = this.findOrCreateAnimeForMerge(anilistId, entries, input.source);
      allAnimeIds.push(animeId);
      if (isNew) newAnimeIds.push(animeId);

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      this.processMergeEntries(animeId, entries, groupKeyToGroup);
      this.deps.library.updateEpisodeCount(animeId);
    }

    for (const [title, entries] of pendingEntriesByTitle) {
      const anime = this.deps.library.upsertAnime({
        externalId: `merge-${title}`,
        sourceDb: input.source,
        title,
        episodeCount: entries.reduce((sum, e) => {
          if (e.kind === "scan") return sum + e.episodes.length;
          return sum;
        }, 0),
      });
      allAnimeIds.push(anime.id);
      newAnimeIds.push(anime.id);

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();
      this.processMergeEntries(anime.id, entries, groupKeyToGroup);
      this.deps.library.updateEpisodeCount(anime.id);
    }

    for (const animeId of allAnimeIds) {
      this.cleanupEmptyGroups(animeId);
      this.deps.computeAndPersistLibraryState(animeId);
    }

    if (newAnimeIds.length > 0) {
      try {
        await this.enrichAnime(newAnimeIds);
      } catch {
        // Enrichment failure should not prevent merge from completing
      }
    }

    return { animeIds: allAnimeIds };
  }

  private async resolveAnilistId(
    title: string,
    provider: EnrichmentProvider | null,
  ): Promise<string | null> {
    const titleLower = title.toLowerCase();
    const allAnime = this.deps.library.listAnime();
    for (const a of allAnime) {
      if (a.title.toLowerCase() === titleLower && a.anilistId) {
        return a.anilistId;
      }
      if (a.alternativeTitles) {
        for (const alt of a.alternativeTitles) {
          if (alt.toLowerCase() === titleLower && a.anilistId) {
            return a.anilistId;
          }
        }
      }
    }

    const cacheEntry = this.deps.library.findAnilistCacheByTitle(title);
    if (cacheEntry) {
      return cacheEntry.anilistId;
    }

    if (provider) {
      try {
        const result = await provider.searchByTitle(title);
        if (result) {
          this.deps.library.setAnilistCacheEntry({
            anilistId: result.anilistId,
            title: result.title,
            format: result.format ?? null,
            episodes: result.episodes ?? null,
            relations: [],
            externalLinks: null,
            fetchedAt: new Date().toISOString(),
          });
          return result.anilistId;
        }
      } catch {
        // AniList unavailable
      }
    }

    return null;
  }

  private findOrCreateAnimeForMerge(
    anilistId: string,
    entries: MergeEntry[],
    source: string,
  ): { animeId: number; isNew: boolean } {
    const existingAnime = this.deps.library.findAnimeByAnilistId(anilistId);
    if (existingAnime) {
      return { animeId: existingAnime.id, isNew: false };
    }

    const firstEntry = entries[0];
    if (!firstEntry) return { animeId: 0, isNew: false };

    const totalEpisodes = entries.reduce((sum, e) => {
      if (e.kind === "scan") return sum + e.episodes.length;
      return sum;
    }, 0);

    const anime = this.deps.library.upsertAnime({
      externalId: `merge-${anilistId}`,
      sourceDb: source,
      title: firstEntry.title,
      episodeCount: totalEpisodes,
    });

    this.deps.library.updateAnimeAnilistId(anime.id, anilistId);

    return { animeId: anime.id, isNew: true };
  }

  private getOrCreateGroup(
    animeId: number,
    entryType: EntryType,
    seasonNumber: number,
    defaultWatchStatus: LocalWatchStatus,
    groupKeyToGroup: Map<string, { animeId: number; groupId: number }>,
  ): { animeId: number; groupId: number } {
    const groupKey = `${animeId}:${entryType}:${seasonNumber}`;
    const cached = groupKeyToGroup.get(groupKey);
    if (cached) return cached;

    const existingGroup = this.deps.library.findEpisodeGroup(animeId, entryType, seasonNumber);
    const group = this.deps.library.upsertEpisodeGroup({
      animeId,
      entryType,
      seasonNumber,
      watchStatus: existingGroup?.watchStatus ?? defaultWatchStatus,
      lastSynced: existingGroup ? new Date().toISOString() : undefined,
    });

    const entry = { animeId, groupId: group.id };
    groupKeyToGroup.set(groupKey, entry);
    return entry;
  }

  private processMergeEntries(
    animeId: number,
    entries: MergeEntry[],
    groupKeyToGroup: Map<string, { animeId: number; groupId: number }>,
  ): void {
    for (const entry of entries) {
      if (entry.kind === "scan") {
        const groupEntry = this.getOrCreateGroup(
          animeId,
          entry.entryType,
          entry.season ?? 1,
          "plan_to_watch",
          groupKeyToGroup,
        );

        for (const ep of entry.episodes) {
          this.deps.library.upsertEpisodeFromMatch({
            animeId,
            groupId: groupEntry.groupId,
            episode: ep.episode,
            filePath: ep.filePath,
            title: ep.title,
            season: entry.season,
          });
        }
      } else {
        const groupEntry = this.getOrCreateGroup(
          animeId,
          entry.entryType,
          entry.season ?? 1,
          mapTrackerStatus(entry.watchStatus),
          groupKeyToGroup,
        );

        this.deps.library.upsertGroupTrackerMapping({
          groupId: groupEntry.groupId,
          source: entry.trackerSource,
          externalId: entry.trackerId,
        });
      }
    }
  }

  private cleanupEmptyGroups(animeId: number): void {
    const groups = this.deps.library.getEpisodeGroupsByAnimeId(animeId);
    for (const group of groups) {
      const episodes = this.deps.library.getEpisodesByGroupId(group.id);
      if (episodes.length === 0) {
        const mappings = this.deps.library.getTrackerMappingsByGroupId(group.id);
        const hasTrackerData = mappings.length > 0;
        const hasNonDefaultStatus = group.watchStatus !== "plan_to_watch";

        if (!hasTrackerData && !hasNonDefaultStatus) {
          this.deps.library.deleteEpisodeGroup(group.id);
        }
      }
    }
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

  getAnimeDir(animeId: number): string | null {
    const episodes = this.deps.library.getEpisodesByAnimeId(animeId);
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
    const existing = this.deps.library.getAnime(animeId);
    if (!existing) return;
    this.deps.library.upsertAnime({
      externalId: existing.externalId,
      sourceDb: existing.sourceDb,
      title: existing.title,
      alternativeTitles: existing.alternativeTitles,
      episodeCount: existing.episodeCount,
      coverArtPath,
      genres: existing.genres,
      libraryState: existing.libraryState,
    });
  }

  deleteEpisodesByAnimeId(animeId: number): void {
    this.deps.library.deleteEpisodesByAnimeId(animeId);
    this.computeAndPersistLibraryState(animeId);
  }

  deleteEpisodesByIds(ids: number[]): void {
    if (ids.length === 0) return;
    const affectedAnimeIds = new Set<number>();
    for (const id of ids) {
      const episode = this.deps.library.getEpisode(id);
      if (episode) {
        affectedAnimeIds.add(episode.animeId);
      }
    }
    this.deps.library.deleteEpisodesByIds(ids);
    for (const animeId of affectedAnimeIds) {
      this.computeAndPersistLibraryState(animeId);
    }
  }

  private computeAndPersistLibraryState(animeId: number, repo?: LibraryRepository): void {
    const r = repo ?? this.deps.library;
    const groups = r.getEpisodeGroupsByAnimeId(animeId);
    const groupFiles: GroupFilesOnDisk[] = groups.map((g) => ({
      groupId: g.id,
      filesOnDisk: r.getFilesOnDiskByGroupId(g.id),
    }));
    const state = computeLibraryState(groupFiles);
    r.updateLibraryState(animeId, state);
  }

  animeExists(externalId: string, sourceDb = "tvdb"): boolean {
    return this.deps.library.findAnime(externalId, sourceDb) !== null;
  }

  animeExistsByTitle(title: string, sourceDb = "tvdb"): boolean {
    return this.deps.library.findAnimeByTitle(title, sourceDb) !== null;
  }
}
