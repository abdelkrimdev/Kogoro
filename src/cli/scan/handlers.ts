import { lstatSync } from "node:fs";
import { basename, dirname, sep } from "node:path";
import { confirm, isCancel, select, text } from "@clack/prompts";
import type { ConfigManager } from "../../config/config-manager";
import { VIDEO_EXTENSIONS, walk } from "../../directory-walker";
import type { MatchCache } from "../../match-cache";
import { Matcher, type MatchResult } from "../../matcher";
import type { OverrideStore } from "../../override-store";
import { createEmptyResult, type ParsedResult } from "../../parser";
import type { DatabasePlugin } from "../../plugins/database/plugin";
import { type FileAction, ORGANIZED_DIRS, Renamer } from "../../renamer";
import { Scanner, type ScanProgress, type ScanResult } from "../../scanner";

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
  episodeNumbering?: "absolute" | "relative";
  verbose?: boolean;
  quiet?: boolean;
  extensions?: string[];
  concurrency?: number;
}

const DEFAULT_FILENAME_TEMPLATE = "{anime} - {season}x{episode:02} - {title}.{ext}";
const DEFAULT_DIRECTORY_TEMPLATE = "{anime}/{type}";

function normalizeExtension(ext: string): string {
  return ext.startsWith(".") ? ext : `.${ext}`;
}

function resolveExtensions(config?: ConfigManager, overrides?: string[]): string[] {
  if (overrides && overrides.length > 0) return overrides.map(normalizeExtension);
  const fromConfig = config?.getList("extensions");
  if (fromConfig && fromConfig.length > 0) return fromConfig.map(normalizeExtension);
  return VIDEO_EXTENSIONS;
}

function resolveExcludePatterns(config?: ConfigManager): string[] {
  const fromConfig = config?.getList("exclude-patterns");
  if (fromConfig && fromConfig.length > 0) return fromConfig;
  return [".part", ".crdownload", "!qb"];
}

export function isAlreadyOrganized(filePath: string): boolean {
  for (const part of filePath.split(sep).slice(0, -1)) {
    if (ORGANIZED_DIRS.has(part)) return true;
  }
  return false;
}

function discoverFiles(
  rootPath: string,
  extensions: string[],
  excludePatterns: string[],
): string[] {
  if (lstatSync(rootPath).isDirectory()) {
    return walk(rootPath, extensions, { excludePatterns });
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
    console.log(`\nFile: ${basename(filePath)}`);
    const parts: string[] = [];
    if (parsed.title) parts.push(`"${parsed.title}"`);
    if (parsed.season !== null) parts.push(`season ${parsed.season}`);
    if (parsed.episode !== null) parts.push(`episode ${parsed.episode}`);
    if (parts.length > 0) console.log(`Parsed: ${parts.join(", ")}`);
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
      const action = scanOptions?.action;
      const verbose = scanOptions?.verbose ?? false;
      const quiet = scanOptions?.quiet ?? false;
      const configNumbering = options.config?.get("episode-numbering") as
        | "absolute"
        | "relative"
        | undefined;
      const episodeNumbering = scanOptions?.episodeNumbering ?? configNumbering;
      const configConcurrency = options.config ? Number(options.config.get("concurrency")) : NaN;
      const concurrency =
        scanOptions?.concurrency ?? (Number.isNaN(configConcurrency) ? 1 : configConcurrency);

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
          baseDir,
          concurrency,
          episodeNumbering,
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

        if (!interrupted && pendingIndices.length > 0) {
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
              baseDir,
              episodeNumbering,
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

        return allResults;
      } finally {
        process.off("SIGINT", onSigint);
      }
    },
  };
}
