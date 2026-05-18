import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { confirm, isCancel, select, text } from "@clack/prompts";
import type { ConfigManager } from "../config/config-manager.ts";
import type { DatabasePlugin } from "../db/database-plugin.ts";
import type { MatchCache } from "../match-cache.ts";
import type { MatchResult } from "../matcher.ts";
import type { NumberingScheme } from "../numbering-converter.ts";
import type { ParsedResult } from "../parser.ts";
import { type FileAction, Renamer } from "../renamer.ts";
import { Scanner, type ScanResult } from "../scanner.ts";

export interface ScanHandlerOptions {
  database: DatabasePlugin;
  cache?: MatchCache;
  renamer?: Renamer;
  config?: ConfigManager;
  extensions?: string[];
  episodeNumbering?: NumberingScheme;
}

export interface ScanOptions {
  dryRun?: boolean;
  yes?: boolean;
  force?: boolean;
  action?: FileAction;
}

const DEFAULT_EXTENSIONS = [".mkv", ".mp4", ".avi", ".mov"];
const DEFAULT_FILENAME_TEMPLATE = "{anime} - {season}x{episode:02} - {title}.{ext}";
const DEFAULT_DIRECTORY_TEMPLATE = "{anime}/{type}";

function getFilenameTemplate(config?: ConfigManager): string {
  return config?.get("template.string") ?? DEFAULT_FILENAME_TEMPLATE;
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

  const scanner = new Scanner({
    database: options.database,
    cache: options.cache,
    renamer,
  });

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

      const isDir = statSync(path).isDirectory();
      const filePaths = isDir
        ? readdirSync(path)
            .filter((f) => {
              const fullPath = join(path, f);
              return statSync(fullPath).isFile() && extensions.includes(extname(f).toLowerCase());
            })
            .map((f) => join(path, f))
        : [path];

      const results: ScanResult[] = [];

      for (const filePath of filePaths) {
        const scanFileOptions = {
          force,
          dryRun,
          action,
          onAmbiguous: yes ? undefined : resolveAmbiguous,
          onFailed: yes ? undefined : resolveFailed,
        };

        const result = await scanner.scanFile(filePath, scanFileOptions);
        results.push(result);
      }

      return JSON.stringify(results, null, 2);
    },
  };
}
