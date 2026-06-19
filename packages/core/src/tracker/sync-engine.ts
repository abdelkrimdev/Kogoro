import type { Event, EventRepository } from "../events/event-repository";
import type { LibraryService } from "../library/library-service";
import type { TrackerPlugin, TrackerWatchStatus } from "../types";
import type { TrackerSource } from "./tracker-import";

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

      const localEvents = this.eventRepo.getAllForEntity("group", mapping.groupId);
      const hasLocalChanges = localEvents.length > 0;

      if (hasLocalChanges) {
        const lastEvent = localEvents[localEvents.length - 1];
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
    }

    return { applied, conflicts };
  }

  async push(): Promise<PushResult> {
    const allMappings = this.library.getAllTrackerMappings();
    const mappingsByGroupId = new Map<number, Array<{ source: string; externalId: string }>>();

    for (const mapping of allMappings) {
      const existing = mappingsByGroupId.get(mapping.groupId);
      if (existing) {
        existing.push(mapping);
      } else {
        mappingsByGroupId.set(mapping.groupId, [mapping]);
      }
    }

    let pushed = 0;
    const eventIdsToMark: number[] = [];

    for (const [groupId, mappings] of mappingsByGroupId) {
      const unpushedEvents = this.eventRepo
        .getUnpushed(this.source)
        .filter((e) => e.entityType === "group" && e.entityId === groupId);

      if (unpushedEvents.length === 0) continue;

      const lastEvent = unpushedEvents[unpushedEvents.length - 1];
      if (!lastEvent) continue;

      const changes = buildChangesFromEvent(lastEvent);
      if (!changes) continue;

      for (const mapping of mappings) {
        await this.tracker.updateEntry(mapping.externalId, changes);
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

function buildChangesFromEvent(event: Event): { watchStatus?: TrackerWatchStatus } | null {
  if (event.eventType === "status_change" && event.newValue) {
    return { watchStatus: mapLocalStatusToTracker(event.newValue) };
  }
  return null;
}

function mapLocalStatusToTracker(status: string): TrackerWatchStatus {
  switch (status) {
    case "plan_to_watch":
      return "plan-to-watch";
    case "on_hold":
      return "on-hold";
    default:
      return status as TrackerWatchStatus;
  }
}

function mapTrackerStatus(
  status: TrackerWatchStatus,
): "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" {
  switch (status) {
    case "plan-to-watch":
      return "plan_to_watch";
    case "on-hold":
      return "on_hold";
    default:
      return status;
  }
}
