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
import { FranchiseAggregate } from "./franchise-aggregate";
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
  externalId?: string;
  source?: string;
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

function groupCompositeKey(
  anilistId: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${anilistId}:${entryType}:${seasonNumber ?? "null"}`;
}

interface TrackerDataEntry {
  source: TrackerSource;
  externalId: string;
  entryType: EntryType;
  seasonNumber: number | null;
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

    let skipped = 0;
    const newEntries: typeof trackerList = [];
    const existingAnimeEntries: Array<{
      entry: (typeof trackerList)[number];
      selection: ImportSelection | undefined;
      existingAnime: { id: number };
    }> = [];

    for (const entry of trackerList) {
      const existingMapping = this.deps.library.findGroupByTrackerExternalId(
        source,
        entry.trackerId,
      );
      if (existingMapping) {
        skipped++;
        continue;
      }

      const selection = selectionMap.get(entry.trackerId);
      const existingAnime = this.findExistingAnimeForImport(entry, selection, matchResults);

      if (existingAnime) {
        existingAnimeEntries.push({ entry, selection, existingAnime });
      } else {
        newEntries.push(entry);
      }
    }

    for (const { entry, selection, existingAnime } of existingAnimeEntries) {
      this.processEntryForExistingAnime(entry, selection, existingAnime, source);
    }

    if (newEntries.length > 0) {
      const mergeEntries: ImportMergeEntry[] = newEntries.map((entry) => ({
        kind: "import",
        title: entry.title,
        entryType: entry.entryType,
        anilistId: source === "anilist" ? entry.trackerId : "",
        trackerSource: source,
        trackerId: entry.trackerId,
        watchStatus: entry.watchStatus,
      }));

      await this.resolveAndMerge({ entries: mergeEntries, source });
    }

    return { imported: trackerList.length - skipped, skipped };
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
      const sourceDb = filters.sourceDb;
      animeList = animeList.filter(
        (a) => this.deps.library.getAnimeSourceMapping(a.id, sourceDb) !== null,
      );
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

    const knownAnilistIds = this.deps.library.getAnilistIdsFromTrackerMappings();
    const animeAnilistIds = this.deps.library.getAnilistIdsFromSourceMappings();
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
  ): void {
    const groups = this.deps.library.getEpisodeGroupsByAnimeId(existingAnime.id);

    let targetGroup = groups.find(
      (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === 1,
    );

    if (selection?.groupId) {
      const linkedGroup = this.deps.library.getEpisodeGroup(selection.groupId);
      if (linkedGroup) targetGroup = linkedGroup;
    }

    if (!targetGroup) {
      const createdGroup = this.deps.library.upsertEpisodeGroup({
        animeId: existingAnime.id,
        entryType: entry.entryType,
        seasonNumber: 1,
        watchStatus: mapTrackerStatus(entry.watchStatus),
      });

      this.deps.library.upsertGroupTrackerMapping({
        groupId: createdGroup.id,
        source,
        externalId: entry.trackerId,
      });
    } else {
      if (selection?.resolution !== "keepLocal") {
        this.deps.library.updateEpisodeGroupStatus(
          targetGroup.id,
          mapTrackerStatus(entry.watchStatus),
        );
      }
      this.deps.library.upsertGroupTrackerMapping({
        groupId: targetGroup.id,
        source,
        externalId: entry.trackerId,
      });
    }
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

  async rebuildFromMatches(
    matches: MatchEntry[],
    onBeforeWipe?: (snapshot: {
      groupByCompositeKey: Map<string, number>;
      episodeByCompositeKey: Map<string, number>;
    }) => void,
  ): Promise<void> {
    const anilistIdByMatchKey = new Map<string, string>();
    for (const match of matches) {
      const matchKey = `${match.animeId}:${match.sourceDb}`;
      if (anilistIdByMatchKey.has(matchKey)) continue;

      const existingAnime = this.deps.library.findAnime(match.animeId, match.sourceDb);
      if (existingAnime?.anilistId) {
        anilistIdByMatchKey.set(matchKey, existingAnime.anilistId);
        continue;
      }

      const provider = await this.ensureEnrichmentProvider();
      const resolved = await this.resolveAnilistId(match.animeTitle, provider);
      if (resolved) {
        anilistIdByMatchKey.set(matchKey, resolved);
      }
    }

    this.deps.library.transaction((tx) => {
      const oldState = tx.getAllEpisodesWithAnime();

      const oldEpisodeKey = new Map<string, number>();
      const oldWatched = new Map<number, boolean>();
      const oldNotes = new Map<number, string | undefined>();

      const allSourceMappings = tx.getAllAnimeSourceMappings();
      const externalIdByAnimeId = new Map<number, string>();
      for (const mapping of allSourceMappings) {
        if (!externalIdByAnimeId.has(mapping.animeId)) {
          externalIdByAnimeId.set(mapping.animeId, mapping.externalId);
        }
      }

      for (const row of oldState) {
        const identityKey = row.anilistId ?? externalIdByAnimeId.get(row.animeId);
        const key = identityKey ? `${identityKey}:${row.season ?? 1}:${row.episodeNumber}` : null;
        if (key) {
          oldEpisodeKey.set(key, row.episodeId);
        }
        oldWatched.set(row.episodeId, row.watched);
        const ep = tx.getEpisode(row.episodeId);
        if (ep) {
          oldNotes.set(row.episodeId, ep.notes);
        }
      }

      const oldGroups = tx.getAllEpisodeGroups();
      const oldAnimeById = new Map<number, { anilistId: string | null }>();
      for (const a of tx.listAnime()) {
        oldAnimeById.set(a.id, { anilistId: a.anilistId ?? null });
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
        const identityKey = animeInfo?.anilistId ?? externalIdByAnimeId.get(group.animeId);
        if (!identityKey) continue;
        const key = groupCompositeKey(identityKey, group.entryType, group.seasonNumber);
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
        const identityKey = animeInfo?.anilistId ?? externalIdByAnimeId.get(group.animeId);
        if (!identityKey) continue;
        const key = groupCompositeKey(identityKey, group.entryType, group.seasonNumber);
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

      const oldSourceMappings = tx.getAllAnimeSourceMappings();
      const sourceMappingByAnimeId = new Map<number, typeof oldSourceMappings>();
      for (const m of oldSourceMappings) {
        const list = sourceMappingByAnimeId.get(m.animeId);
        if (list) {
          list.push(m);
        } else {
          sourceMappingByAnimeId.set(m.animeId, [m]);
        }
      }

      tx.deleteAll();

      const now = new Date().toISOString();
      const animeIds = new Set<number>();
      const anilistIdToAnimeId = new Map<string, number>();

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();
      const animeByMatchKey = new Map<string, number>();

      for (const match of matches) {
        const matchKey = `${match.animeId}:${match.sourceDb}`;
        const resolvedAnilistId = anilistIdByMatchKey.get(matchKey);

        let animeId = resolvedAnilistId
          ? anilistIdToAnimeId.get(resolvedAnilistId)
          : animeByMatchKey.get(matchKey);
        if (!animeId) {
          const libraryAnime = tx.upsertAnime({
            title: match.animeTitle,
            episodeCount: 0,
            lastSynced: now,
            anilistId: resolvedAnilistId,
          });
          animeId = libraryAnime.id;
          if (resolvedAnilistId) {
            anilistIdToAnimeId.set(resolvedAnilistId, animeId);
          }
        }

        tx.createAnimeSourceMapping({
          animeId,
          source: match.sourceDb,
          externalId: match.animeId,
        });
        animeByMatchKey.set(matchKey, animeId);

        animeIds.add(animeId);

        if (match.episode !== null && match.filePath) {
          const seasonNum = match.season ?? 1;
          const groupKey = `${animeId}:${match.entryType}:${seasonNum}`;

          let groupEntry = groupKeyToGroup.get(groupKey);
          if (!groupEntry) {
            const identityKey = resolvedAnilistId ?? match.animeId;
            const compositeKey = groupCompositeKey(identityKey, match.entryType, match.season ?? 1);
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

          const identityKey = resolvedAnilistId ?? match.animeId;
          const oldKey = `${identityKey}:${match.season ?? 1}:${match.episode}`;
          let oldEpId = oldEpisodeKey.get(oldKey);

          if (oldEpId === undefined && resolvedAnilistId) {
            const fallbackKey = `${match.animeId}:${match.season ?? 1}:${match.episode}`;
            oldEpId = oldEpisodeKey.get(fallbackKey);
          }

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

      for (const [oldAnimeId, mappings] of sourceMappingByAnimeId) {
        const animeInfo = oldAnimeById.get(oldAnimeId);
        if (!animeInfo?.anilistId) continue;
        const newAnimeId = anilistIdToAnimeId.get(animeInfo.anilistId);
        if (newAnimeId === undefined) continue;
        for (const mapping of mappings) {
          tx.createAnimeSourceMapping({
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

        const mapping = tx.getAnimeSourceMapping(id, "anilist");
        if (!mapping) continue;

        const franchise = tx.findFranchiseByAnilistId(mapping.externalId);
        if (franchise) {
          tx.assignAnimeToFranchise(id, franchise.id);
        }
      }
    });
  }

  async rebuild(sourceDb?: string): Promise<void> {
    await this.rebuildBase(sourceDb);
    const unenrichedIds = this.deps.library.getUnenrichedAnimeIds();
    if (unenrichedIds.length > 0) {
      await this.enrichAnime(unenrichedIds);
    }
  }

  async rebuildWithTrackers(
    trackers: Array<{ plugin: TrackerPlugin; source: TrackerSource }>,
    sourceDb?: string,
  ): Promise<void> {
    const oldLocalStatuses = new Map<string, string>();
    const oldTrackerData = new Map<string, TrackerDataEntry[]>();

    this.deps.library.transaction((tx) => {
      for (const anime of tx.listAnime()) {
        if (!anime.anilistId) continue;
        const groups = tx.getEpisodeGroupsByAnimeId(anime.id);
        for (const group of groups) {
          if (group.watchStatus !== "plan_to_watch") {
            oldLocalStatuses.set(
              `${anime.anilistId}:${group.entryType}:${group.seasonNumber ?? 1}`,
              group.watchStatus,
            );
          }
          const mappings = tx.getTrackerMappingsByGroupId(group.id);
          for (const mapping of mappings) {
            const existing = oldTrackerData.get(anime.anilistId);
            const entry: {
              source: TrackerSource;
              externalId: string;
              entryType: EntryType;
              seasonNumber: number | null;
            } = {
              source: mapping.source as TrackerSource,
              externalId: mapping.externalId,
              entryType: group.entryType,
              seasonNumber: group.seasonNumber ?? null,
            };
            if (existing) {
              existing.push(entry);
            } else {
              oldTrackerData.set(anime.anilistId, [entry]);
            }
          }
        }
      }
    });

    await this.rebuildBase(sourceDb);

    for (const { plugin, source } of trackers) {
      await this.importFromTracker(plugin, source);
    }

    this.reconcileAfterReimport(oldLocalStatuses, oldTrackerData);
  }

  private reconcileAfterReimport(
    oldLocalStatuses: Map<string, string>,
    oldTrackerData: Map<string, TrackerDataEntry[]>,
  ): void {
    const statusesByAnilist = new Map<string, Map<string, string>>();
    for (const [compositeKey, status] of oldLocalStatuses) {
      const firstColon = compositeKey.indexOf(":");
      if (firstColon === -1) continue;
      const anilistId = compositeKey.slice(0, firstColon);
      const groupKey = compositeKey.slice(firstColon + 1);
      let groupMap = statusesByAnilist.get(anilistId);
      if (!groupMap) {
        groupMap = new Map();
        statusesByAnilist.set(anilistId, groupMap);
      }
      groupMap.set(groupKey, status);
    }

    for (const [anilistId, groupStatuses] of statusesByAnilist) {
      const anime = this.deps.library.findAnimeByAnilistId(anilistId);
      if (!anime) continue;

      const groups = this.deps.library.getEpisodeGroupsByAnimeId(anime.id);
      for (const group of groups) {
        const groupKey = `${group.entryType}:${group.seasonNumber ?? 1}`;
        const savedStatus = groupStatuses.get(groupKey);
        if (savedStatus && group.watchStatus !== savedStatus) {
          this.deps.library.updateEpisodeGroupStatus(group.id, savedStatus as LocalWatchStatus);
        }
      }
    }

    for (const [anilistId, trackerEntries] of oldTrackerData) {
      const anime = this.deps.library.findAnimeByAnilistId(anilistId);
      if (!anime) continue;

      const groups = this.deps.library.getEpisodeGroupsByAnimeId(anime.id);
      for (const trackerEntry of trackerEntries) {
        const targetGroup = groups.find(
          (g) =>
            g.entryType === trackerEntry.entryType &&
            (g.seasonNumber ?? 1) === (trackerEntry.seasonNumber ?? 1),
        );
        if (!targetGroup) continue;

        const existingMapping = this.deps.library.getTrackerMapping(
          targetGroup.id,
          trackerEntry.source,
        );
        if (!existingMapping) {
          this.deps.library.upsertGroupTrackerMapping({
            groupId: targetGroup.id,
            source: trackerEntry.source,
            externalId: trackerEntry.externalId,
          });
        }
      }
    }
  }

  private async rebuildBase(sourceDb?: string): Promise<void> {
    const matches = this.getFilteredMatches(sourceDb);
    let oldEntitySnapshot:
      | {
          groupByCompositeKey: Map<string, number>;
          episodeByCompositeKey: Map<string, number>;
        }
      | undefined;

    await this.rebuildFromMatches(matches, (snapshot) => {
      oldEntitySnapshot = snapshot;
    });

    if (oldEntitySnapshot) {
      this.deps.replayUnpushedEvents(oldEntitySnapshot);
    }
  }

  async mergeFromMatches(matches: MatchEntry[]): Promise<void> {
    const grouped = new Map<string, MatchEntry[]>();
    for (const match of matches) {
      const key = `${match.animeTitle}\0${match.entryType}\0${match.season ?? 1}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(key, [match]);
      }
    }

    const entries: ScanMergeEntry[] = [];
    for (const group of grouped.values()) {
      const first = group[0];
      if (!first) continue;
      entries.push({
        kind: "scan",
        title: first.animeTitle,
        entryType: first.entryType,
        season: first.season ?? 1,
        episodes: group
          .filter((m): m is MatchEntry & { episode: number } => m.episode !== null)
          .map((m) => ({
            episode: m.episode,
            filePath: m.filePath,
            title: m.title ?? undefined,
          })),
        externalId: first.animeId,
        source: first.sourceDb,
      });
    }

    const source = matches[0]?.sourceDb ?? "tvdb";
    await this.resolveAndMerge({ entries, source });
  }

  async resolveAndMerge(input: ResolveAndMergeInput): Promise<ResolveAndMergeResult> {
    const provider = await this.ensureEnrichmentProvider();
    const allAnimeIds: number[] = [];
    const newAnimeIds: number[] = [];

    const entriesByAnilistId = new Map<string, MergeEntry[]>();
    for (const entry of input.entries) {
      let anilistId: string | null = entry.anilistId ?? null;

      if (!anilistId) {
        const sourceId = entry.kind === "import" ? entry.trackerId : entry.externalId;
        const sourceName = entry.kind === "import" ? entry.trackerSource : entry.source;
        if (sourceId && sourceName) {
          const mapping = this.deps.library.findAnimeSourceMapping(sourceName, sourceId);
          if (mapping) {
            const anime = this.deps.library.getAnime(mapping.animeId);
            if (anime?.anilistId) {
              anilistId = anime.anilistId;
            }
          }
        }
      }

      if (!anilistId) {
        anilistId = await this.resolveAnilistId(entry.title, provider);
      }

      if (!anilistId) {
        anilistId = `temp:${crypto.randomUUID()}`;
      }

      const existing = entriesByAnilistId.get(anilistId);
      if (existing) {
        existing.push(entry);
      } else {
        entriesByAnilistId.set(anilistId, [entry]);
      }
    }

    for (const [anilistId, entries] of entriesByAnilistId) {
      const { animeId, isNew } = this.findOrCreateAnimeForMerge(anilistId, entries);
      allAnimeIds.push(animeId);
      if (isNew) newAnimeIds.push(animeId);

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      this.processMergeEntries(animeId, entries, groupKeyToGroup);
      this.deps.library.updateEpisodeCount(animeId);
      this.createSourceMappingsFromEntries(animeId, entries);
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
      title: firstEntry.title,
      episodeCount: totalEpisodes,
      anilistId,
    });

    return { animeId: anime.id, isNew: true };
  }

  private createSourceMappingsFromEntries(animeId: number, entries: MergeEntry[]): void {
    for (const entry of entries) {
      if (entry.kind === "scan" && entry.externalId && entry.source) {
        this.deps.library.createAnimeSourceMapping({
          animeId,
          source: entry.source,
          externalId: entry.externalId,
        });
      }
    }
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
    const scanEntries = entries.filter((e) => e.kind === "scan");
    const importEntries = entries.filter((e) => e.kind === "import");

    for (const entry of scanEntries) {
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
    }

    for (const entry of importEntries) {
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
    this.deps.library.updateAnime(animeId, { coverArtPath });
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

  animeExistsByTitle(title: string): boolean {
    return this.deps.library.findAnimeByTitle(title) !== null;
  }
}
