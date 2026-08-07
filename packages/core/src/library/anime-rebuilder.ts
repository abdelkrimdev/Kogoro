import { existsSync } from "node:fs";
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
import type { AnimeRepository } from "./anime-repository";
import { exportMatchesFromRepo, resolveAnidbIdByTitle } from "./anime-repository";
import type { EpisodeRepository } from "./episode-repository";
import type { FranchiseService } from "./franchise-service";
import type { EpisodeGroup, GroupRepository, GroupTrackerMapping } from "./group-repository";

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

export interface TrackerDataEntry {
  source: TrackerSource;
  externalId: string;
  entryType: EntryType;
  seasonNumber: number | null;
}

function groupCompositeKey(
  anidbId: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${anidbId}:${entryType}:${seasonNumber ?? "null"}`;
}

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
  constructor(private deps: AnimeRebuilderDeps) {}

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

      const existingAnime = this.deps.anime.findAnime(match.animeId, match.sourceDb);
      if (existingAnime?.anidbId) {
        anidbIdByMatchKey.set(matchKey, existingAnime.anidbId);
        continue;
      }

      const resolved = resolveAnidbIdByTitle(this.deps.anime, match.animeTitle);
      if (resolved) {
        anidbIdByMatchKey.set(matchKey, resolved);
      }
    }

    this.deps.anime.transaction(({ anime: txAnime, episodes: txEpisodes, groups: txGroups }) => {
      const oldState = txEpisodes.getAllEpisodesWithAnime();

      const oldEpisodeKey = new Map<string, number>();
      const oldWatched = new Map<number, boolean>();
      const oldNotes = new Map<number, string | undefined>();

      const allSourceMappings = txAnime.getAllAnimeSourceMappings();
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
        const ep = txEpisodes.getEpisode(row.episodeId);
        if (ep) {
          oldNotes.set(row.episodeId, ep.notes);
        }
      }

      const oldGroups = txGroups.getAllEpisodeGroups();
      const oldAnimeById = new Map<number, { anidbId: string | null }>();
      for (const a of txAnime.listAnime()) {
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
      for (const mapping of txGroups.getAllTrackerMappings()) {
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

      const oldSourceMappings = txAnime.getAllAnimeSourceMappings();
      const sourceMappingByAnimeId = new Map<number, typeof oldSourceMappings>();
      for (const m of oldSourceMappings) {
        const list = sourceMappingByAnimeId.get(m.animeId);
        if (list) {
          list.push(m);
        } else {
          sourceMappingByAnimeId.set(m.animeId, [m]);
        }
      }

      this.deleteAll({ anime: txAnime, episodes: txEpisodes, groups: txGroups });

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
          const libraryAnime = txAnime.upsertAnime({
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

        txAnime.createAnimeSourceMapping({
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

            const savedMappings = mappingsByKey.get(compositeKey);
            if (savedMappings) {
              for (const mapping of savedMappings) {
                txGroups.upsertGroupTrackerMapping({
                  groupId: group.id,
                  source: mapping.source,
                  externalId: mapping.externalId,
                });
              }
            }
          }

          const epResult = txEpisodes.upsertEpisodeFromMatch({
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
              txEpisodes.migrateEpisodeWatched(epResult.id, oldWatchedValue);
            }
            const oldNotesValue = oldNotes.get(oldEpId);
            if (oldNotesValue !== undefined) {
              txEpisodes.migrateEpisodeNotes(epResult.id, oldNotesValue);
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
          txAnime.createAnimeSourceMapping({
            animeId: newAnimeId,
            source: mapping.source,
            externalId: mapping.externalId,
          });
        }
      }
    });
  }

  async rebuild(sourceDb?: string): Promise<void> {
    await this.rebuildFromSource(sourceDb);
  }

  async rebuildWithTrackers(
    trackers: Array<{ plugin: TrackerPlugin; source: TrackerSource }>,
    sourceDb?: string,
  ): Promise<void> {
    if (!this.deps.importFromTracker) {
      throw new Error("importFromTracker dependency required for rebuildWithTrackers");
    }

    const oldLocalStatuses = new Map<string, string>();
    const oldTrackerData = new Map<string, TrackerDataEntry[]>();

    this.deps.anime.transaction(({ anime: txAnime, groups: txGroups }) => {
      for (const anime of txAnime.listAnime()) {
        if (!anime.anidbId) continue;
        const groups = txGroups.getEpisodeGroupsByAnimeId(anime.id);
        for (const group of groups) {
          if (group.watchStatus !== "plan_to_watch") {
            oldLocalStatuses.set(
              `${anime.anidbId}:${group.entryType}:${group.seasonNumber ?? 1}`,
              group.watchStatus,
            );
          }
          const mappings = txGroups.getTrackerMappingsByGroupId(group.id);
          for (const mapping of mappings) {
            const compositeKey = `${mapping.source}:${mapping.externalId}`;
            const existing = oldTrackerData.get(compositeKey);
            const entry: TrackerDataEntry = {
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

    await this.rebuild(sourceDb);

    for (const { plugin, source } of trackers) {
      await this.deps.importFromTracker(plugin, source);
    }

    this.reconcileAfterReimport(oldLocalStatuses, oldTrackerData);
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
        const anime = this.deps.anime.getAnime(animeId);
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

    if (sourceId && sourceName) {
      const mapping = this.deps.anime.findAnimeSourceMapping(sourceName, sourceId);
      if (mapping) {
        const anime = this.deps.anime.getAnime(mapping.animeId);
        if (anime?.anidbId) {
          return anime.anidbId;
        }
      }
    }

    if (sourceId && sourceName) {
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

    const titleAnidbId = resolveAnidbIdByTitle(this.deps.anime, entry.title);
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
    defaultWatchStatus: LocalWatchStatus,
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
        mapTrackerStatus(entry.watchStatus),
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

  exportMatches(): MatchEntry[] {
    return exportMatchesFromRepo(this.deps.anime);
  }

  async rebuildFromSource(sourceDb?: string): Promise<void> {
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

  reconcileAfterReimport(
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
      const anime = this.deps.anime.findAnimeByAnidbId(anidbId);
      if (!anime) continue;

      const groups = this.deps.groups.getEpisodeGroupsByAnimeId(anime.id);
      for (const group of groups) {
        const groupKey = `${group.entryType}:${group.seasonNumber ?? 1}`;
        const savedStatus = groupStatuses.get(groupKey);
        if (savedStatus && group.watchStatus !== savedStatus) {
          this.deps.groups.updateEpisodeGroupStatus(group.id, savedStatus as LocalWatchStatus);
        }
      }
    }

    for (const [compositeKey, trackerEntries] of oldTrackerData) {
      const colonIdx = compositeKey.indexOf(":");
      const trackerSource = compositeKey.slice(0, colonIdx);
      const trackerExternalId = compositeKey.slice(colonIdx + 1);

      const sourceMapping = this.deps.anime.findAnimeSourceMapping(
        trackerSource,
        trackerExternalId,
      );
      if (!sourceMapping) continue;
      const anime = this.deps.anime.getAnime(sourceMapping.animeId);
      if (!anime) continue;

      const groups = this.deps.groups.getEpisodeGroupsByAnimeId(anime.id);
      for (const trackerEntry of trackerEntries) {
        const targetGroup = groups.find(
          (g) =>
            g.entryType === trackerEntry.entryType &&
            (g.seasonNumber ?? 1) === (trackerEntry.seasonNumber ?? 1),
        );
        if (!targetGroup) continue;

        const existingMapping = this.deps.groups.getTrackerMapping(
          targetGroup.id,
          trackerEntry.source,
        );
        if (!existingMapping) {
          this.deps.groups.upsertGroupTrackerMapping({
            groupId: targetGroup.id,
            source: trackerEntry.source,
            externalId: trackerEntry.externalId,
          });
        }
      }
    }
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
