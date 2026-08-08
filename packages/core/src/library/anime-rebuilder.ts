import { existsSync } from "node:fs";
import type { FribbSource, IdentityResolver } from "../fribb/identity-resolver";
import { mapTrackerStatus } from "../tracker/credential-utils";
import type {
  EntryType,
  MatchEntry,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
} from "../types";
import { AnidbResolver } from "./anidb-resolver";
import type { AnimeRepository } from "./anime-repository";
import { exportMatchesFromRepo } from "./anime-repository";
import type { EpisodeRepository } from "./episode-repository";
import type { FranchiseService } from "./franchise-service";
import type { GroupRepository } from "./group-repository";
import {
  type BeforeWipeSnapshot,
  captureState,
  captureTrackerState,
  groupCompositeKey,
  restoreEpisodeWatched,
  restoreTrackerData,
  type StateSnapshot,
} from "./state-snapshot";

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

export type { TrackerDataEntry } from "./state-snapshot";

export interface RebuildOptions {
  sourceDb?: string;
  trackers?: Array<{ plugin: TrackerPlugin; source: TrackerSource }>;
  matches?: MatchEntry[];
  onBeforeWipe?: (snapshot: BeforeWipeSnapshot) => void;
}

export type RebuildSource = string | RebuildOptions;

export interface AnimeRebuilderDeps {
  anime: AnimeRepository;
  episodes: EpisodeRepository;
  groups: GroupRepository;
  replayUnpushedEvents: (oldSnapshot: {
    groupByCompositeKey: Map<string, number>;
    episodeByCompositeKey: Map<string, number>;
  }) => void;
  identityResolver: IdentityResolver;
  franchiseService?: FranchiseService;
  importFromTracker?: (
    tracker: TrackerPlugin,
    source: TrackerSource,
  ) => Promise<{ imported: number; skipped: number }>;
}

export class AnimeRebuilder {
  private anidbResolver: AnidbResolver;

  constructor(private deps: AnimeRebuilderDeps) {
    this.anidbResolver = new AnidbResolver(deps.anime);
  }

  async rebuild(sourceOrOptions?: RebuildSource): Promise<void> {
    const options: RebuildOptions =
      typeof sourceOrOptions === "string" ? { sourceDb: sourceOrOptions } : (sourceOrOptions ?? {});

    if (options.matches) {
      await this.rebuildFromMatches(options.matches, options.onBeforeWipe);
      return;
    }

    if (options.trackers) {
      await this.rebuildWithTrackers(options.trackers, options.sourceDb);
      return;
    }
    await this.rebuildFromSource(options.sourceDb);
  }

  async merge(input: MergeEntry[] | MatchEntry[]): Promise<ResolveAndMergeResult> {
    const first = input[0];
    if (first && "animeTitle" in first) {
      return this.mergeFromMatchEntries(input as MatchEntry[]);
    }
    const entries = input as MergeEntry[];
    return this.resolveAndMerge({ entries, source: entries[0]?.source ?? "tvdb" });
  }

  private async rebuildFromMatches(
    matches: MatchEntry[],
    onBeforeWipe?: (snapshot: BeforeWipeSnapshot) => void,
  ): Promise<void> {
    const anidbIdByMatchKey = this.preResolveAnidbIds(matches);

    this.deps.anime.transaction(({ anime: txAnime, episodes: txEpisodes, groups: txGroups }) => {
      const snapshot = captureState(txAnime, txEpisodes, txGroups);

      if (onBeforeWipe) {
        onBeforeWipe({
          groupByCompositeKey: snapshot.groupSnapshot.byCompositeKey,
          episodeByCompositeKey: snapshot.episodeSnapshot.episodeKey,
        });
      }

      this.deleteAll({ anime: txAnime, episodes: txEpisodes, groups: txGroups });

      const now = new Date().toISOString();
      const anidbIdToAnimeId = new Map<string, number>();
      const animeByMatchKey = new Map<string, number>();
      const animeByTitle = new Map<string, number>();
      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();
      const animeIds = new Set<number>();

      for (const match of matches) {
        const resolvedAnidbId = anidbIdByMatchKey.get(`${match.animeId}:${match.sourceDb}`);
        const animeId = this.resolveOrCreateAnime(txAnime, match, resolvedAnidbId, now, {
          anidbIdToAnimeId,
          animeByMatchKey,
          animeByTitle,
        });
        animeIds.add(animeId);

        if (match.episode !== null && match.filePath) {
          this.restoreOrCreateEpisode(
            txEpisodes,
            txGroups,
            match,
            animeId,
            resolvedAnidbId,
            now,
            snapshot,
            groupKeyToGroup,
          );
        }
      }

      this.restoreOldSourceMappings(txAnime, snapshot, anidbIdToAnimeId);
    });

    this.anidbResolver.invalidate();
  }

