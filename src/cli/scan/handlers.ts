import { lstatSync } from "node:fs";
import { basename, dirname, sep } from "node:path";
import { confirm, isCancel, log, progress, select, spinner, text } from "@clack/prompts";
import type { ConfigManager } from "../../config/config-manager";
import {
  type EpisodeNumbering,
  ORGANIZED_DIRS,
  SCHEMA_DEFAULTS,
  TEMPLATE_PRESETS,
} from "../../config/schema";
import { walk } from "../../directory-walker";
import type { MatchCache } from "../../match-cache";
import { Matcher, type MatchResult } from "../../matcher";
import type { OverrideStore } from "../../override-store";
import { createEmptyResult, type ParsedResult } from "../../parser";
import type { DatabasePlugin } from "../../plugins/database/plugin";
import { type FileAction, Renamer } from "../../renamer";
import { Scanner, type ScanProgress, type ScanResult } from "../../scanner";
import { resolveMediaExtensions } from "../extensions";

export interface ScanHandlerOptions {
  database: DatabasePlugin;
  fallbackDatabases?: DatabasePlugin[];
  cache?: MatchCache;
  renamer?: Renamer;
  config?: ConfigManager;
  overrideStore?: OverrideStore;
}

export interface ScanOptions {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  action?: FileAction;
  episodeNumbering?: EpisodeNumbering;
  verbose?: boolean;
  quiet?: boolean;
  json?: boolean;
  extensions?: string[];
  concurrency?: number;
}

function getFilenameTemplate(config?: ConfigManager): string {
  const template = config ? config.getTemplate() : `${TEMPLATE_PRESETS.standard}.{ext}`;
  if (template.includes("{ext}")) {
    return template;
  }
  return `${template}.{ext}`;
}

