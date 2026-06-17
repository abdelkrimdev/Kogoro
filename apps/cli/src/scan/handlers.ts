import { lstatSync } from "node:fs";
import { basename, dirname } from "node:path";
import { confirm, isCancel, log, select, text } from "@clack/prompts";
import {
  type CacheService,
  type ConfigManager,
  createScanComponents,
  type DatabasePlugin,
  type EpisodeNumbering,
  type MatchResult,
  type OverrideStore,
  type ParsedResult,
  type RenameAction,
  type Renamer,
  SCHEMA_DEFAULTS,
  type Scanner,
  type ScanResult,
  type ScanStateService,
  walk,
} from "@kogoro/core";
import type { Logger } from "../logger";

export interface ScanHandlerOptions {
  database: DatabasePlugin;
  cacheService: CacheService;
  scanStateService?: ScanStateService;
  renamer?: Renamer;
  config?: ConfigManager;
  overrideStore?: OverrideStore;
}

export interface ScanOptions {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  action?: RenameAction;
  episodeNumbering?: EpisodeNumbering;
  extensions?: string[];
  concurrency?: number;
}

function resolveExtensions(config?: ConfigManager, overrides?: string[]): readonly string[] {
  if (overrides && overrides.length > 0) {
    return overrides.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
  }
  return config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
}

function resolveExcludePatterns(config?: ConfigManager): string[] {
  const fromConfig = config?.excludePatterns;
  if (fromConfig && fromConfig.length > 0) return fromConfig;
  return [...SCHEMA_DEFAULTS["exclude-patterns"]];
}

function discoverFiles(
  rootPath: string,
  extensions: readonly string[],
  excludePatterns: string[],
): string[] {
  if (lstatSync(rootPath).isDirectory()) {
    return walk(rootPath, extensions, { excludePatterns });
  }
  return [rootPath];
}