  private preResolveAnidbIds(matches: MatchEntry[]): Map<string, string> {
    const anidbIdByMatchKey = new Map<string, string>();
    for (const match of matches) {
      const matchKey = `${match.animeId}:${match.sourceDb}`;
      if (anidbIdByMatchKey.has(matchKey)) continue;

      const existingAnime = this.deps.anime.findAnime(match.animeId, match.sourceDb);
      if (existingAnime?.anidbId) {
        anidbIdByMatchKey.set(matchKey, existingAnime.anidbId);
        continue;
      }

      const resolved = this.anidbResolver.resolveByTitle(match.animeTitle);
      if (resolved) {
        anidbIdByMatchKey.set(matchKey, resolved);
      }
    }
    return anidbIdByMatchKey;
  }

  private resolveOrCreateAnime(
    txAnime: AnimeRepository,
    match: MatchEntry,
    resolvedAnidbId: string | undefined,
    now: string,
    lookup: {
      anidbIdToAnimeId: Map<string, number>;
      animeByMatchKey: Map<string, number>;
      animeByTitle: Map<string, number>;
    },
  ): number {
    const matchKey = `${match.animeId}:${match.sourceDb}`;

    let animeId = resolvedAnidbId
      ? lookup.anidbIdToAnimeId.get(resolvedAnidbId)
      : lookup.animeByTitle.get(match.animeTitle.toLowerCase());
    if (!animeId) {
      animeId = lookup.animeByMatchKey.get(matchKey);
    }
    if (!animeId) {
      const libraryAnime = txAnime.upsertAnime({
        title: match.animeTitle,
        updatedAt: now,
        anidbId: resolvedAnidbId,
      });
      animeId = libraryAnime.id;
      if (resolvedAnidbId) {
        lookup.anidbIdToAnimeId.set(resolvedAnidbId, animeId);
      }
      lookup.animeByTitle.set(match.animeTitle.toLowerCase(), animeId);
    }

    txAnime.createAnimeSourceMapping({
      animeId,
      source: match.sourceDb,
      externalId: match.animeId,
    });
    lookup.animeByMatchKey.set(matchKey, animeId);

    return animeId;
  }

