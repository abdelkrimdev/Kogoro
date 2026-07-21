import type {
  AnimeAggregate,
  CredentialStore,
  EventRepository,
  TrackerPlugin,
  TrackerSource,
  TrackerWatchStatus,
  WatchTracker,
} from "@kogoro/core";
import { type SyncConflict, SyncEngine } from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface SyncHandlerOptions {
  animeAggregate: AnimeAggregate;
  watchTracker: WatchTracker;
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

async function runPushForGroup(
  options: SyncHandlerOptions,
  groupId: number,
): Promise<{ pushed: number; errors: Array<{ tracker: string; error: string }> }> {
  const errors: Array<{ tracker: string; error: string }> = [];
  const pairs = await buildTrackerPairs(options, errors);
  const allMappings = options.animeAggregate.library.getAllTrackerMappings();

  let pushed = 0;
  for (const { source, tracker } of pairs) {
    const hasMapping = allMappings.some((m) => m.source === source && m.groupId === groupId);
    if (!hasMapping) continue;

    try {
      const engine = new SyncEngine(
        options.animeAggregate,
        options.watchTracker,
        options.eventsRepo,
        [{ source, tracker }],
      );
      const result = await engine.push(groupId);
      pushed += result.pushed;
    } catch (err) {
      errors.push({
        tracker: source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { pushed, errors };
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

function enrichConflicts(
  conflicts: SyncConflict[],
  animeAggregate: AnimeAggregate,
): SyncConflictInfo[] {
  return conflicts.map((c) => {
    const group = animeAggregate.library.getEpisodeGroup(c.groupId);
    const anime = group ? animeAggregate.library.getAnime(group.animeId) : null;
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

  const engine = new SyncEngine(
    options.animeAggregate,
    options.watchTracker,
    options.eventsRepo,
    pairs,
  );

  const result = await engine.syncAll();

  let conflicts = result.conflicts;
  if (conflictFilter) {
    conflicts = conflicts.filter((c) => conflictFilter(c.groupId));
  }

  return {
    applied: result.applied + result.pushed,
    conflicts: enrichConflicts(conflicts, options.animeAggregate),
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
      const groups = options.animeAggregate.library.getEpisodeGroupsByAnimeId(animeId);
      const groupIds = new Set(groups.map((g) => g.id));
      return runSync(options, (groupId) => groupIds.has(groupId));
    },

    async triggerManualSync(): Promise<SyncAllResult> {
      return this.syncAll();
    },

    async pushAnime(params: {
      groupId: string;
    }): Promise<{ pushed: number; errors: Array<{ tracker: string; error: string }> }> {
      return runPushForGroup(options, Number(params.groupId));
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
        options.animeAggregate,
        options.watchTracker,
        options.eventsRepo,
        [{ source: trackerDef.source, tracker: plugin }],
      );

      return engine.resolveConflict(params.conflict, params.resolution);
    },
  };
}