export function createScanHandlers(options: ScanHandlerOptions) {
  const pipeline = createScanComponents({
    config: options.config,
    cacheService: options.cacheService,
    scanStateService: options.scanStateService,
    database: options.database,
    renamer: options.renamer,
    overrideStore: options.overrideStore,
  });

  const scanner = pipeline.scanner as Scanner;

  function entryTypeLabel(t: string): string {
    if (t === "tv") return "TV";
    if (t === "movie") return "Movie";
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function logFileInfo(filePath: string, parsed: ParsedResult): void {
    const lines: string[] = [];
    lines.push(`File: ${basename(filePath)}`);
    const parts: string[] = [];
    if (parsed.title) parts.push(`"${parsed.title}"`);
    if (parsed.season !== null) parts.push(`season ${parsed.season}`);
    if (parsed.episode !== null) parts.push(`episode ${parsed.episode}`);
    if (parts.length > 0) lines.push(`Parsed: ${parts.join(", ")}`);
    log.message(lines.join("\n"));
  }

  function formatCandidate(m: MatchResult, i: number): string {
    const ep = m.episode;
    const epInfo = ep ? ` E${ep.episode}` : "";
    const seasonInfo = ep && ep.season > 1 ? ` S${ep.season}` : "";
    const titleInfo = ep?.titleEn ? ` - "${ep.titleEn}"` : "";
    const typeInfo = ` (${entryTypeLabel(m.anime.entryType)}`;
    const yearInfo = m.anime.year ? ` ${m.anime.year}` : "";
    return `${i + 1}. ${m.anime.titleEn}${typeInfo}${yearInfo})${seasonInfo}${epInfo}${titleInfo} (score: ${m.score.toFixed(2)})`;
  }

  async function resolveAmbiguous(
    candidates: MatchResult[],
    parsed: ParsedResult,
    filePath: string,
  ): Promise<MatchResult | null> {
    logFileInfo(filePath, parsed);
    const choices = candidates.map((m, i) => ({
      value: i,
      label: formatCandidate(m, i),
    }));
    choices.push({ value: -1, label: "None of the above (skip)" });

    const response = await select({
      message: "Multiple matches found. Please select one:",
      options: choices,
    });

    if (isCancel(response) || response === -1) return null;
    return candidates[response as number] ?? null;
  }

  async function resolveFailed(
    parsed: ParsedResult,
    filePath: string,
  ): Promise<{ animeId: string; episode: number; entryType: string } | null> {
    logFileInfo(filePath, parsed);

    const proceed = await confirm({
      message: "No match found. Enter details manually?",
    });

    if (isCancel(proceed) || !proceed) return null;

    const animeId = await text({
      message: "Enter the Anime ID (from database):",
      validate: (v) => (v?.trim() ? undefined : "Anime ID is required"),
    });
    if (isCancel(animeId)) return null;

    const epStr = await text({
      message: "Enter the Episode number:",
      validate: (v) =>
        v?.trim() && !Number.isNaN(Number(v)) ? undefined : "Valid episode number is required",
    });
    if (isCancel(epStr)) return null;

    const typeChoice = await select({
      message: "Select the entry type:",
      options: [
        { value: "tv", label: "TV" },
        { value: "movie", label: "Movie" },
        { value: "ova", label: "OVA" },
        { value: "special", label: "Special" },
      ],
    });
    if (isCancel(typeChoice)) return null;

    return {
      animeId: animeId as string,
      episode: Number(epStr),
      entryType: typeChoice as string,
    };
  }

  return {
    async scan(path: string, scanOptions?: ScanOptions, logger?: Logger): Promise<ScanResult[]> {
      const l = logger ?? { info: () => {}, error: () => {}, debug: () => {}, progress: () => {} };
      const dryRun = scanOptions?.dryRun ?? false;
      const yes = scanOptions?.yes ?? false;
      const force = scanOptions?.force ?? false;
      const action = scanOptions?.action ?? options.config?.renameAction;
      const configNumbering = options.config?.episodeNumbering;
      const episodeNumbering =
        scanOptions?.episodeNumbering ?? configNumbering ?? SCHEMA_DEFAULTS["episode-numbering"];
      const configConcurrency = options.config ? options.config.scanConcurrency : NaN;
      const concurrency =
        scanOptions?.concurrency ??
        (Number.isNaN(configConcurrency) ? SCHEMA_DEFAULTS["scan-concurrency"] : configConcurrency);

      const baseDir = lstatSync(path).isDirectory() ? path : dirname(path);
      const extensions = resolveExtensions(options.config, scanOptions?.extensions);
      const excludePatterns = resolveExcludePatterns(options.config);
      const filePaths = discoverFiles(path, extensions, excludePatterns);

      if (filePaths.length === 0) {
        return [];
      }

      l.info(`Scanning ${filePaths.length} file(s)...`);
      l.info(`Processing files (0/${filePaths.length})...`);

      const abortController = new AbortController();
      let interrupted = false;
      const onSigint = () => {
        interrupted = true;
        abortController.abort();
        l.info("Interrupted");
        l.error("Interrupt received. Finishing current operations...");
      };
      process.on("SIGINT", onSigint);

      async function runBatch(dbScanner: Scanner): Promise<ScanResult[]> {
        return dbScanner.scanBatch(filePaths, {
          force,
          dryRun,
          action,
          baseDir,
          concurrency,
          episodeNumbering,
          extensions,
          ctx: {
            progress(p) {
              l.progress(`scan:progress ${JSON.stringify(p)}`);
            },
            log(msg) {
              l.info(msg);
            },
            error(msg) {
              l.error(msg);
            },
            abortSignal: abortController.signal,
          },
        });
      }

      try {
        const scanResults = await runBatch(scanner);

        l.info(`Processed ${filePaths.length} files`);

        if (interrupted) {
          const matchedCount = scanResults.filter((r) => r.status === "matched").length;
          const failedCount = scanResults.filter((r) => r.status === "failed").length;
          const remaining = filePaths.length - scanResults.length;
          l.error(
            `Interrupted: ${matchedCount} completed, ${remaining} pending, ${failedCount} failed.`,
          );
        }

        const pendingIndices = scanResults.reduce<number[]>((acc, r, i) => {
          if (r.status === "ambiguous" || r.status === "failed") acc.push(i);
          return acc;
        }, []);

        if (!interrupted && pendingIndices.length > 0) {
          l.info(`Resolving ${pendingIndices.length} pending file(s)...`);
          for (const idx of pendingIndices) {
            const result = scanResults[idx];
            if (!result) continue;
            const updated = await scanner.scanFile(result.file, {
              force,
              dryRun,
              action,
              baseDir,
              episodeNumbering,
              extensions,
              onAmbiguous: yes ? async (candidates) => candidates[0] ?? null : resolveAmbiguous,
              onFailed: yes ? async () => null : resolveFailed,
            });
            scanResults[idx] = updated;
          }
        }

        const matched = scanResults.filter((r) => r.status === "matched").length;
        const cached = scanResults.filter((r) => r.status === "cached").length;
        const ambiguous = scanResults.filter((r) => r.status === "ambiguous").length;
        const failedResults = scanResults.filter((r) => r.status === "failed" && r.failureReason);
        l.info(
          `Summary: ${matched} matched, ${ambiguous} unresolved, ${failedResults.length} failed, ${cached} cached`,
        );

        if (failedResults.length > 0) {
          l.error(
            `${failedResults.length} file(s) failed:\n${failedResults.map((r) => `  - ${r.file} (${r.failureReason})`).join("\n")}`,
          );
        }

        if (
          !dryRun &&
          !yes &&
          (scanner.hasRollback() || scanResults.some((r) => r.status === "failed"))
        ) {
          const rollbackResponse = await confirm({
            message: "Rollback all changes?",
          });
          if (!isCancel(rollbackResponse) && rollbackResponse) {
            const rollbackResults = scanner.rollback();
            const rollbackSuccess = rollbackResults.filter((r) => r.success).length;
            const rollbackFailed = rollbackResults.filter((r) => !r.success).length;
            l.info(`Rollback: ${rollbackSuccess} reverted, ${rollbackFailed} errors`);
          }
        }

        return scanResults;
      } finally {
        process.off("SIGINT", onSigint);
      }
    },
  };
}
