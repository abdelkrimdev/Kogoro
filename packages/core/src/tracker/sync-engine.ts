import type { Event, EventRepository } from "../events/event-repository";
import type { AnimeAggregate } from "../library/anime-aggregate";
import type { WatchTracker } from "../library/watch-tracker";
import type { TrackerPlugin, TrackerSource, TrackerWatchStatus } from "../types";
import { mapLocalStatusToTracker, mapTrackerStatus } from "./credential-utils";

export interface SyncConflict {
  groupId: number;
  tracker: string;
  localChange: {
    eventType: string;
    oldValue: string | null;
    newValue: string;
  };
  remoteChange: {
    watchStatus: TrackerWatchStatus;
    episodesWatched: number;
  };
}

export interface PullResult {
  applied: number;
  conflicts: SyncConflict[];
}

export interface PushResult {
  pushed: number;
}

export interface CrossTrackerConflict {
  groupId: number;
  trackerA: string;
  trackerB: string;
  statusA: TrackerWatchStatus;
  statusB: TrackerWatchStatus;
}

export interface SyncAllResult {
  applied: number;
  pushed: number;
  conflicts: SyncConflict[];
  crossTrackerConflicts: CrossTrackerConflict[];
  syncedTrackers: string[];
  errors: Array<{ tracker: string; error: string }>;
}

export class SyncEngine {
  private aggregate: AnimeAggregate;
  private watchTracker: WatchTracker;
  private eventRepo: EventRepository;
  private trackerPairs: Array<{ source: TrackerSource; tracker: TrackerPlugin }>;

  constructor(
    aggregate: AnimeAggregate,
    watchTracker: WatchTracker,
    eventRepo: EventRepository,
    trackerPairs: Array<{ source: TrackerSource; tracker: TrackerPlugin }>,
  );
  constructor(
    aggregate: AnimeAggregate,
    watchTracker: WatchTracker,
    eventRepo: EventRepository,
    tracker: TrackerPlugin,
    source: TrackerSource,
  );
  constructor(
    aggregate: AnimeAggregate,
    watchTracker: WatchTracker,
    eventRepo: EventRepository,
    trackerOrPairs: TrackerPlugin | Array<{ source: TrackerSource; tracker: TrackerPlugin }>,
    source?: TrackerSource,
  ) {
    this.aggregate = aggregate;
    this.watchTracker = watchTracker;
    this.eventRepo = eventRepo;

    if (Array.isArray(trackerOrPairs)) {
      this.trackerPairs = trackerOrPairs;
    } else {
      if (source === undefined) {
        throw new Error("source is required when constructing SyncEngine with a single tracker");
      }
      this.trackerPairs = [{ source, tracker: trackerOrPairs }];
    }
  }

  async pull(): Promise<PullResult> {
    if (this.trackerPairs.length !== 1) {
      throw new Error(
        "pull() requires a single-tracker SyncEngine; use syncAll() for multiple trackers",
      );
    }
    const pair = this.trackerPairs[0];
    if (!pair) throw new Error("unexpected: trackerPairs is empty after length check");
    return this.pullFrom(pair.source, pair.tracker);
  }

  private async pullFrom(source: TrackerSource, tracker: TrackerPlugin): Promise<PullResult> {
    const trackerList = await tracker.getUserList();
    const allMappings = this.aggregate.library.getAllTrackerMappings();

    const mappingsByExternalId = new Map<string, { groupId: number }>();
    for (const mapping of allMappings) {
      if (mapping.source === source) {
        mappingsByExternalId.set(mapping.externalId, { groupId: mapping.groupId });
      }
    }

    let applied = 0;
    const conflicts: SyncConflict[] = [];
    const unpushedEventsByGroup = new Map<number, Event[]>();
    for (const event of this.eventRepo.getUnpushed(source)) {
      if (event.entityType !== "group") continue;
      const existing = unpushedEventsByGroup.get(event.entityId) ?? [];
      existing.push(event);
      unpushedEventsByGroup.set(event.entityId, existing);
    }

    for (const entry of trackerList) {
      const mapping = mappingsByExternalId.get(entry.trackerId);
      if (!mapping) continue;

      const unpushedEvents = unpushedEventsByGroup.get(mapping.groupId) ?? [];

      if (unpushedEvents.length > 0) {
        const lastEvent = unpushedEvents[unpushedEvents.length - 1];
        conflicts.push({
          groupId: mapping.groupId,
          tracker: source,
          localChange: {
            eventType: lastEvent?.eventType ?? "unknown",
            oldValue: lastEvent?.oldValue ?? null,
            newValue: lastEvent?.newValue ?? "unknown",
          },
          remoteChange: {
            watchStatus: entry.watchStatus,
            episodesWatched: entry.episodesWatched,
          },
        });
        continue;
      }

      const group = this.aggregate.library.getEpisodeGroup(mapping.groupId);
      if (!group) continue;

      const newStatus = mapTrackerStatus(entry.watchStatus);
      if (group.watchStatus !== newStatus) {
        this.watchTracker.setGroupWatchStatus(group.id, newStatus);
        applied++;
      }

      if (entry.alternativeTitles && entry.alternativeTitles.length > 0) {
        this.mergeAlternativeTitles(group.animeId, entry.alternativeTitles);
      }
    }

    return { applied, conflicts };
  }

