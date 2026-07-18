import type { EventRepository } from "../events/event-repository";
import type { LibraryService } from "../library/library-service";
import type { TrackerPlugin, TrackerSource, TrackerWatchStatus } from "../types";
import { type SyncConflict, SyncEngine } from "./sync-engine";

export interface CrossTrackerConflict {
  groupId: number;
  trackerA: string;
  trackerB: string;
  statusA: TrackerWatchStatus;
  statusB: TrackerWatchStatus;
}

export interface OrchestratorResult {
  applied: number;
  pushed: number;
  conflicts: SyncConflict[];
  crossTrackerConflicts: CrossTrackerConflict[];
  syncedTrackers: string[];
  errors: Array<{ tracker: string; error: string }>;
}

export class SyncOrchestrator {
  constructor(
    private library: LibraryService,
    private eventRepo: EventRepository,
    private trackerPairs: Array<{ source: TrackerSource; tracker: TrackerPlugin }>,
  ) {}

  async syncAll(): Promise<OrchestratorResult> {
    const result: OrchestratorResult = {
      applied: 0,
      pushed: 0,
      conflicts: [],
      crossTrackerConflicts: [],
      syncedTrackers: [],
      errors: [],
    };

    const engines = this.trackerPairs.map(({ source, tracker }) => ({
      source,
      engine: new SyncEngine(this.library, this.eventRepo, tracker, source),
    }));

    const remoteStatusByTrackerAndGroup = new Map<string, Map<number, TrackerWatchStatus>>();

    const allMappings = this.library.getAllTrackerMappings();
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

    for (const { source, engine } of engines) {
      if (result.errors.some((e) => e.tracker === source)) continue;
      try {
        const pullResult = await engine.pull();
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
      const sourceList = Array.from(trackerMap.entries());
      for (let i = 0; i < sourceList.length; i++) {
        const entryA = sourceList[i];
        if (!entryA) continue;
        for (let j = i + 1; j < sourceList.length; j++) {
          const entryB = sourceList[j];
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

    for (const { source, engine } of engines) {
      if (!result.syncedTrackers.includes(source)) continue;
      try {
        const pushResult = await engine.push();
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
