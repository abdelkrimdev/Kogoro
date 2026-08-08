import type { FribbSource, IdentityResolver } from "../fribb/identity-resolver";
import { mapTrackerStatus } from "../tracker/credential-utils";
import type { EntryType, TrackerPlugin, TrackerSource, TrackerWatchStatus } from "../types";
import type { AnidbResolver } from "./anidb-resolver";
import type {
  ImportMergeEntry,
  ResolveAndMergeInput,
  ResolveAndMergeResult,
} from "./anime-rebuilder";
import type { AnimeRepository, LibraryAnime } from "./anime-repository";
import type { EpisodeRepository } from "./episode-repository";
import type { FranchiseService } from "./franchise-service";
import type { EpisodeGroup, GroupRepository } from "./group-repository";

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

export interface AnimeImporterDeps {
  anime: AnimeRepository;
  episodes: EpisodeRepository;
  groups: GroupRepository;
  identityResolver: IdentityResolver;
  resolveTitleToAnidb: (title: string) => Promise<string | null>;
  anidbResolver?: AnidbResolver;
  franchiseService?: FranchiseService;
  merge: (input: ResolveAndMergeInput) => Promise<ResolveAndMergeResult>;
}

export class AnimeImporter {
  constructor(private deps: AnimeImporterDeps) {}