  private mergeAlternativeTitles(animeId: number, newTitles: string[]): void {
    const anime = this.aggregate.library.getAnime(animeId);
    if (!anime) return;

    const existing = anime.alternativeTitles ?? [];
    const merged = [...new Set([...existing, ...newTitles])];
    if (merged.length <= existing.length) return;

    this.aggregate.library.updateAnime(animeId, {
      alternativeTitles: merged,
    });
  }

  async push(groupId?: number): Promise<PushResult> {
    if (this.trackerPairs.length !== 1) {
      throw new Error(
        "push() requires a single-tracker SyncEngine; use syncAll() for multiple trackers",
      );
    }
    const pair = this.trackerPairs[0];
    if (!pair) throw new Error("unexpected: trackerPairs is empty after length check");
    return this.pushTo(pair.source, pair.tracker, groupId);
  }

  private async pushTo(
    source: TrackerSource,
    tracker: TrackerPlugin,
    groupId?: number,
  ): Promise<PushResult> {
    const allMappings = this.aggregate.library.getAllTrackerMappings();
    const mappingsByGroupId = new Map<number, Array<{ source: string; externalId: string }>>();

    for (const mapping of allMappings) {
      if (groupId !== undefined && mapping.groupId !== groupId) continue;
      const existing = mappingsByGroupId.get(mapping.groupId);
      if (existing) {
        existing.push(mapping);
      } else {
        mappingsByGroupId.set(mapping.groupId, [mapping]);
      }
    }

    const unpushedEventsByGroup = new Map<number, Event[]>();
    for (const event of this.eventRepo.getUnpushed(source)) {
      if (event.entityType !== "group") continue;
      if (groupId !== undefined && event.entityId !== groupId) continue;
      const existing = unpushedEventsByGroup.get(event.entityId) ?? [];
      existing.push(event);
      unpushedEventsByGroup.set(event.entityId, existing);
    }

    let pushed = 0;
    const eventIdsToMark: number[] = [];

    for (const [gid, mappings] of mappingsByGroupId) {
      const unpushedEvents = unpushedEventsByGroup.get(gid) ?? [];

      if (unpushedEvents.length === 0) continue;

      const hasWatchedToggle = unpushedEvents.some((e) => e.eventType === "watched_toggle");
      let watchedEpisodes: number | undefined;
      if (hasWatchedToggle) {
        const episodes = this.aggregate.library.getEpisodesByGroupId(gid);
        watchedEpisodes = episodes.filter((ep) => ep.watched).length;
      }

      let mergedChanges: { watchStatus?: TrackerWatchStatus; episodesWatched?: number } = {};
      let hasChanges = false;

      for (const event of unpushedEvents) {
        const changes = buildChangesFromEvent(event, watchedEpisodes);
        if (changes) {
          mergedChanges = { ...mergedChanges, ...changes };
          hasChanges = true;
        }
      }

      if (!hasChanges) continue;

      for (const mapping of mappings) {
        await tracker.updateEntry(mapping.externalId, mergedChanges);
      }

      pushed += unpushedEvents.length;
      eventIdsToMark.push(...unpushedEvents.map((e) => e.id));
    }

    if (eventIdsToMark.length > 0) {
      const connectedSources = new Set<string>();
      for (const [, mappings] of mappingsByGroupId) {
        for (const mapping of mappings) {
          connectedSources.add(mapping.source);
        }
      }

      for (const connectedSource of connectedSources) {
        this.eventRepo.markPushedForSource(eventIdsToMark, connectedSource);
      }
    }

    return { pushed };
  }

  async resolveCrossTrackerConflict(
    conflict: CrossTrackerConflict,
    resolution: "keepTrackerA" | "keepTrackerB",
  ): Promise<{ success: boolean }> {
    const group = this.aggregate.library.getEpisodeGroup(conflict.groupId);
    if (!group) {
      return { success: false };
    }

    const winningStatus = resolution === "keepTrackerA" ? conflict.statusA : conflict.statusB;
    const newStatus = mapTrackerStatus(winningStatus);
    this.watchTracker.setGroupWatchStatus(group.id, newStatus);

    return { success: true };
  }

