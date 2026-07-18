import type { Event, EventRepository } from "../events/event-repository";
import type { LibraryService } from "../library/library-service";
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

export class SyncEngine {
  constructor(
    private library: LibraryService,
    private eventRepo: EventRepository,
    private tracker: TrackerPlugin,
    private source: TrackerSource,
  ) {}

  async pull(): Promise<PullResult> {
    const trackerList = await this.tracker.getUserList();
    const allMappings = this.library.getAllTrackerMappings();

    const mappingsByExternalId = new Map<string, { groupId: number }>();
    for (const mapping of allMappings) {
      if (mapping.source === this.source) {
        mappingsByExternalId.set(mapping.externalId, { groupId: mapping.groupId });
      }
    }

    let applied = 0;
    const conflicts: SyncConflict[] = [];

    for (const entry of trackerList) {
      const mapping = mappingsByExternalId.get(entry.trackerId);
      if (!mapping) continue;

      const unpushedEvents = this.eventRepo
        .getUnpushed(this.source)
        .filter((e) => e.entityType === "group" && e.entityId === mapping.groupId);
      const hasLocalChanges = unpushedEvents.length > 0;

      if (hasLocalChanges) {
        const lastEvent = unpushedEvents[unpushedEvents.length - 1];
        conflicts.push({
          groupId: mapping.groupId,
          tracker: this.source,
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

      const group = this.library.getEpisodeGroup(mapping.groupId);
      if (!group) continue;

      const newStatus = mapTrackerStatus(entry.watchStatus);
      if (group.watchStatus !== newStatus) {
        this.library.setGroupWatchStatus(group.id, newStatus);
        applied++;
      }

      if (entry.alternativeTitles && entry.alternativeTitles.length > 0) {
        this.mergeAlternativeTitles(group.animeId, entry.alternativeTitles);
      }
    }

    return { applied, conflicts };
  }

  private mergeAlternativeTitles(animeId: number, newTitles: string[]): void {
    const anime = this.library.getAnime(animeId);
    if (!anime) return;

    const existing = anime.alternativeTitles ?? [];
    const merged = [...new Set([...existing, ...newTitles])];
    if (merged.length <= existing.length) return;

    this.library.upsertAnime({
      externalId: anime.externalId,
      sourceDb: anime.sourceDb,
      title: anime.title,
      alternativeTitles: merged,
      episodeCount: anime.episodeCount,
      coverArtPath: anime.coverArtPath,
      genres: anime.genres,
      filesOnDisk: anime.filesOnDisk,
    });
  }

  async push(groupId?: number): Promise<PushResult> {
    const allMappings = this.library.getAllTrackerMappings();
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

    let pushed = 0;
    const eventIdsToMark: number[] = [];

    for (const [gid, mappings] of mappingsByGroupId) {
      const unpushedEvents = this.eventRepo
        .getUnpushed(this.source)
        .filter((e) => e.entityType === "group" && e.entityId === gid);

      if (unpushedEvents.length === 0) continue;

      const hasWatchedToggle = unpushedEvents.some((e) => e.eventType === "watched_toggle");
      let watchedEpisodes: number | undefined;
      if (hasWatchedToggle) {
        const episodes = this.library.getEpisodesByGroupId(gid);
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
        await this.tracker.updateEntry(mapping.externalId, mergedChanges);
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

      for (const source of connectedSources) {
        this.eventRepo.markPushedForSource(eventIdsToMark, source);
      }
    }

    return { pushed };
  }

  async resolveConflict(
    conflict: SyncConflict,
    resolution: "keepLocal" | "acceptRemote",
  ): Promise<{ success: boolean }> {
    const group = this.library.getEpisodeGroup(conflict.groupId);
    if (!group) {
      return { success: false };
    }

    if (resolution === "keepLocal") {
      return { success: true };
    }

    const newStatus = mapTrackerStatus(conflict.remoteChange.watchStatus);
    this.library.setGroupWatchStatus(group.id, newStatus);

    const localEvents = this.eventRepo.getAllForEntity("group", conflict.groupId);
    const localEventIds = localEvents.map((e) => e.id);
    if (localEventIds.length > 0) {
      this.eventRepo.markPushedForSource(localEventIds, conflict.tracker);
    }

    return { success: true };
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
