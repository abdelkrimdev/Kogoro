import type {
  CredentialStore,
  EventRepository,
  LibraryService,
  TrackerPlugin,
  TrackerSource,
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
): Promise<Array<{ source: TrackerSource; tracker: TrackerPlugin }>> {
  const pairs: Array<{ source: TrackerSource; tracker: TrackerPlugin }> = [];

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

async function runSync(
  options: SyncHandlerOptions,
  conflictFilter?: (groupId: number) => boolean,
): Promise<SyncAllResult> {
  const errors: Array<{ tracker: string; error: string }> = [];
  const pairs = await buildTrackerPairs(options, errors);

  const orchestrator = new SyncOrchestrator(options.libraryService, options.eventsRepo, pairs);

  const result = await orchestrator.syncAll();

  let conflicts = result.conflicts;
  if (conflictFilter) {
    conflicts = conflicts.filter((c) => conflictFilter(c.groupId));
  }

  return {
    applied: result.applied + result.pushed,
    conflicts: enrichConflicts(conflicts, options.libraryService),
    syncedTrackers: result.syncedTrackers,
    errors: [...errors, ...result.errors],
  };
}

export function createSyncHandlers(options: SyncHandlerOptions) {
  return {
    async syncAll(): Promise<SyncAllResult> {
      return runSync(options);
    },

    async syncAnime(params: { animeId: string }): Promise<SyncAllResult> {
      const animeId = Number(params.animeId);
      const groups = options.libraryService.getEpisodeGroupsByAnimeId(animeId);
      const groupIds = new Set(groups.map((g) => g.id));
      return runSync(options, (groupId) => groupIds.has(groupId));
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