  private restoreOrCreateEpisode(
    txEpisodes: EpisodeRepository,
    txGroups: GroupRepository,
    match: MatchEntry,
    animeId: number,
    resolvedAnidbId: string | undefined,
    now: string,
    snapshot: StateSnapshot,
    groupKeyToGroup: Map<string, { animeId: number; groupId: number }>,
  ): void {
    const seasonNum = match.season ?? 1;
    const groupKey = `${animeId}:${match.entryType}:${seasonNum}`;

    let groupEntry = groupKeyToGroup.get(groupKey);
    if (!groupEntry) {
      const identityKey = resolvedAnidbId ?? match.animeId;
      const compositeKey = groupCompositeKey(identityKey, match.entryType, match.season ?? 1);
      const savedState = snapshot.groupSnapshot.stateByKey.get(compositeKey);

      const group = txGroups.upsertEpisodeGroup({
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

      this.restoreGroupTrackerMappings(txGroups, compositeKey, group.id, snapshot);
    }

    const epResult = txEpisodes.upsertEpisodeFromMatch({
      groupId: groupEntry.groupId,
      episode: match.episode!,
      filePath: match.filePath,
      title: match.title,
    });

    const identityKey = resolvedAnidbId ?? match.animeId;
    const oldKey = `${identityKey}:${match.episode}`;
    let oldEpId = snapshot.episodeSnapshot.episodeKey.get(oldKey);

    if (oldEpId === undefined && resolvedAnidbId) {
      const fallbackKey = `${match.animeId}:${match.episode}`;
      oldEpId = snapshot.episodeSnapshot.episodeKey.get(fallbackKey);
    }

    if (oldEpId !== undefined) {
      restoreEpisodeWatched(txEpisodes, epResult.id, oldEpId, snapshot.episodeSnapshot);
    }
  }

  private restoreOldSourceMappings(
    txAnime: AnimeRepository,
    snapshot: StateSnapshot,
    anidbIdToAnimeId: Map<string, number>,
  ): void {
    for (const [oldAnimeId, mappings] of snapshot.sourceMappingByAnimeId) {
      const animeInfo = snapshot.oldAnimeById.get(oldAnimeId);
      if (!animeInfo?.anidbId) continue;
      const newAnimeId = anidbIdToAnimeId.get(animeInfo.anidbId);
      if (newAnimeId === undefined) continue;
      for (const mapping of mappings) {
        txAnime.createAnimeSourceMapping({
          animeId: newAnimeId,
          source: mapping.source,
          externalId: mapping.externalId,
        });
      }
    }
  }

  private restoreGroupTrackerMappings(
    txGroups: GroupRepository,
    compositeKey: string,
    groupId: number,
    snapshot: StateSnapshot,
  ): void {
    const savedMappings = snapshot.groupSnapshot.mappingsByKey.get(compositeKey);
    if (savedMappings) {
      for (const mapping of savedMappings) {
        txGroups.upsertGroupTrackerMapping({
          groupId,
          source: mapping.source,
          externalId: mapping.externalId,
        });
      }
    }
  }

  private async rebuildFromSource(sourceDb?: string): Promise<void> {
    const matches = this.getFilteredMatches(sourceDb);
    let oldEntitySnapshot: BeforeWipeSnapshot | undefined;

    await this.rebuildFromMatches(matches, (snapshot) => {
      oldEntitySnapshot = snapshot;
    });

    if (oldEntitySnapshot) {
      this.deps.replayUnpushedEvents(oldEntitySnapshot);
    }
  }

  private async rebuildWithTrackers(
    trackers: Array<{ plugin: TrackerPlugin; source: TrackerSource }>,
    sourceDb?: string,
  ): Promise<void> {
    if (!this.deps.importFromTracker) {
      throw new Error("importFromTracker dependency required for rebuild with trackers");
    }

    const { oldLocalStatuses, oldTrackerData } = captureTrackerState(
      this.deps.anime,
      this.deps.groups,
    );

    await this.rebuildFromSource(sourceDb);

    for (const { plugin, source } of trackers) {
      await this.deps.importFromTracker(plugin, source);
    }

    restoreTrackerData(this.deps.anime, this.deps.groups, oldLocalStatuses, oldTrackerData);
  }

  private async mergeFromMatchEntries(matches: MatchEntry[]): Promise<ResolveAndMergeResult> {
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
    return this.resolveAndMerge({ entries, source });
  }

  private async resolveAndMerge(input: ResolveAndMergeInput): Promise<ResolveAndMergeResult> {
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
        const anime = this.deps.anime.getAnime(animeId);
        if (anime) {
          await this.deps.franchiseService.assignFranchise(anime);
        }
      }
    }

    this.anidbResolver.invalidate();

    return { animeIds: allAnimeIds };
  }

  private async resolveEntryAnidbId(entry: MergeEntry): Promise<string> {
    const sourceId = entry.kind === "import" ? entry.sourceId : entry.externalId;
    const sourceName = entry.source;

    if (sourceId && sourceName) {
      const mapping = this.deps.anime.findAnimeSourceMapping(sourceName, sourceId);
      if (mapping) {
        const anime = this.deps.anime.getAnime(mapping.animeId);
        if (anime?.anidbId) {
          return anime.anidbId;
        }
      }

      try {
        const resolved = await this.deps.identityResolver.resolveToAnidb(
          sourceName as FribbSource,
          sourceId,
        );
        if (resolved) {
          const existingAnime = this.deps.anime.findAnimeByAnidbId(resolved);
          if (existingAnime) {
            this.deps.anime.createAnimeSourceMapping({
              animeId: existingAnime.id,
              source: sourceName,
              externalId: sourceId,
            });
          }
          return resolved;
        }
      } catch {}
    }

    const titleAnidbId = this.anidbResolver.resolveByTitle(entry.title);
    if (titleAnidbId) {
      return titleAnidbId;
    }

    if (sourceId && sourceName) {
      return `tracker:${sourceName}:${sourceId}`;
    }
    return `temp:${crypto.randomUUID()}`;
  }

