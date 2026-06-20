import type { CredentialStore, EventRepository, LibraryService } from "@kogoro/core";
import { type SyncConflict, SyncEngine } from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface SyncHandlerOptions {
  libraryService: LibraryService;
  eventsRepo: EventRepository;
  pluginFactory: PluginFactory;
  credentialStore: CredentialStore;
}

export interface SyncAllResult {
  applied: number;
  conflicts: SyncConflict[];
  syncedTrackers: string[];
  errors: Array<{ tracker: string; error: string }>;
}

export type SyncHandlers = ReturnType<typeof createSyncHandlers>;

const TRACKER_SOURCES = [
  { name: "anilist", source: "anilist" as const, credentialKey: "anilist" },
  { name: "kitsu", source: "kitsu" as const, credentialKey: "kitsu" },
  { name: "mal", source: "mal" as const, credentialKey: "mal" },
];

async function createEngines(
  options: SyncHandlerOptions,
  errors: Array<{ tracker: string; error: string }>,
): Promise<Array<{ source: string; engine: SyncEngine }>> {
  const engines: Array<{ source: string; engine: SyncEngine }> = [];

  for (const tracker of TRACKER_SOURCES) {
    try {
      const credential = await options.credentialStore.getCredential(tracker.credentialKey);
      if (!credential) continue;

      const plugin = await options.pluginFactory.tracker(tracker.name);
      if (!plugin) continue;

      const engine = new SyncEngine(
        options.libraryService,
        options.eventsRepo,
        plugin,
        tracker.source,
      );
      engines.push({ source: tracker.source, engine });
    } catch (err) {
      errors.push({
        tracker: tracker.source,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return engines;
}

export function createSyncHandlers(options: SyncHandlerOptions) {
  return {
    async syncAll(): Promise<SyncAllResult> {
      const result: SyncAllResult = {
        applied: 0,
        conflicts: [],
        syncedTrackers: [],
        errors: [],
      };

      const engines = await createEngines(options, result.errors);

      for (const { source, engine } of engines) {
        try {
          const pullResult = await engine.pull();
          result.applied += pullResult.applied;
          result.conflicts.push(...pullResult.conflicts);

          const pushResult = await engine.push();
          result.applied += pushResult.pushed;

          result.syncedTrackers.push(source);
        } catch (err) {
          result.errors.push({
            tracker: source,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return result;
    },

    async syncAnime(params: { animeId: string }): Promise<SyncAllResult> {
      const animeId = Number(params.animeId);
      const groups = options.libraryService.getEpisodeGroupsByAnimeId(animeId);
      const groupIds = new Set(groups.map((g) => g.id));

      const result: SyncAllResult = {
        applied: 0,
        conflicts: [],
        syncedTrackers: [],
        errors: [],
      };

      const engines = await createEngines(options, result.errors);

      for (const { source, engine } of engines) {
        try {
          const pullResult = await engine.pull();

          const relevantConflicts = pullResult.conflicts.filter((c) => groupIds.has(c.groupId));
          result.conflicts.push(...relevantConflicts);
          result.applied += pullResult.applied;

          const pushResult = await engine.push();
          result.applied += pushResult.pushed;

          result.syncedTrackers.push(source);
        } catch (err) {
          result.errors.push({
            tracker: source,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return result;
    },

    async triggerManualSync(): Promise<SyncAllResult> {
      return this.syncAll();
    },

    async resolveSyncConflict(params: {
      conflict: SyncConflict;
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
