import { lstatSync, readdirSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { confirm, isCancel, select, text } from "@clack/prompts";
import type { ConfigManager } from "../config/config-manager";
import type { MatchCache } from "../match-cache";
import type { MatchResult } from "../matcher";
import type { NumberingScheme } from "../numbering-converter";
import type { OverrideStore } from "../override-store";
import { createEmptyResult, type ParsedResult } from "../parser";
import type { DatabasePlugin } from "../plugins/database-plugin";
import { type FileAction, Renamer } from "../renamer";
import { Scanner, type ScanProgress, type ScanResult } from "../scanner";

export interface ScanHandlerOptions {
  database: DatabasePlugin;
  fallbackDatabases?: DatabasePlugin[];
  cache?: MatchCache;
  renamer?: Renamer;
  config?: ConfigManager;
  extensions?: string[];
  episodeNumbering?: NumberingScheme;
  overrideStore?: OverrideStore;
}

export interface ScanOptions {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  action?: FileAction;
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  json?: boolean;
  concurrency?: number;
}

const DEFAULT_EXTENSIONS = [".mkv", ".mp4", ".avi", ".mov"];
const DEFAULT_FILENAME_TEMPLATE = "{anime} - {season}x{episode:02} - {title}.{ext}";
const DEFAULT_DIRECTORY_TEMPLATE = "{anime}/{type}";

const DEFAULT_EXCLUDE_PATTERNS = [".part", ".crdownload", "!qb"];
const ORGANIZED_DIRS = new Set(["TV", "Movies", "OVA", "Specials"]);

export function isAlreadyOrganized(filePath: string): boolean {
  for (const part of filePath.split(sep).slice(0, -1)) {
    if (ORGANIZED_DIRS.has(part)) return true;
  }
  return false;
}

function walkDir(dir: string, extensions: string[], excludePatterns: string[]): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, extensions, excludePatterns));
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (!extensions.includes(ext)) continue;
      if (excludePatterns.some((p) => entry.name.includes(p))) continue;
      results.push(fullPath);
    }
  }
  return results;
}

export function discoverFiles(
  rootPath: string,
  extensions: string[],
  excludePatterns?: string[],
): string[] {
  if (lstatSync(rootPath).isDirectory()) {
    const patterns = excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
    return walkDir(rootPath, extensions, patterns);
  }
  return [rootPath];
}

function getFilenameTemplate(config?: ConfigManager): string {
  const template = config ? config.getTemplate() : DEFAULT_FILENAME_TEMPLATE;
  if (template.includes("{ext}")) {
    return template;
  }
  return `${template}.{ext}`;
}

function getDirectoryTemplate(config?: ConfigManager): string {
  return config?.get("template.dir") ?? DEFAULT_DIRECTORY_TEMPLATE;
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
    return new Scanner({
      database,
      cache: options.cache,
      renamer,
      overrideStore: options.overrideStore,
    });
  }

  const scanner = buildScanner(options.database);

  const extensions = options.extensions ?? DEFAULT_EXTENSIONS;

  function formatCandidate(m: MatchResult, i: number): string {
    const ep = m.episode;
    const epInfo = ep ? ` E${ep.episode}` : "";
    const seasonInfo = ep && ep.season > 1 ? ` S${ep.season}` : "";
    return `${i + 1}. ${m.anime.title}${seasonInfo}${epInfo} (score: ${m.score.toFixed(2)})`;
  }

  async function resolveAmbiguous(
    candidates: MatchResult[],
    _parsed: ParsedResult,
  ): Promise<MatchResult | null> {
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
    _parsed: ParsedResult,
  ): Promise<{ animeId: string; episode: number; entryType: string } | null> {
    const proceed = await confirm({
      message: "No match found. Do you want to enter details manually?",
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
    async scan(path: string, scanOptions?: ScanOptions): Promise<string> {
      const dryRun = scanOptions?.dryRun ?? false;
      const yes = scanOptions?.yes ?? false;
      const force = scanOptions?.force ?? false;
      const action = scanOptions?.action;
      const verbose = scanOptions?.verbose ?? false;
      const quiet = scanOptions?.quiet ?? false;
      const configConcurrency = options.config ? Number(options.config.get("concurrency")) : NaN;
      const concurrency =
        scanOptions?.concurrency ?? (Number.isNaN(configConcurrency) ? 1 : configConcurrency);

      const filePaths = discoverFiles(path, extensions);

      if (filePaths.length === 0) {
        return JSON.stringify([]);
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
        console.log(msg);
      }

      const abortController = new AbortController();
      let interrupted = false;
      const onSigint = () => {
        interrupted = true;
        abortController.abort();
        if (!quiet) {
          console.log("\nInterrupt received. Finishing current operations...");
        }
      };
      process.on("SIGINT", onSigint);

      function buildOnProgress(signal: AbortSignal) {
        return (p: ScanProgress) => {
          if (verbose && !quiet) {
            console.log(`[${p.status.toUpperCase()}] ${p.file}`);
          } else if (!quiet && !signal.aborted) {
            const pct = ((p.completed / p.total) * 100).toFixed(0);
            process.stdout.write(`\r[${p.completed}/${p.total}] Processing... (${pct}%)`);
            if (p.completed === p.total) {
              process.stdout.write("\n");
            }
          }
        };
      }

      async function runBatch(dbScanner: Scanner): Promise<ScanResult[]> {
        return dbScanner.scanBatch(unorganizedFiles, {
          force,
          dryRun,
          action,
          concurrency,
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
            console.log("\nPrimary Database unreachable.");
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
            if (!quiet) {
              console.log(`Trying fallback database...`);
            }
            try {
              const fallbackScanner = buildScanner(fallbackDb);
              return await runBatch(fallbackScanner);
            } catch (fallbackError) {
              lastError = fallbackError;
            }
          }

          throw lastError;
        }
      }

      try {
        const scanResults = await tryScan(scanner);

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
          console.log(
            `Interrupted: ${matchedCount} completed, ${remaining} pending, ${failedCount} failed.`,
          );
        }

        const pendingIndices = allResults.reduce<number[]>((acc, r, i) => {
          if (r.status === "ambiguous" || r.status === "failed") acc.push(i);
          return acc;
        }, []);

        if (!yes && !interrupted && pendingIndices.length > 0) {
          if (!quiet) {
            console.log(`\nResolving ${pendingIndices.length} pending file(s)...`);
          }
          for (const idx of pendingIndices) {
            const result = allResults[idx];
            if (!result) continue;
            const updated = await scanner.scanFile(result.file, {
              force,
              dryRun,
              action,
              onAmbiguous: resolveAmbiguous,
              onFailed: resolveFailed,
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
          console.log(
            `Summary: ${matched} matched, ${ambiguous} unresolved, ${failedResults.length} failed, ${cached + skipped} skipped (already organized)`,
          );

          if (failedResults.length > 0) {
            console.log(
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
              console.log(`Rollback: ${rollbackSuccess} reverted, ${rollbackFailed} errors`);
            }
          }
        }

        return JSON.stringify(allResults, null, 2);
      } finally {
        process.off("SIGINT", onSigint);
      }
    },
  };
}
