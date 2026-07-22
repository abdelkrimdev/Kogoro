import type {
  DatabasePlugin,
  MatchEntry,
  ReviewPlan,
  ScanFileStatus,
  ScanState,
  ScanSummary,
} from "@kogoro/core";
import {
  type AnimeAggregate,
  type CacheService,
  type ConfigManager,
  createScanComponents,
  type Matcher,
  probeMatches,
  ScanOrchestrator,
  type ScanStateService,
} from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

type ScanStartResult = { sessionId: string };

type SwapFilesResult = { plan: ReviewPlan };

export type ResolveCandidateEntry = {
  animeId: string;
  animeTitle: string;
  entryType: string;
  episodeId: string;
  episodeNumber: number;
  season: number;
  score: number;
};

type ResolveCandidateResult = {
  candidates: ResolveCandidateEntry[];
};

type AnimeSearchCandidate = {
  animeId: string;
  animeTitle: string;
  entryType: string;
};

type AnimeSearchResult = {
  candidates: AnimeSearchCandidate[];
};

export type ScanSessionEntry = {
  orchestrator: ScanOrchestrator;
  matcher: Matcher | undefined;
  database: DatabasePlugin | undefined;
};

export interface ScanSessionStore {
  get(sessionId: string): ScanSessionEntry | undefined;
  set(sessionId: string, entry: ScanSessionEntry): void;
  delete(sessionId: string): void;
  entries(): IterableIterator<[string, ScanSessionEntry]>;
  readonly size: number;
}

function createInMemoryScanSessionStore(): ScanSessionStore {
  return new Map<string, ScanSessionEntry>();
}

export type ScanHandlers = ReturnType<typeof createScanHandlers>;

async function createScanOrchestrator(
  sessionId: string,
  pluginFactory: PluginFactory,
  configManager: ConfigManager,
  animeAggregate: AnimeAggregate,
  cacheService: CacheService,
  scanStateService: ScanStateService,
  store: ScanSessionStore,
  force?: boolean,
): Promise<ScanOrchestrator> {
  const database = await pluginFactory.primaryDatabase();

  const components = createScanComponents({
    config: configManager,
    cacheService,
    scanStateService,
    database,
    sourceDb: configManager.primaryDb,
  });

  const { matcher, renamer, scanner } = components;

  const orchestrator = new ScanOrchestrator(
    {
      pipeline: {
        walk: components.walk,
        scanBatch: async (filePaths, options, ctx) =>
          scanner.scanBatch(filePaths, {
            force: options.force,
            dryRun: options.dryRun,
            extensions: options.extensions,
            ctx,
          }),
      },
      matcher: matcher ?? undefined,
      renamer,
      animeAggregate,
      sourceDb: configManager.primaryDb,
      cacheService,
      scanStateService,
      force,
    },
    sessionId,
  );

  store.set(sessionId, { orchestrator, matcher: matcher ?? undefined, database });
  return orchestrator;
}

