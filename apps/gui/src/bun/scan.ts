import { basename, extname } from "node:path";
import type { DatabasePlugin, MatchResult, ParsedResult } from "@kogoro/core";
import {
  bestPerAnimeId,
  CONFIG_DIR,
  type ConfigManager,
  type CredentialStore,
  LibraryDb,
  MatchCache,
  Matcher,
  OverrideStore,
  parse,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  walk,
} from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";

const scanSessions = new Map<
  string,
  {
    orchestrator: ScanOrchestrator;
    matcher: Matcher | undefined;
    database: DatabasePlugin | undefined;
  }
>();

export function getOrchestrator(sessionId: string): ScanOrchestrator {
  const session = scanSessions.get(sessionId);
  if (!session) {
    throw new Error("Scan session not found");
  }
  return session.orchestrator;
}

export async function findCandidateMatches(
  matcher: Matcher,
  filePath: string,
): Promise<{ parsed: ParsedResult; best: MatchResult[] }> {
  const parsed = parse(basename(filePath));
  const matches = await matcher.match(parsed);
  const scoredMatches = matches.filter((m) => !m.failureReason);
  const hasEpisode = parsed.episode !== null;
  const goodMatches = scoredMatches.filter((m) => (hasEpisode ? m.episode !== undefined : true));
  const best = bestPerAnimeId(goodMatches);
  return { parsed, best };
}

export async function createScanOrchestrator(
  sessionId: string,
  configManager: ConfigManager,
  credentialStore: CredentialStore,
): Promise<ScanOrchestrator> {
  const factory = new PluginFactory(configManager, credentialStore);
  const database = await factory.primaryDatabase();

  const matcher = database ? new Matcher({ database }) : undefined;
  const cache = new MatchCache();
  const overrideStore = new OverrideStore(CONFIG_DIR);

  const filenameTemplate = configManager.getTemplate();
  const directoryTemplate =
    (configManager.get("template.directory") as string) ?? SCHEMA_DEFAULTS.template.directory;
  const renamer = new Renamer({
    filenameTemplate: filenameTemplate.includes("{ext}")
      ? filenameTemplate
      : `${filenameTemplate}.{ext}`,
    directoryTemplate,
  });

  const scanner = matcher ? new Scanner({ matcher, cache, renamer, overrideStore }) : undefined;

  const orchestrator = new ScanOrchestrator(
    {
      scanner: { match: async () => [], matchBatch: async () => [] },
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

            const extension = extname(filePath).replace(".", "") || "mkv";
            const plan = renamer.plan(filePath, chosen, extension);

            return {
              file: filePath,
              hash: "",
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
      libraryDb: new LibraryDb({ dbPath: `${CONFIG_DIR}/library.db` }),
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
    },
    sessionId,
  );

  scanSessions.set(sessionId, { orchestrator, matcher, database });
  return orchestrator;
}

export function getMatcher(sessionId: string): Matcher | undefined {
  return scanSessions.get(sessionId)?.matcher;
}

export function getDatabase(sessionId: string): DatabasePlugin | undefined {
  return scanSessions.get(sessionId)?.database;
}

export function cleanupSession(sessionId: string): void {
  scanSessions.delete(sessionId);
}
