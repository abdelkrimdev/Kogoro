import type {
  DatabasePlugin,
  MatchEntry,
  ReviewPlan,
  ScanFileStatus,
  ScanState,
  ScanSummary,
} from "@kogoro/core";
import {
  type CacheService,
  type ConfigManager,
  createScanComponents,
  type LibraryService,
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

const scanSessions = new Map<
  string,
  {
    orchestrator: ScanOrchestrator;
    matcher: Matcher | undefined;
    database: DatabasePlugin | undefined;
  }
>();

function getOrchestrator(sessionId: string): ScanOrchestrator {
  const session = scanSessions.get(sessionId);
  if (!session) {
    throw new Error("Scan session not found");
  }
  return session.orchestrator;
}

export type ScanHandlers = ReturnType<typeof createScanHandlers>;

async function createScanOrchestrator(
  sessionId: string,
  pluginFactory: PluginFactory,
  configManager: ConfigManager,
  libraryService: LibraryService,
  cacheService: CacheService,
  scanStateService: ScanStateService,
  force?: boolean,
): Promise<ScanOrchestrator> {
  const database = await pluginFactory.primaryDatabase();

  const components = createScanComponents({
    config: configManager,
    cacheService,
    scanStateService,
    database,
    sourceDb: String(configManager.get("primary-db") ?? "tvdb"),
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
      libraryService,
      sourceDb: String(configManager.get("primary-db") ?? "tvdb"),
      cacheService,
      scanStateService,
      force,
    },
    sessionId,
  );

  scanSessions.set(sessionId, { orchestrator, matcher: matcher ?? undefined, database });
  return orchestrator;
}

function getMatcher(sessionId: string): Matcher | undefined {
  return scanSessions.get(sessionId)?.matcher;
}

function getDatabase(sessionId: string): DatabasePlugin | undefined {
  return scanSessions.get(sessionId)?.database;
}

function cleanupSession(sessionId: string): void {
  scanSessions.delete(sessionId);
}

export function createScanHandlers(dependencies: {
  pluginFactory: PluginFactory;
  configManager: ConfigManager;
  cacheService: CacheService;
  libraryService: LibraryService;
  scanStateService: ScanStateService;
  mergeMatches: (matches: MatchEntry[]) => void;
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
}) {
  const {
    pluginFactory,
    configManager,
    cacheService,
    libraryService,
    scanStateService,
    mergeMatches,
    send,
  } = dependencies;

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
            libraryService,
            cacheService,
            scanStateService,
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
                cleanupSession(sessionId);
                break;
              case "scanError":
                send.scanError(event);
                cleanupSession(sessionId);
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
          cleanupSession(sessionId);
        }
      })();

      return { sessionId };
    },

    async approvePlan(params: { sessionId: string }) {
      const orchestrator = getOrchestrator(params.sessionId);
      await orchestrator.approvePlan();
      return undefined;
    },

    async approveGroup(params: { sessionId: string; animeId: string }) {
      getOrchestrator(params.sessionId).approveGroup(params.animeId);
      return undefined;
    },

    async rejectGroup(params: { sessionId: string; animeId: string }) {
      getOrchestrator(params.sessionId).rejectGroup(params.animeId);
      return undefined;
    },

    async cancelScan(params: { sessionId: string }) {
      const session = scanSessions.get(params.sessionId);
      cleanupSession(params.sessionId);
      session?.orchestrator.cancel();
      return undefined;
    },

    async swapFiles(params: {
      sessionId: string;
      fileAId: string;
      fileBId: string;
    }): Promise<SwapFilesResult> {
      const orch = getOrchestrator(params.sessionId);
      orch.swapFiles(params.fileAId, params.fileBId);
      const plan = orch.getPlan();
      if (!plan) throw new Error("No plan available after swap");
      return { plan };
    },

    async getResolveCandidates(params: {
      sessionId: string;
      fileId: string;
    }): Promise<ResolveCandidateResult> {
      const { sessionId, fileId } = params;
      const orchestrator = getOrchestrator(sessionId);
      const plan = orchestrator.getPlan();
      if (!plan) return { candidates: [] };

      let sourcePath: string | null = null;
      for (const group of plan.groups) {
        for (const file of group.files) {
          if (file.fileId === fileId) {
            sourcePath = file.sourcePath;
            break;
          }
        }
        if (sourcePath) break;
      }
      if (!sourcePath) return { candidates: [] };

      const matcher = getMatcher(sessionId);
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
      const db = getDatabase(params.sessionId);
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
      await getOrchestrator(params.sessionId).resolveMatch(
        params.fileId,
        params.animeId,
        params.episodeId,
      );
      return undefined;
    },
  };
}