export function createScanHandlers(dependencies: {
  pluginFactory: PluginFactory;
  configManager: ConfigManager;
  cacheService: CacheService;
  animeAggregate: AnimeAggregate;
  scanStateService: ScanStateService;
  mergeMatches: (matches: MatchEntry[]) => Promise<void>;
  send: {
    scanProgress: (data: {
      sessionId: string;
      file: string;
      status: ScanFileStatus;
      matched: boolean;
      completed: number;
      total: number;
    }) => void;
    scanPhaseComplete: (data: {
      sessionId: string;
      phase: ScanState;
      summary: ScanSummary;
    }) => void;
    scanReviewReady: (data: { sessionId: string; plan: ReviewPlan }) => void;
    scanExecutionProgress: (data: {
      sessionId: string;
      completed: number;
      total: number;
      file: string;
      status: ScanFileStatus;
    }) => void;
    scanComplete: (data: { sessionId: string; summary: ScanSummary }) => void;
    scanError: (data: { sessionId: string; error: string }) => void;
  };
  scanSessionStore?: ScanSessionStore;
}) {
  const {
    pluginFactory,
    configManager,
    cacheService,
    animeAggregate,
    scanStateService,
    mergeMatches,
    send,
    scanSessionStore,
  } = dependencies;

  const store = scanSessionStore ?? createInMemoryScanSessionStore();

  function requireSession(sessionId: string): ScanSessionEntry {
    const session = store.get(sessionId);
    if (!session) throw new Error("Scan session not found");
    return session;
  }

  function mergeCurrentMatches(orchestrator: ScanOrchestrator) {
    const matches = orchestrator.getMatchResults();
    if (matches.length > 0) {
      mergeMatches(matches);
    }
  }

  return {
    async scanStart(params: { path: string; force?: boolean }): Promise<ScanStartResult> {
      const { path, force } = params;
      const sessionId = crypto.randomUUID();

      (async () => {
        try {
          const orchestrator = await createScanOrchestrator(
            sessionId,
            pluginFactory,
            configManager,
            animeAggregate,
            cacheService,
            scanStateService,
            store,
            force,
          );

          orchestrator.on("*", (event) => {
            switch (event.type) {
              case "scanProgress":
                send.scanProgress(event);
                break;
              case "scanPhaseComplete":
                send.scanPhaseComplete(event);
                break;
              case "scanReviewReady":
                send.scanReviewReady(event);
                break;
              case "scanExecutionProgress":
                send.scanExecutionProgress(event);
                break;
              case "scanComplete":
                mergeCurrentMatches(orchestrator);
                send.scanComplete(event);
                store.delete(sessionId);
                break;
              case "scanError":
                send.scanError(event);
                store.delete(sessionId);
                break;
            }
          });

          await orchestrator.startScan(path);
        } catch (err) {
          console.error("Scan failed:", err);
          send.scanError({
            sessionId,
            error: err instanceof Error ? err.message : String(err),
          });
          store.delete(sessionId);
        }
      })();

      return { sessionId };
    },

    async approvePlan(params?: { rejectedAnimeIds?: string[] }) {
      const rejectedAnimeIds = params?.rejectedAnimeIds ?? [];
      const pending = [...store.entries()];
      for (const [, session] of pending) {
        if (session.orchestrator.getState() === "review") {
          for (const animeId of rejectedAnimeIds) {
            try {
              session.orchestrator.rejectGroup(animeId);
            } catch {
              // Group may not exist in this session's plan
            }
          }
          await session.orchestrator.approvePlan();
        }
      }
    },

    async approveGroup(params: { sessionId: string; animeId: string }) {
      const { orchestrator } = requireSession(params.sessionId);
      orchestrator.approveGroup(params.animeId);
    },

    async rejectGroup(params: { sessionId: string; animeId: string }) {
      const { orchestrator } = requireSession(params.sessionId);
      orchestrator.rejectGroup(params.animeId);
    },

    async cancelScan(params: { sessionId: string }) {
      const session = store.get(params.sessionId);
      store.delete(params.sessionId);
      session?.orchestrator.cancel();
    },

    async swapFiles(params: {
      sessionId: string;
      fileAId: string;
      fileBId: string;
    }): Promise<SwapFilesResult> {
      const { orchestrator } = requireSession(params.sessionId);
      orchestrator.swapFiles(params.fileAId, params.fileBId);
      const plan = orchestrator.getPlan();
      if (!plan) throw new Error("No plan available after swap");
      return { plan };
    },

    async getResolveCandidates(params: {
      sessionId: string;
      fileId: string;
    }): Promise<ResolveCandidateResult> {
      const { sessionId, fileId } = params;
      const { orchestrator, matcher } = requireSession(sessionId);
      const plan = orchestrator.getPlan();
      if (!plan) return { candidates: [] };

      const file = plan.groups.flatMap((g) => g.files).find((f) => f.fileId === fileId);
      if (!file) return { candidates: [] };
      const sourcePath = file.sourcePath;

      if (!matcher) return { candidates: [] };

      const { best } = await probeMatches(matcher, sourcePath);

      return {
        candidates: best.map((m) => ({
          animeId: m.anime.id,
          animeTitle: m.anime.titleEn,
          entryType: m.anime.entryType,
          episodeId: m.episode?.id ?? "",
          episodeNumber: m.episode?.episode ?? 0,
          season: m.episode?.season ?? 1,
          score: m.score,
        })),
      };
    },

    async searchAnimeByTitle(params: {
      sessionId: string;
      title: string;
    }): Promise<AnimeSearchResult> {
      const db = store.get(params.sessionId)?.database;
      if (!db) return { candidates: [] };

      const results = await db.searchAnime(params.title);
      return {
        candidates: results.map((r) => ({
          animeId: r.id,
          animeTitle: r.titleEn,
          entryType: r.entryType,
        })),
      };
    },

    async resolveMatch(params: {
      sessionId: string;
      fileId: string;
      animeId: string;
      episodeId: string;
    }) {
      const { orchestrator } = requireSession(params.sessionId);
      await orchestrator.resolveMatch(params.fileId, params.animeId, params.episodeId);
    },

    get activeScanCount() {
      return store.size;
    },
  };
}