function resolveExtensions(config?: ConfigManager, overrides?: string[]): readonly string[] {
  if (overrides && overrides.length > 0) {
    return overrides.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`));
  }
  return resolveMediaExtensions(config);
}

function resolveExcludePatterns(config?: ConfigManager): string[] {
  const fromConfig = config?.getList("exclude-patterns");
  if (fromConfig && fromConfig.length > 0) return fromConfig;
  return [...SCHEMA_DEFAULTS["exclude-patterns"]];
}

export function isAlreadyOrganized(filePath: string): boolean {
  for (const part of filePath.split(sep).slice(0, -1)) {
    if (ORGANIZED_DIRS.has(part)) return true;
  }
  return false;
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

function getDirectoryTemplate(config?: ConfigManager): string {
  return (
    (config?.get("template.directory") as string | undefined) ?? SCHEMA_DEFAULTS.template.directory
  );
}

export function createScanHandlers(options: ScanHandlerOptions) {
  const filenameTemplate = getFilenameTemplate(options.config);
  const directoryTemplate = getDirectoryTemplate(options.config);
  const renamer =
    options.renamer ??
    new Renamer({
      filenameTemplate,
      directoryTemplate,
    });

  function buildScanner(database: DatabasePlugin): Scanner {
    const matcher = new Matcher({ database, overrideStore: options.overrideStore });
    return new Scanner({
      matcher,
      cache: options.cache,
      renamer,
      overrideStore: options.overrideStore,
    });
  }

  const scanner = buildScanner(options.database);

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
    async scan(path: string, scanOptions?: ScanOptions): Promise<ScanResult[]> {
      const dryRun = scanOptions?.dryRun ?? false;
      const yes = scanOptions?.yes ?? false;
      const force = scanOptions?.force ?? false;
      const json = scanOptions?.json ?? false;
      const quiet = (scanOptions?.quiet ?? false) || json;
      const action =
        scanOptions?.action ?? (options.config?.get("rename-action") as FileAction | undefined);
      const verbose = scanOptions?.verbose ?? false;
      const configNumbering = options.config?.get("episode-numbering") as
        | EpisodeNumbering
        | undefined;
      const episodeNumbering =
        scanOptions?.episodeNumbering ?? configNumbering ?? SCHEMA_DEFAULTS["episode-numbering"];
      const configConcurrency = options.config
        ? Number(options.config.get("scan-concurrency"))
        : NaN;
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

      const organizedFiles: string[] = [];
      const unorganizedFiles: string[] = [];
      for (const fp of filePaths) {
        if (isAlreadyOrganized(fp)) {
          organizedFiles.push(fp);
        } else {
          unorganizedFiles.push(fp);
        }
      }

      if (!quiet && !verbose) {
        const msg =
          organizedFiles.length > 0
            ? `Scanning ${filePaths.length} file(s)... (${organizedFiles.length} already organized, skipped)`
            : `Scanning ${filePaths.length} file(s)...`;
        log.message(msg);
      }

      const progressBar =
        !quiet && !verbose && unorganizedFiles.length > 0
          ? progress({ max: unorganizedFiles.length })
          : undefined;
      if (progressBar) {
        progressBar.start(`Processing files (0/${unorganizedFiles.length})...`);
      }

      const abortController = new AbortController();
      let interrupted = false;
      const onSigint = () => {
        interrupted = true;
        abortController.abort();
        if (progressBar) {
          progressBar.cancel("Interrupted");
        }
        if (!quiet) {
          log.warn("Interrupt received. Finishing current operations...");
        }
      };
      process.on("SIGINT", onSigint);

      function buildOnProgress(signal: AbortSignal) {
        return (p: ScanProgress) => {
          if (verbose && !quiet) {
            if (p.status === "matched" || p.status === "cached") {
              log.success(`${p.file} (${p.status})`);
            } else if (p.status === "failed") {
              log.error(`${p.file} (${p.status})`);
            } else {
              log.info(`${p.file} (${p.status})`);
            }
          } else if (!quiet && !signal.aborted && progressBar) {
            progressBar.advance();
            progressBar.message(`Processing files (${p.completed}/${p.total})...`);
          }
        };
      }

      async function runBatch(dbScanner: Scanner): Promise<ScanResult[]> {
        return dbScanner.scanBatch(unorganizedFiles, {
          force,
          dryRun,
          action,
          baseDir,
          concurrency,
          episodeNumbering,
          extensions,
          abortSignal: abortController.signal,
          onProgress: buildOnProgress(abortController.signal),
        });
      }

      async function tryScan(dbScanner: Scanner): Promise<ScanResult[]> {
        try {
          return await runBatch(dbScanner);
        } catch (dbError) {
          const fallbacks = options.fallbackDatabases ?? [];
          if (fallbacks.length === 0 || interrupted) {
            throw dbError;
          }

          if (!quiet) {
            log.warn("Primary Database unreachable.");
          }

          if (!yes) {
            const response = await confirm({
              message: "Fall back to secondary Database?",
            });
            if (isCancel(response) || !response) {
              throw dbError;
            }
          }

          let lastError: unknown = dbError;
          for (const fallbackDb of fallbacks) {
            let fallbackSpinner: ReturnType<typeof spinner> | undefined;
            if (!quiet) {
              fallbackSpinner = spinner();
              fallbackSpinner.start("Trying fallback database...");
            }
            try {
              const fallbackScanner = buildScanner(fallbackDb);
              const results = await runBatch(fallbackScanner);
              fallbackSpinner?.stop("Fallback succeeded");
              return results;
            } catch (fallbackError) {
              lastError = fallbackError;
              fallbackSpinner?.stop("Fallback failed");
            }
          }

          throw lastError;
        }
      }

      try {
        const scanResults = await tryScan(scanner);

        if (progressBar) {
          progressBar.stop(`Processed ${unorganizedFiles.length} files`);
        }

        const skippedResults: ScanResult[] = organizedFiles.map((file) => ({
          file,
          hash: "",
          parsed: createEmptyResult(),
          match: null,
          plan: null,
          cached: false,
          skipped: true,
          status: "skipped",
        }));

        const allResults = [...skippedResults, ...scanResults];

        if (interrupted && !quiet) {
          const matchedCount = allResults.filter((r) => r.status === "matched").length;
          const failedCount = allResults.filter((r) => r.status === "failed").length;
          const remaining = filePaths.length - allResults.length;
          log.warn(
            `Interrupted: ${matchedCount} completed, ${remaining} pending, ${failedCount} failed.`,
          );
        }

        const pendingIndices = allResults.reduce<number[]>((acc, r, i) => {
          if (r.status === "ambiguous" || r.status === "failed") acc.push(i);
          return acc;
        }, []);

        if (!interrupted && pendingIndices.length > 0) {
          if (!quiet) {
            log.message(`Resolving ${pendingIndices.length} pending file(s)...`);
          }
          for (const idx of pendingIndices) {
            const result = allResults[idx];
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
            allResults[idx] = updated;
          }
        }

        if (!quiet) {
          const matched = allResults.filter((r) => r.status === "matched").length;
          const cached = allResults.filter((r) => r.status === "cached").length;
          const skipped = allResults.filter((r) => r.status === "skipped").length;
          const ambiguous = allResults.filter((r) => r.status === "ambiguous").length;
          const failedResults = allResults.filter((r) => r.status === "failed" && r.failureReason);
          log.message(
            `Summary: ${matched} matched, ${ambiguous} unresolved, ${failedResults.length} failed, ${cached + skipped} skipped (already organized)`,
          );

          if (failedResults.length > 0) {
            log.error(
              `${failedResults.length} file(s) failed:\n${failedResults.map((r) => `  - ${r.file} (${r.failureReason})`).join("\n")}`,
            );
          }
        }

        if (
          !dryRun &&
          !yes &&
          (scanner.hasRollback() || allResults.some((r) => r.status === "failed"))
        ) {
          const rollbackResponse = await confirm({
            message: "Rollback all changes?",
          });
          if (!isCancel(rollbackResponse) && rollbackResponse) {
            const rollbackResults = scanner.rollback();
            const rollbackSuccess = rollbackResults.filter((r) => r.success).length;
            const rollbackFailed = rollbackResults.filter((r) => !r.success).length;
            if (!quiet) {
              log.message(`Rollback: ${rollbackSuccess} reverted, ${rollbackFailed} errors`);
            }
          }
        }

        return allResults;
      } finally {
        progressBar?.cancel();
        process.off("SIGINT", onSigint);
      }
    },
  };
}
