import type { LocalWatchStatus } from "../tracker/credential-utils";
import type { EntryType, TrackerSource } from "../types";
import type { AnimeRepository } from "./anime-repository";
import type { EpisodeRepository } from "./episode-repository";
import type { EpisodeGroup, GroupRepository, GroupTrackerMapping } from "./group-repository";

export interface SourceMapping {
  source: string;
  externalId: string;
}

export function groupCompositeKey(
  anidbId: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${anidbId}:${entryType}:${seasonNumber ?? "null"}`;
}

export interface EpisodeSnapshot {
  episodeKey: Map<string, number>;
  watched: Map<number, boolean>;
  notes: Map<number, string | undefined>;
}

export interface GroupState {
  watchStatus: EpisodeGroup["watchStatus"];
  synopsis?: string;
  rating?: number;
  coverArtPath?: string;
}

export interface GroupSnapshot {
  stateByKey: Map<string, GroupState>;
  byCompositeKey: Map<string, number>;
  mappingsByKey: Map<string, GroupTrackerMapping[]>;
}

export interface TrackerDataEntry {
  source: TrackerSource;
  externalId: string;
  entryType: EntryType;
  seasonNumber: number | null;
}

export interface StateSnapshot {
  episodeSnapshot: EpisodeSnapshot;
  groupSnapshot: GroupSnapshot;
  externalIdByAnimeId: Map<number, string>;
  sourceMappingByAnimeId: Map<number, SourceMapping[]>;
  oldAnimeById: Map<number, { anidbId: string | null }>;
}

export interface BeforeWipeSnapshot {
  groupByCompositeKey: Map<string, number>;
  episodeByCompositeKey: Map<string, number>;
}

function splitAtFirstColon(str: string): [string, string] | null {
  const colonIdx = str.indexOf(":");
  if (colonIdx === -1) return null;
  return [str.slice(0, colonIdx), str.slice(colonIdx + 1)];
}

export function captureState(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
): StateSnapshot {
  const allEpisodes = episodeRepo.getAllEpisodesWithAnime();

  const episodeKey = new Map<string, number>();
  const watched = new Map<number, boolean>();
  const notes = new Map<number, string | undefined>();

  const allSourceMappings = animeRepo.getAllAnimeSourceMappings();
  const externalIdByAnimeId = new Map<number, string>();
  const sourceMappingByAnimeId = new Map<number, SourceMapping[]>();
  for (const mapping of allSourceMappings) {
    if (!externalIdByAnimeId.has(mapping.animeId)) {
      externalIdByAnimeId.set(mapping.animeId, mapping.externalId);
    }
    const list = sourceMappingByAnimeId.get(mapping.animeId);
    if (list) {
      list.push(mapping);
    } else {
      sourceMappingByAnimeId.set(mapping.animeId, [mapping]);
    }
  }

  for (const row of allEpisodes) {
    const identityKey = row.anidbId ?? externalIdByAnimeId.get(row.animeId);
    const key = identityKey ? `${identityKey}:${row.episodeNumber}` : null;
    if (key) {
      episodeKey.set(key, row.episodeId);
    }
    watched.set(row.episodeId, row.watched);
    const ep = episodeRepo.getEpisode(row.episodeId);
    if (ep) {
      notes.set(row.episodeId, ep.notes);
    }
  }

  const allGroups = groupRepo.getAllEpisodeGroups();
  const oldAnimeById = new Map<number, { anidbId: string | null }>();
  for (const a of animeRepo.listAnime()) {
    oldAnimeById.set(a.id, { anidbId: a.anidbId ?? null });
  }

  const groupById = new Map<number, EpisodeGroup>();
  const stateByKey = new Map<string, GroupState>();
  const byCompositeKey = new Map<string, number>();

  for (const group of allGroups) {
    groupById.set(group.id, group);
    const animeInfo = oldAnimeById.get(group.animeId);
    const identityKey = animeInfo?.anidbId ?? externalIdByAnimeId.get(group.animeId);
    if (!identityKey) continue;
    const key = groupCompositeKey(identityKey, group.entryType, group.seasonNumber);
    stateByKey.set(key, {
      watchStatus: group.watchStatus,
      synopsis: group.synopsis,
      rating: group.rating,
      coverArtPath: group.coverArtPath,
    });
    byCompositeKey.set(key, group.id);
  }

  const mappingsByKey = new Map<string, GroupTrackerMapping[]>();
  for (const mapping of groupRepo.getAllTrackerMappings()) {
    const group = groupById.get(mapping.groupId);
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

  return {
    episodeSnapshot: { episodeKey, watched, notes },
    groupSnapshot: { stateByKey, byCompositeKey, mappingsByKey },
    externalIdByAnimeId,
    sourceMappingByAnimeId,
    oldAnimeById,
  };
}

export function restoreEpisodeWatched(
  episodeRepo: EpisodeRepository,
  newEpisodeId: number,
  oldEpisodeId: number,
  snapshot: EpisodeSnapshot,
): void {
  const oldWatchedValue = snapshot.watched.get(oldEpisodeId);
  if (oldWatchedValue !== undefined) {
    episodeRepo.migrateEpisodeWatched(newEpisodeId, oldWatchedValue);
  }
  const oldNotesValue = snapshot.notes.get(oldEpisodeId);
  if (oldNotesValue !== undefined) {
    episodeRepo.migrateEpisodeNotes(newEpisodeId, oldNotesValue);
  }
}

export function restoreTrackerData(
  animeRepo: AnimeRepository,
  groupRepo: GroupRepository,
  oldLocalStatuses: Map<string, LocalWatchStatus>,
  oldTrackerData: Map<string, TrackerDataEntry[]>,
): void {
  const statusesByAnidb = new Map<string, Map<string, LocalWatchStatus>>();
  for (const [compositeKey, status] of oldLocalStatuses) {
    const parsed = splitAtFirstColon(compositeKey);
    if (!parsed) continue;
    const [anidbId, groupKey] = parsed;
    let groupMap = statusesByAnidb.get(anidbId);
    if (!groupMap) {
      groupMap = new Map();
      statusesByAnidb.set(anidbId, groupMap);
    }
    groupMap.set(groupKey, status);
  }

  for (const [anidbId, groupStatuses] of statusesByAnidb) {
    const anime = animeRepo.findAnimeByAnidbId(anidbId);
    if (!anime) continue;

    const groups = groupRepo.getEpisodeGroupsByAnimeId(anime.id);
    for (const group of groups) {
      const groupKey = `${group.entryType}:${group.seasonNumber ?? 1}`;
      const savedStatus = groupStatuses.get(groupKey);
      if (savedStatus && group.watchStatus !== savedStatus) {
        groupRepo.updateEpisodeGroupStatus(group.id, savedStatus);
      }
    }
  }

  for (const [compositeKey, trackerEntries] of oldTrackerData) {
    const parsed = splitAtFirstColon(compositeKey);
    if (!parsed) continue;
    const [trackerSource, trackerExternalId] = parsed;

    const sourceMapping = animeRepo.findAnimeSourceMapping(trackerSource, trackerExternalId);
    if (!sourceMapping) continue;
    const anime = animeRepo.getAnime(sourceMapping.animeId);
    if (!anime) continue;

    const groups = groupRepo.getEpisodeGroupsByAnimeId(anime.id);
    for (const trackerEntry of trackerEntries) {
      const targetGroup = groups.find(
        (g) =>
          g.entryType === trackerEntry.entryType &&
          (g.seasonNumber ?? 1) === (trackerEntry.seasonNumber ?? 1),
      );
      if (!targetGroup) continue;

      const existingMapping = groupRepo.getTrackerMapping(targetGroup.id, trackerEntry.source);
      if (!existingMapping) {
        groupRepo.upsertGroupTrackerMapping({
          groupId: targetGroup.id,
          source: trackerEntry.source,
          externalId: trackerEntry.externalId,
        });
      }
    }
  }
}

export function captureTrackerState(
  animeRepo: AnimeRepository,
  groupRepo: GroupRepository,
): {
  oldLocalStatuses: Map<string, LocalWatchStatus>;
  oldTrackerData: Map<string, TrackerDataEntry[]>;
} {
  const oldLocalStatuses = new Map<string, LocalWatchStatus>();
  const oldTrackerData = new Map<string, TrackerDataEntry[]>();

  for (const anime of animeRepo.listAnime()) {
    if (!anime.anidbId) continue;
    const groups = groupRepo.getEpisodeGroupsByAnimeId(anime.id);
    for (const group of groups) {
      if (group.watchStatus !== "plan_to_watch") {
        oldLocalStatuses.set(
          `${anime.anidbId}:${group.entryType}:${group.seasonNumber ?? 1}`,
          group.watchStatus,
        );
      }
      const mappings = groupRepo.getTrackerMappingsByGroupId(group.id);
      for (const mapping of mappings) {
        const compositeKey = `${mapping.source}:${mapping.externalId}`;
        const existing = oldTrackerData.get(compositeKey);
        const entry: TrackerDataEntry = {
          source: mapping.source,
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

  return { oldLocalStatuses, oldTrackerData };
}
