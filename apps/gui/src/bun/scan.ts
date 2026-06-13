import { extname } from "node:path";
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
  CONFIG_DIR,
  type ConfigManager,
  findCandidateMatches,
  hashFile,
  type LibraryService,
  Matcher,
  type MatchResult,
  OverrideStore,
  Renamer,
  type SanitizeConfig,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  type ScanStateService,
  walk,
} from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

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

  const matcher = database ? new Matcher({ database }) : undefined;
  const overrideStore = new OverrideStore(CONFIG_DIR);

  const filenameTemplate = configManager.getTemplate();
  const directoryTemplate =
    (configManager.get("template.directory") as string) ?? SCHEMA_DEFAULTS.template.directory;
  const sanitize = configManager.get("sanitize") as SanitizeConfig | undefined;
  const renamer = new Renamer({
    filenameTemplate: filenameTemplate.includes("{ext}")
      ? filenameTemplate
      : `${filenameTemplate}.{ext}`,
    directoryTemplate,
    sanitize,
  });

  const scanner = matcher
    ? new Scanner({
        matcher,
        cacheService,
        renamer,
        overrideStore,
        sourceDb: String(configManager.get("primary-db") ?? "tvdb"),
      })
    : undefined;

  const orchestrator = new ScanOrchestrator(
    {
      walk: async (path: string) =>
        walk(path, SCHEMA_DEFAULTS["media-extensions"], {
          excludePatterns: configManager.getList("exclude-patterns"),
        }),
      scanFile: async (filePath: string, options?: { dryRun?: boolean }) => {
        if (!scanner) {
          return {
            file: filePath,
            hash: "",
            parsed: {
              title: null,
              season: null,
              episode: null,
              tags: { group: null, resolution: null, source: null, codec: null, audio: null },
            },
            match: null,
            plan: null,
            cached: false,
            skipped: false,
            status: "failed" as const,
            failureReason: "No database configured",
          };
        }
        return scanner.scanFile(filePath, { dryRun: options?.dryRun ?? true });
      },
      resolveFile: matcher
        ? async (filePath: string, animeId: string, episodeId: string) => {
            const { parsed, best } = await findCandidateMatches(matcher, filePath);

            const chosen = best.find((m) => m.anime.id === animeId && m.episode?.id === episodeId);
            if (!chosen) {
              return {
                file: filePath,
                hash: "",
                parsed,
                match: null,
                plan: null,
                cached: false,
                skipped: false,
                status: "failed" as const,
                failureReason: "Selected candidate not found",
              };
            }

            const hash = await hashFile(filePath);
            const extension = extname(filePath).replace(".", "") || "mkv";
            const plan = renamer.plan(filePath, chosen, extension);

            return {
              file: filePath,
              hash,
              parsed,
              match: chosen,
              plan,
              cached: false,
              skipped: false,
              status: "matched" as const,
            };
          }
        : undefined,
      executeRename: scanner
        ? async (plan, baseDir) => {
            const result = renamer.execute(plan, baseDir);
            return { success: result.success, error: result.error };
          }
        : undefined,
      libraryService,
      sourceDb: String(configManager.get("primary-db") ?? "tvdb"),
      computeTopCandidates: matcher
        ? async (sourcePath: string) => {
            const { best } = await findCandidateMatches(matcher, sourcePath);
            return best.slice(0, 3).map((m) => ({
              episodeNumber: m.episode?.episode ?? 0,
              title: m.episode?.titleEn ?? "",
            }));
          }
        : undefined,
      planFile: (filePath: string, match: MatchResult) => {
        const extension = extname(filePath).replace(".", "") || "mkv";
        return renamer.plan(filePath, match, extension);
      },
      cacheService,
      scanStateService,
      force,
    },
    sessionId,
  );

  scanSessions.set(sessionId, { orchestrator, matcher, database });
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
    async scanStart(params: { path: string; force?: boolean }) {
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
                if (event.phase === "plan") {
                  mergeCurrentMatches(orchestrator);
                }
                break;
              case "scanReviewReady":
                send.scanReviewReady(event);
                break;
              case "scanExecutionProgress":
                send.scanExecutionProgress(event);
                break;
              case "scanComplete":
                send.scanComplete(event);
                cleanupSession(sessionId);
                break;
            }
          });

          await orchestrator.startScan(path);
        } catch (err) {
          console.error("Scan failed:", err);
        }
      })();

      return { sessionId };
    },

    async approvePlan(params: { sessionId: string }) {
      const orchestrator = getOrchestrator(params.sessionId);
      await orchestrator.approvePlan();

      mergeCurrentMatches(orchestrator);

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
      getOrchestrator(params.sessionId).cancel();
      cleanupSession(params.sessionId);
      return undefined;
    },

    async swapFiles(params: { sessionId: string; fileAId: string; fileBId: string }) {
      const orch = getOrchestrator(params.sessionId);
      orch.swapFiles(params.fileAId, params.fileBId);
      const plan = orch.getPlan();
      if (!plan) throw new Error("No plan available after swap");
      return { plan };
    },

    async getResolveCandidates(params: { sessionId: string; fileId: string }) {
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

      const { best } = await findCandidateMatches(matcher, sourcePath);

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

    async searchAnimeByTitle(params: { sessionId: string; title: string }) {
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
