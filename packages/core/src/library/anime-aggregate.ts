import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { stripTypeDir } from "../config/schema";
import type { FribbSource, IdentityResolver } from "../fribb/identity-resolver";
import type { LocalWatchStatus } from "../tracker/credential-utils";
import { mapTrackerStatus } from "../tracker/credential-utils";
import type {
  EntryType,
  MatchEntry,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
} from "../types";

import type { FranchiseService } from "./franchise-service";
import type {
  EpisodeGroup,
  GroupTrackerMapping,
  LibraryAnime,
  LibraryEpisode,
  LibraryRepository,
} from "./library-repository";

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
  season?: number;
  source: TrackerSource;
  sourceId: string;
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

function groupCompositeKey(
  anidbId: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${anidbId}:${entryType}:${seasonNumber ?? "null"}`;
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
  identityResolver: IdentityResolver;
  resolveTitleToAnidb: (title: string) => Promise<string | null>;
  franchiseService?: FranchiseService;
}

export class AnimeAggregate {
  constructor(private deps: AnimeAggregateDeps) {}

  get library(): LibraryRepository {
    return this.deps.library;
  }

  async retryPendingIdentification(): Promise<{
    resolved: Array<{ id: number; mergedInto?: number }>;
    stillPending: LibraryAnime[];
  }> {
    const pendingAnime = this.deps.library.findPendingAnime();
    const resolved: Array<{ id: number; mergedInto?: number }> = [];

    for (const entry of pendingAnime) {
      let resolvedAnidbId: string | null = null;

      if (entry.anidbId?.startsWith("tracker:")) {
        const parts = entry.anidbId.split(":");
        const source = parts[1];
        const sourceId = parts[2];
        if (source && sourceId) {
          try {
            resolvedAnidbId = await this.deps.identityResolver.resolveToAnidb(
              source as FribbSource,
              sourceId,
            );
          } catch {
            // IdentityResolver failed
          }
        }
      } else if (entry.anidbId?.startsWith("temp:")) {
        resolvedAnidbId = await this.deps.resolveTitleToAnidb(entry.title);
      } else {
        resolvedAnidbId = this.resolveAnidbId(entry.title);
      }

      if (!resolvedAnidbId) continue;

      const existingAnime = this.deps.library.findAnimeByAnidbId(resolvedAnidbId);
      if (existingAnime) {
        this.deps.library.mergeAnimeInto(entry.id, existingAnime.id);
        resolved.push({ id: entry.id, mergedInto: existingAnime.id });
      } else {
        this.deps.library.updateAnimeAnidbId(entry.id, resolvedAnidbId);
        resolved.push({ id: entry.id });
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

    const resolvedMap = await this.resolveBatchIdentities(trackerList, source);

    let skipped = 0;
    const newEntries: typeof trackerList = [];

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
      const resolvedAnidbId = resolvedMap.get(entry.trackerId) ?? null;

      const linked = this.linkTrackerToExistingAnime(entry, source, selection, resolvedAnidbId);
      if (linked) continue;

      newEntries.push(entry);
    }

    if (newEntries.length > 0) {
      const mergeEntries: ImportMergeEntry[] = newEntries.map((entry) => ({
        kind: "import",
        title: entry.title,
        entryType: entry.entryType,
        source,
        sourceId: entry.trackerId,
        watchStatus: entry.watchStatus,
      }));

      await this.resolveAndMerge({ entries: mergeEntries, source });
    }

    return { imported: trackerList.length - skipped, skipped };
  }

  async getImportPreview(tracker: TrackerPlugin, source: TrackerSource): Promise<ImportPreview> {
    const trackerList = await tracker.getUserList();

    const resolvedMap = await this.resolveBatchIdentities(trackerList, source);

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

      const resolvedAnidbId = resolvedMap.get(entry.trackerId) ?? null;
      let existingAnimeId: number | null = null;

      if (resolvedAnidbId) {
        const anime = this.deps.library.findAnimeByAnidbId(resolvedAnidbId);
        if (anime) existingAnimeId = anime.id;
      }

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
    const anidbIdByMatchKey = new Map<string, string>();
    for (const match of matches) {
      const matchKey = `${match.animeId}:${match.sourceDb}`;
      if (anidbIdByMatchKey.has(matchKey)) continue;

      const existingAnime = this.deps.library.findAnime(match.animeId, match.sourceDb);
      if (existingAnime?.anidbId) {
        anidbIdByMatchKey.set(matchKey, existingAnime.anidbId);
        continue;
      }

      const resolved = this.resolveAnidbId(match.animeTitle);
      if (resolved) {
        anidbIdByMatchKey.set(matchKey, resolved);
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
        const identityKey = row.anidbId ?? externalIdByAnimeId.get(row.animeId);
        const key = identityKey ? `${identityKey}:${row.episodeNumber}` : null;
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
      const oldAnimeById = new Map<number, { anidbId: string | null }>();
      for (const a of tx.listAnime()) {
        oldAnimeById.set(a.id, { anidbId: a.anidbId ?? null });
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
        const identityKey = animeInfo?.anidbId ?? externalIdByAnimeId.get(group.animeId);
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
        const identityKey = animeInfo?.anidbId ?? externalIdByAnimeId.get(group.animeId);
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
      const anidbIdToAnimeId = new Map<string, number>();

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();
      const animeByMatchKey = new Map<string, number>();
      const animeByTitle = new Map<string, number>();

      for (const match of matches) {
        const matchKey = `${match.animeId}:${match.sourceDb}`;
        const resolvedAnidbId = anidbIdByMatchKey.get(matchKey);

        let animeId = resolvedAnidbId
          ? anidbIdToAnimeId.get(resolvedAnidbId)
          : animeByTitle.get(match.animeTitle.toLowerCase());
        if (!animeId) {
          animeId = animeByMatchKey.get(matchKey);
        }
        if (!animeId) {
          const libraryAnime = tx.upsertAnime({
            title: match.animeTitle,
            updatedAt: now,
            anidbId: resolvedAnidbId,
          });
          animeId = libraryAnime.id;
          if (resolvedAnidbId) {
            anidbIdToAnimeId.set(resolvedAnidbId, animeId);
          }
          animeByTitle.set(match.animeTitle.toLowerCase(), animeId);
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
            const identityKey = resolvedAnidbId ?? match.animeId;
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
              updatedAt: now,
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
            groupId: groupEntry.groupId,
            episode: match.episode,
            filePath: match.filePath,
            title: match.title,
          });

          const identityKey = resolvedAnidbId ?? match.animeId;
          const oldKey = `${identityKey}:${match.episode}`;
          let oldEpId = oldEpisodeKey.get(oldKey);

          if (oldEpId === undefined && resolvedAnidbId) {
            const fallbackKey = `${match.animeId}:${match.episode}`;
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

      for (const [oldAnimeId, mappings] of sourceMappingByAnimeId) {
        const animeInfo = oldAnimeById.get(oldAnimeId);
        if (!animeInfo?.anidbId) continue;
        const newAnimeId = anidbIdToAnimeId.get(animeInfo.anidbId);
        if (newAnimeId === undefined) continue;
        for (const mapping of mappings) {
          tx.createAnimeSourceMapping({
            animeId: newAnimeId,
            source: mapping.source,
            externalId: mapping.externalId,
          });
        }
      }
    });
  }

  async rebuild(sourceDb?: string): Promise<void> {
    await this.rebuildBase(sourceDb);
  }

  async rebuildWithTrackers(
    trackers: Array<{ plugin: TrackerPlugin; source: TrackerSource }>,
    sourceDb?: string,
  ): Promise<void> {
    const oldLocalStatuses = new Map<string, string>();
    const oldTrackerData = new Map<string, TrackerDataEntry[]>();

    this.deps.library.transaction((tx) => {
      for (const anime of tx.listAnime()) {
        if (!anime.anidbId) continue;
        const groups = tx.getEpisodeGroupsByAnimeId(anime.id);
        for (const group of groups) {
          if (group.watchStatus !== "plan_to_watch") {
            oldLocalStatuses.set(
              `${anime.anidbId}:${group.entryType}:${group.seasonNumber ?? 1}`,
              group.watchStatus,
            );
          }
          const mappings = tx.getTrackerMappingsByGroupId(group.id);
          for (const mapping of mappings) {
            const compositeKey = `${mapping.source}:${mapping.externalId}`;
            const existing = oldTrackerData.get(compositeKey);
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
              oldTrackerData.set(compositeKey, [entry]);
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
    const statusesByAnidb = new Map<string, Map<string, string>>();
    for (const [compositeKey, status] of oldLocalStatuses) {
      const firstColon = compositeKey.indexOf(":");
      if (firstColon === -1) continue;
      const anidbId = compositeKey.slice(0, firstColon);
      const groupKey = compositeKey.slice(firstColon + 1);
      let groupMap = statusesByAnidb.get(anidbId);
      if (!groupMap) {
        groupMap = new Map();
        statusesByAnidb.set(anidbId, groupMap);
      }
      groupMap.set(groupKey, status);
    }

    for (const [anidbId, groupStatuses] of statusesByAnidb) {
      const anime = this.deps.library.findAnimeByAnidbId(anidbId);
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

    for (const [compositeKey, trackerEntries] of oldTrackerData) {
      const colonIdx = compositeKey.indexOf(":");
      const trackerSource = compositeKey.slice(0, colonIdx);
      const trackerExternalId = compositeKey.slice(colonIdx + 1);

      const sourceMapping = this.deps.library.findAnimeSourceMapping(
        trackerSource,
        trackerExternalId,
      );
      if (!sourceMapping) continue;
      const anime = this.deps.library.getAnime(sourceMapping.animeId);
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
    const allAnimeIds: number[] = [];
    const newAnimeIds: number[] = [];

    const entriesByAnidbId = new Map<string, MergeEntry[]>();
    for (const entry of input.entries) {
      const anidbId = await this.resolveEntryAnidbId(entry);

      const existing = entriesByAnidbId.get(anidbId);
      if (existing) {
        existing.push(entry);
      } else {
        entriesByAnidbId.set(anidbId, [entry]);
      }
    }

    for (const [anidbId, entries] of entriesByAnidbId) {
      const { animeId, isNew } = this.findOrCreateAnimeForMerge(anidbId, entries);
      allAnimeIds.push(animeId);
      if (isNew) newAnimeIds.push(animeId);

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      this.processMergeEntries(animeId, entries, groupKeyToGroup);
      this.createSourceMappingsFromEntries(animeId, entries);
    }

    for (const animeId of allAnimeIds) {
      this.cleanupEmptyGroups(animeId);
    }

    for (const animeId of newAnimeIds) {
      if (this.deps.franchiseService) {
        const anime = this.deps.library.getAnime(animeId);
        if (anime) {
          await this.deps.franchiseService.assignFranchise(anime);
        }
      }
    }

    return { animeIds: allAnimeIds };
  }

  private async resolveEntryAnidbId(entry: MergeEntry): Promise<string> {
    const sourceId = entry.kind === "import" ? entry.sourceId : entry.externalId;
    const sourceName = entry.source;

    // Tier 1: anime_source_mappings cache
    if (sourceId && sourceName) {
      const mapping = this.deps.library.findAnimeSourceMapping(sourceName, sourceId);
      if (mapping) {
        const anime = this.deps.library.getAnime(mapping.animeId);
        if (anime?.anidbId) {
          return anime.anidbId;
        }
      }
    }

    // Tier 2: IdentityResolver
    if (sourceId && sourceName) {
      try {
        const resolved = await this.deps.identityResolver.resolveToAnidb(
          sourceName as FribbSource,
          sourceId,
        );
        if (resolved) {
          const existingAnime = this.deps.library.findAnimeByAnidbId(resolved);
          if (existingAnime) {
            this.deps.library.createAnimeSourceMapping({
              animeId: existingAnime.id,
              source: sourceName,
              externalId: sourceId,
            });
          }
          return resolved;
        }
      } catch {
        // IdentityResolver failed, fall through to tier 3
      }
    }

    // Tier 3: Title match in library
    const titleAnidbId = this.resolveAnidbId(entry.title);
    if (titleAnidbId) {
      return titleAnidbId;
    }

    // Tier 4: Synthetic ID
    if (sourceId && sourceName) {
      return `tracker:${sourceName}:${sourceId}`;
    }
    return `temp:${crypto.randomUUID()}`;
  }

  private async resolveBatchIdentities(
    trackerList: Array<{ trackerId: string }>,
    source: TrackerSource,
  ): Promise<Map<string, string | null>> {
    const entriesToResolve = trackerList
      .filter((entry) => !this.deps.library.findGroupByTrackerExternalId(source, entry.trackerId))
      .map((entry) => ({ source: source as FribbSource, sourceId: entry.trackerId }));

    const resolvedEntries =
      entriesToResolve.length > 0
        ? await this.deps.identityResolver.resolveBatchToAnidb(entriesToResolve)
        : [];

    const resolvedMap = new Map<string, string | null>();
    for (const result of resolvedEntries) {
      resolvedMap.set(result.sourceId, result.anidbId);
    }

    for (const result of resolvedEntries) {
      if (result.anidbId) {
        const existingAnime = this.deps.library.findAnimeByAnidbId(result.anidbId);
        if (existingAnime) {
          this.deps.library.createAnimeSourceMapping({
            animeId: existingAnime.id,
            source,
            externalId: result.sourceId,
          });
        }
      }
    }

    return resolvedMap;
  }

  private linkTrackerToExistingAnime(
    entry: { trackerId: string; entryType: EntryType; watchStatus: TrackerWatchStatus },
    source: TrackerSource,
    selection: ImportSelection | undefined,
    resolvedAnidbId: string | null,
  ): boolean {
    // Explicit user selection takes priority
    if (selection?.groupId) {
      const group = this.deps.library.getEpisodeGroup(selection.groupId);
      if (group) {
        this.deps.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source,
          externalId: entry.trackerId,
        });
        if (selection.resolution !== "keepLocal") {
          this.deps.library.updateEpisodeGroupStatus(group.id, mapTrackerStatus(entry.watchStatus));
        }
        return true;
      }
    }

    // Identity resolution: find or create a group for the resolved anime
    if (resolvedAnidbId) {
      const anime = this.deps.library.findAnimeByAnidbId(resolvedAnidbId);
      if (anime) {
        const groups = this.deps.library.getEpisodeGroupsByAnimeId(anime.id);
        let targetGroup = groups.find(
          (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === 1,
        );

        if (!targetGroup) {
          targetGroup = this.deps.library.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: entry.entryType,
            seasonNumber: 1,
            watchStatus: mapTrackerStatus(entry.watchStatus),
          });
        }

        this.deps.library.upsertGroupTrackerMapping({
          groupId: targetGroup.id,
          source,
          externalId: entry.trackerId,
        });

        if (selection?.resolution !== "keepLocal") {
          this.deps.library.updateEpisodeGroupStatus(
            targetGroup.id,
            mapTrackerStatus(entry.watchStatus),
          );
        }
        return true;
      }
    }

    return false;
  }

  private resolveAnidbId(title: string): string | null {
    const titleLower = title.toLowerCase();
    const allAnime = this.deps.library.listAnime();
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

  private findOrCreateAnimeForMerge(
    anidbId: string,
    entries: MergeEntry[],
  ): { animeId: number; isNew: boolean } {
    const existingAnime = this.deps.library.findAnimeByAnidbId(anidbId);
    if (existingAnime) {
      return { animeId: existingAnime.id, isNew: false };
    }

    const firstEntry = entries[0];
    if (!firstEntry) return { animeId: 0, isNew: false };

    const anime = this.deps.library.upsertAnime({
      title: firstEntry.title,
      anidbId,
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
      } else if (entry.kind === "import" && entry.sourceId && entry.source) {
        this.deps.library.createAnimeSourceMapping({
          animeId,
          source: entry.source,
          externalId: entry.sourceId,
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
      updatedAt: existingGroup ? new Date().toISOString() : undefined,
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
          groupId: groupEntry.groupId,
          episode: ep.episode,
          filePath: ep.filePath,
          title: ep.title,
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
        source: entry.source,
        externalId: entry.sourceId,
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
  }

  deleteEpisodesByIds(ids: number[]): void {
    if (ids.length === 0) return;
    this.deps.library.deleteEpisodesByIds(ids);
  }

  animeExists(externalId: string, sourceDb = "tvdb"): boolean {
    return this.deps.library.findAnime(externalId, sourceDb) !== null;
  }

  animeExistsByTitle(title: string): boolean {
    return this.deps.library.findAnimeByTitle(title) !== null;
  }
}
