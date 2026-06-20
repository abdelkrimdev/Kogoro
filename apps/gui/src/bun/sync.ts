import type {
  CredentialStore,
  EventRepository,
  LibraryService,
  TrackerWatchStatus,
} from "@kogoro/core";
import { type SyncConflict, SyncEngine, SyncOrchestrator } from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface SyncHandlerOptions {
  libraryService: LibraryService;
  eventsRepo: EventRepository;
  pluginFactory: PluginFactory;
  credentialStore: CredentialStore;
}

export interface SyncConflictInfo {
  groupId: number;
  tracker: string;
  animeTitle: string;
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

export interface SyncAllResult {
  applied: number;
  conflicts: SyncConflictInfo[];
  syncedTrackers: string[];
  errors: Array<{ tracker: string; error: string }>;
}

export type SyncHandlers = ReturnType<typeof createSyncHandlers>;

const TRACKER_SOURCES = [
  { name: "anilist", source: "anilist" as const, credentialKey: "anilist" },
  { name: "kitsu", source: "kitsu" as const, credentialKey: "kitsu" },
  { name: "mal", source: "mal" as const, credentialKey: "mal" },
];

async function buildTrackerPairs(
  options: SyncHandlerOptions,
  errors: Array<{ tracker: string; error: string }>,
): Promise<Array<{ source: string; tracker: import("@kogoro/core").TrackerPlugin }>> {
  const pairs: Array<{ source: string; tracker: import("@kogoro/core").TrackerPlugin }> = [];

  for (const tracker of TRACKER_SOURCES) {
    try {
      const credential = await options.credentialStore.getCredential(tracker.credentialKey);
      if (!credential) continue;

      const plugin = await options.pluginFactory.tracker(tracker.name);
      if (!plugin) continue;

      pairs.push({ source: tracker.source, tracker: plugin });
    } catch (err) {
      errors.push({
        tracker: tracker.source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return pairs;
}

function enrichConflicts(conflicts: SyncConflict[], library: LibraryService): SyncConflictInfo[] {
  return conflicts.map((c) => {
    const group = library.getEpisodeGroup(c.groupId);
    const anime = group ? library.getAnime(group.animeId) : null;
    return {
      ...c,
      animeTitle: anime?.title ?? `Group #${c.groupId}`,
    };
  });
}

export function createSyncHandlers(options: SyncHandlerOptions) {
  return {
    async syncAll(): Promise<SyncAllResult> {
      const errors: Array<{ tracker: string; error: string }> = [];
      const pairs = await buildTrackerPairs(options, errors);

      const orchestrator = new SyncOrchestrator(
        options.libraryService,
        options.eventsRepo,
        pairs as Array<{
          source: import("@kogoro/core").TrackerSource;
          tracker: import("@kogoro/core").TrackerPlugin;
        }>,
      );

      const result = await orchestrator.syncAll();

      return {
        applied: result.applied + result.pushed,
        conflicts: enrichConflicts(result.conflicts, options.libraryService),
        syncedTrackers: result.syncedTrackers,
        errors: [...errors, ...result.errors],
      };
    },

    async syncAnime(params: { animeId: string }): Promise<SyncAllResult> {
      const animeId = Number(params.animeId);
      const groups = options.libraryService.getEpisodeGroupsByAnimeId(animeId);
      const groupIds = new Set(groups.map((g) => g.id));

      const errors: Array<{ tracker: string; error: string }> = [];
      const pairs = await buildTrackerPairs(options, errors);

      const orchestrator = new SyncOrchestrator(
        options.libraryService,
        options.eventsRepo,
        pairs as Array<{
          source: import("@kogoro/core").TrackerSource;
          tracker: import("@kogoro/core").TrackerPlugin;
        }>,
      );

      const result = await orchestrator.syncAll();

      const relevantConflicts = result.conflicts.filter((c) => groupIds.has(c.groupId));

      return {
        applied: result.applied + result.pushed,
        conflicts: enrichConflicts(relevantConflicts, options.libraryService),
        syncedTrackers: result.syncedTrackers,
        errors: [...errors, ...result.errors],
      };
    },

    async triggerManualSync(): Promise<SyncAllResult> {
      return this.syncAll();
    },

    async resolveSyncConflict(params: {
      conflict: SyncConflictInfo;
      resolution: "keepLocal" | "acceptRemote";
    }): Promise<{ success: boolean }> {
      const trackerDef = TRACKER_SOURCES.find((t) => t.source === params.conflict.tracker);
      if (!trackerDef) return { success: false };

      const credential = await options.credentialStore.getCredential(trackerDef.credentialKey);
      if (!credential) return { success: false };

      const plugin = await options.pluginFactory.tracker(trackerDef.name);
      if (!plugin) return { success: false };

      const engine = new SyncEngine(
        options.libraryService,
        options.eventsRepo,
        plugin,
        trackerDef.source,
      );

      return engine.resolveConflict(params.conflict, params.resolution);
    },
  };
}