  private findOrCreateAnimeForMerge(
    anidbId: string,
    entries: MergeEntry[],
  ): { animeId: number; isNew: boolean } {
    const existingAnime = this.deps.anime.findAnimeByAnidbId(anidbId);
    if (existingAnime) {
      return { animeId: existingAnime.id, isNew: false };
    }

    const firstEntry = entries[0];
    if (!firstEntry) return { animeId: 0, isNew: false };

    const anime = this.deps.anime.upsertAnime({
      title: firstEntry.title,
      anidbId,
    });

    return { animeId: anime.id, isNew: true };
  }

  private createSourceMappingsFromEntries(animeId: number, entries: MergeEntry[]): void {
    for (const entry of entries) {
      const externalId = entry.kind === "scan" ? entry.externalId : entry.sourceId;
      if (externalId && entry.source) {
        this.deps.anime.createAnimeSourceMapping({ animeId, source: entry.source, externalId });
      }
    }
  }

  private getOrCreateGroup(
    animeId: number,
    entryType: EntryType,
    seasonNumber: number,
    defaultWatchStatus: TrackerWatchStatus,
    groupKeyToGroup: Map<string, { animeId: number; groupId: number }>,
  ): { animeId: number; groupId: number } {
    const groupKey = `${animeId}:${entryType}:${seasonNumber}`;
    const cached = groupKeyToGroup.get(groupKey);
    if (cached) return cached;

    const existingGroup = this.deps.groups.findEpisodeGroup(animeId, entryType, seasonNumber);
    const group = this.deps.groups.upsertEpisodeGroup({
      animeId,
      entryType,
      seasonNumber,
      watchStatus: existingGroup?.watchStatus ?? mapTrackerStatus(defaultWatchStatus),
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
        "plan-to-watch",
        groupKeyToGroup,
      );

      for (const ep of entry.episodes) {
        this.deps.episodes.upsertEpisodeFromMatch({
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
        entry.watchStatus,
        groupKeyToGroup,
      );

      this.deps.groups.upsertGroupTrackerMapping({
        groupId: groupEntry.groupId,
        source: entry.source,
        externalId: entry.sourceId,
      });
    }
  }

  private cleanupEmptyGroups(animeId: number): void {
    const groups = this.deps.groups.getEpisodeGroupsByAnimeId(animeId);
    for (const group of groups) {
      const episodes = this.deps.episodes.getEpisodesByGroupId(group.id);
      if (episodes.length === 0) {
        const mappings = this.deps.groups.getTrackerMappingsByGroupId(group.id);
        const hasTrackerData = mappings.length > 0;
        const hasNonDefaultStatus = group.watchStatus !== "plan_to_watch";

        if (!hasTrackerData && !hasNonDefaultStatus) {
          this.deps.groups.deleteEpisodeGroup(group.id);
        }
      }
    }
  }

  private getFilteredMatches(sourceDb?: string): MatchEntry[] {
    const allMatches = this.exportMatches();
    const filtered = sourceDb ? allMatches.filter((m) => m.sourceDb === sourceDb) : allMatches;
    return filtered.filter((m) => existsSync(m.filePath));
  }

  private exportMatches(): MatchEntry[] {
    return exportMatchesFromRepo(this.deps.anime);
  }

  private deleteAll(repos?: {
    episodes: EpisodeRepository;
    groups: GroupRepository;
    anime: AnimeRepository;
  }): void {
    const episodes = repos?.episodes ?? this.deps.episodes;
    const groups = repos?.groups ?? this.deps.groups;
    const anime = repos?.anime ?? this.deps.anime;
    episodes.deleteAll();
    groups.deleteAll();
    anime.deleteAll();
  }
}