  async retryPendingIdentification(): Promise<{
    resolved: Array<{ id: number; mergedInto?: number }>;
    stillPending: LibraryAnime[];
  }> {
    const pendingAnime = this.deps.anime.findPendingAnime();
    const resolved: Array<{ id: number; mergedInto?: number }> = [];

    for (const entry of pendingAnime) {
      let resolvedAnidbId: string | null = null;

      if (entry.anidbId?.startsWith("tracker:")) {
        const [, source, sourceId] = entry.anidbId.split(":");
        if (source && sourceId) {
          try {
            resolvedAnidbId = await this.deps.identityResolver.resolveToAnidb(
              source as FribbSource,
              sourceId,
            );
          } catch {}
        }
      } else if (entry.anidbId?.startsWith("temp:")) {
        resolvedAnidbId = await this.deps.resolveTitleToAnidb(entry.title);
      } else {
        resolvedAnidbId = this.deps.anidbResolver?.resolveByTitle(entry.title) ?? null;
      }

      if (!resolvedAnidbId) continue;

      const existingAnime = this.deps.anime.findAnimeByAnidbId(resolvedAnidbId);
      if (existingAnime) {
        this.mergeAnimeInto(entry.id, existingAnime.id);
        resolved.push({ id: entry.id, mergedInto: existingAnime.id });
      } else {
        this.deps.anime.updateAnimeAnidbId(entry.id, resolvedAnidbId);
        resolved.push({ id: entry.id });
      }
    }

    return {
      resolved,
      stillPending: this.deps.anime.findPendingAnime(),
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
      const existingMapping = this.deps.groups.findGroupByTrackerExternalId(
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

      await this.deps.merge({ entries: mergeEntries, source });
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
    const statusCounts: Record<TrackerWatchStatus, number> = {
      watching: 0,
      completed: 0,
      "plan-to-watch": 0,
      "on-hold": 0,
      dropped: 0,
    };

    for (const entry of trackerList) {
      if (seenTrackerIds.has(entry.trackerId)) continue;
      seenTrackerIds.add(entry.trackerId);

      const existingMapping = this.deps.groups.findGroupByTrackerExternalId(
        source,
        entry.trackerId,
      );
      if (existingMapping) {
        continue;
      }

      const resolvedAnidbId = resolvedMap.get(entry.trackerId) ?? null;
      let existingAnimeId: number | null = null;

      if (resolvedAnidbId) {
        const anime = this.deps.anime.findAnimeByAnidbId(resolvedAnidbId);
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
        const groups = this.deps.groups.getEpisodeGroupsByAnimeId(existingAnimeId);
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

  private async resolveBatchIdentities(
    trackerList: Array<{ trackerId: string }>,
    source: TrackerSource,
  ): Promise<Map<string, string | null>> {
    const entriesToResolve = trackerList
      .filter((entry) => !this.deps.groups.findGroupByTrackerExternalId(source, entry.trackerId))
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
        const existingAnime = this.deps.anime.findAnimeByAnidbId(result.anidbId);
        if (existingAnime) {
          this.deps.anime.createAnimeSourceMapping({
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
    if (selection?.groupId) {
      const group = this.deps.groups.getEpisodeGroup(selection.groupId);
      if (group) {
        this.deps.groups.upsertGroupTrackerMapping({
          groupId: group.id,
          source,
          externalId: entry.trackerId,
        });
        if (selection.resolution !== "keepLocal") {
          this.deps.groups.updateEpisodeGroupStatus(group.id, mapTrackerStatus(entry.watchStatus));
        }
        return true;
      }
    }

    if (resolvedAnidbId) {
      const anime = this.deps.anime.findAnimeByAnidbId(resolvedAnidbId);
      if (anime) {
        const groups = this.deps.groups.getEpisodeGroupsByAnimeId(anime.id);
        let targetGroup = groups.find(
          (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === 1,
        );

        if (!targetGroup) {
          targetGroup = this.deps.groups.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: entry.entryType,
            seasonNumber: 1,
            watchStatus: mapTrackerStatus(entry.watchStatus),
          });
        }

        this.deps.groups.upsertGroupTrackerMapping({
          groupId: targetGroup.id,
          source,
          externalId: entry.trackerId,
        });

        if (selection?.resolution !== "keepLocal") {
          this.deps.groups.updateEpisodeGroupStatus(
            targetGroup.id,
            mapTrackerStatus(entry.watchStatus),
          );
        }
        return true;
      }
    }

    return false;
  }

  private mergeAnimeInto(pendingAnimeId: number, canonicalAnimeId: number): void {
    const pendingGroups = this.deps.groups.getEpisodeGroupsByAnimeId(pendingAnimeId);
    const canonicalGroups = this.deps.groups.getEpisodeGroupsByAnimeId(canonicalAnimeId);
    const canonicalGroupKeys = new Map<string, EpisodeGroup>();
    for (const g of canonicalGroups) {
      canonicalGroupKeys.set(`${g.entryType}:${g.seasonNumber ?? "null"}`, g);
    }

    for (const pendingGroup of pendingGroups) {
      const key = `${pendingGroup.entryType}:${pendingGroup.seasonNumber ?? "null"}`;
      const targetGroup = canonicalGroupKeys.get(key);

      if (targetGroup) {
        const pendingEpisodes = this.deps.episodes.getEpisodesByGroupId(pendingGroup.id);
        for (const ep of pendingEpisodes) {
          const upsertedEpisode = this.deps.episodes.upsertEpisodeFromMatch({
            groupId: targetGroup.id,
            episode: ep.episodeNumber,
            filePath: ep.filePath,
            title: ep.title,
          });
          if (ep.watched) {
            this.deps.episodes.migrateEpisodeWatched(upsertedEpisode.id, true);
          }
        }

        const pendingMappings = this.deps.groups.getTrackerMappingsByGroupId(pendingGroup.id);
        for (const mapping of pendingMappings) {
          this.deps.groups.upsertGroupTrackerMapping({
            groupId: targetGroup.id,
            source: mapping.source,
            externalId: mapping.externalId,
          });
        }
      } else {
        this.deps.groups.updateEpisodeGroupAnimeId(pendingGroup.id, canonicalAnimeId);
      }
    }

    const pendingSourceMappings = this.deps.anime.getAnimeSourceMappingsByAnimeId(pendingAnimeId);
    for (const mapping of pendingSourceMappings) {
      this.deps.anime.createAnimeSourceMapping({
        animeId: canonicalAnimeId,
        source: mapping.source,
        externalId: mapping.externalId,
      });
    }

    this.deps.anime.deleteAnime(pendingAnimeId);
  }
}