  async resolveConflict(
    conflict: SyncConflict,
    resolution: "keepLocal" | "acceptRemote",
  ): Promise<{ success: boolean }> {
    const group = this.aggregate.library.getEpisodeGroup(conflict.groupId);
    if (!group) {
      return { success: false };
    }

    if (resolution === "keepLocal") {
      return { success: true };
    }

    const newStatus = mapTrackerStatus(conflict.remoteChange.watchStatus);
    this.watchTracker.setGroupWatchStatus(group.id, newStatus);

    const localEvents = this.eventRepo.getAllForEntity("group", conflict.groupId);
    const localEventIds = localEvents.map((e) => e.id);
    if (localEventIds.length > 0) {
      this.eventRepo.markPushedForSource(localEventIds, conflict.tracker);
    }

    return { success: true };
  }

  async syncAll(): Promise<SyncAllResult> {
    const result: SyncAllResult = {
      applied: 0,
      pushed: 0,
      conflicts: [],
      crossTrackerConflicts: [],
      syncedTrackers: [],
      errors: [],
    };

    const remoteStatusByTrackerAndGroup = new Map<string, Map<number, TrackerWatchStatus>>();

    const allMappings = this.aggregate.library.getAllTrackerMappings();
    const mappingsBySource = new Map<string, typeof allMappings>();
    for (const mapping of allMappings) {
      const existing = mappingsBySource.get(mapping.source) ?? [];
      existing.push(mapping);
      mappingsBySource.set(mapping.source, existing);
    }

    for (const { source, tracker } of this.trackerPairs) {
      try {
        const userList = await tracker.getUserList();
        const sourceMappings = mappingsBySource.get(source) ?? [];
        const mappingsByExternalId = new Map(sourceMappings.map((m) => [m.externalId, m]));

        const groupStatuses = new Map<number, TrackerWatchStatus>();
        for (const entry of userList) {
          const mapping = mappingsByExternalId.get(entry.trackerId);
          if (mapping) {
            groupStatuses.set(mapping.groupId, entry.watchStatus);
          }
        }
        remoteStatusByTrackerAndGroup.set(source, groupStatuses);
      } catch (err) {
        result.errors.push({
          tracker: source,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const { source, tracker } of this.trackerPairs) {
      if (result.errors.some((e) => e.tracker === source)) continue;
      try {
        const pullResult = await this.pullFrom(source, tracker);
        result.applied += pullResult.applied;
        result.conflicts.push(...pullResult.conflicts);
        result.syncedTrackers.push(source);
      } catch (err) {
        result.errors.push({
          tracker: source,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const groupsWithTrackers = new Map<number, Map<string, TrackerWatchStatus>>();
    for (const [source, groupStatuses] of remoteStatusByTrackerAndGroup) {
      for (const [groupId, watchStatus] of groupStatuses) {
        const trackerMap = groupsWithTrackers.get(groupId) ?? new Map();
        trackerMap.set(source, watchStatus);
        groupsWithTrackers.set(groupId, trackerMap);
      }
    }

    for (const [groupId, trackerMap] of groupsWithTrackers) {
      const entries = Array.from(trackerMap.entries());
      for (let i = 0; i < entries.length; i++) {
        const entryA = entries[i];
        if (!entryA) continue;
        for (let j = i + 1; j < entries.length; j++) {
          const entryB = entries[j];
          if (!entryB) continue;
          const [sourceA, statusA] = entryA;
          const [sourceB, statusB] = entryB;
          if (statusA !== statusB) {
            result.crossTrackerConflicts.push({
              groupId,
              trackerA: sourceA,
              trackerB: sourceB,
              statusA,
              statusB,
            });
          }
        }
      }
    }

    for (const { source, tracker } of this.trackerPairs) {
      if (!result.syncedTrackers.includes(source)) continue;
      try {
        const pushResult = await this.pushTo(source, tracker);
        result.pushed += pushResult.pushed;
      } catch (err) {
        result.errors.push({
          tracker: source,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

function buildChangesFromEvent(
  event: Event,
  watchedEpisodes?: number,
): { watchStatus?: TrackerWatchStatus; episodesWatched?: number } | null {
  if (event.eventType === "status_change" && event.newValue) {
    return { watchStatus: mapLocalStatusToTracker(event.newValue) };
  }
  if (event.eventType === "watched_toggle" && watchedEpisodes !== undefined) {
    return { episodesWatched: watchedEpisodes };
  }
  return null;
}
