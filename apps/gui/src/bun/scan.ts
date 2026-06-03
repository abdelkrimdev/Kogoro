import { basename, extname } from "node:path";
import type { MatchResult, ParsedResult } from "@kogoro/core";
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

const scanOrchestrators = new Map<string, ScanOrchestrator>();
const scanMatchers = new Map<string, Matcher>();

export function getOrchestrator(sessionId: string): ScanOrchestrator {
  const orchestrator = scanOrchestrators.get(sessionId);
  if (!orchestrator) {
    throw new Error("Scan session not found");
  }
  return orchestrator;
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

  if (matcher) {
    scanMatchers.set(sessionId, matcher);
  }

  const orchestrator = new ScanOrchestrator({
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
  });

  scanOrchestrators.set(sessionId, orchestrator);
  return orchestrator;
}

export function getMatcher(sessionId: string): Matcher | undefined {
  return scanMatchers.get(sessionId);
}

export function cleanupSession(sessionId: string): void {
  scanOrchestrators.delete(sessionId);
  scanMatchers.delete(sessionId);
}
