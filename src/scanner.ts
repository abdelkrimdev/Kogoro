import { readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { EntryType } from "./db/types.ts";
import { MatchCache } from "./match-cache.ts";
import { Matcher, type MatchResult } from "./matcher.ts";
import type { OverrideStore } from "./override-store.ts";
import { createEmptyResult, type ParsedResult, parse } from "./parser.ts";
import type { FileAction, RenamePlan, Renamer } from "./renamer.ts";

export type ScanStatus = "matched" | "cached" | "skipped" | "ambiguous" | "failed";

export interface ScanResult {
  file: string;
  hash: string;
  parsed: ParsedResult;
  match: MatchResult | null;
  plan: RenamePlan | null;
  cached: boolean;
  skipped: boolean;
  status: ScanStatus;
  failureReason?: string;
}

export interface ScannerOptions {
  database: DatabasePlugin;
  cache?: MatchCache;
  renamer?: Renamer;
  overrideStore?: OverrideStore;
}

export interface ScanProgress {
  completed: number;
  total: number;
  file: string;
  status: ScanStatus;
}

export interface ScanBatchOptions extends ScanFileOptions {
  concurrency?: number;
  onProgress?: (progress: ScanProgress) => void;
}

export interface ScanFileOptions {
  force?: boolean;
  dryRun?: boolean;
  action?: FileAction;
  onAmbiguous?: (candidates: MatchResult[], parsed: ParsedResult) => Promise<MatchResult | null>;
  onFailed?: (
    parsed: ParsedResult,
  ) => Promise<{ animeId: string; episode: number; entryType: string } | null>;
}

function buildManualMatch(manual: {
  animeId: string;
  episode: number;
  entryType: string;
}): MatchResult {
  const entryType = manual.entryType as EntryType;
  return {
    anime: { id: manual.animeId, title: "", entryType },
    episode: {
      id: "",
      animeId: manual.animeId,
      season: 1,
      episode: manual.episode,
      title: "",
      entryType,
    },
    score: 1,
  };
}

function computeFileHash(input: string): string {
  return Bun.hash(input).toString(16);
}

export class Scanner {
  private db: DatabasePlugin;
  private matcher: Matcher;
  private cache?: MatchCache;
  private renamer?: Renamer;

  constructor(options: ScannerOptions) {
    this.db = options.database;
    this.matcher = new Matcher({ database: this.db, overrideStore: options.overrideStore });
    this.cache = options.cache;
    this.renamer = options.renamer;
  }

  async scanFile(filePath: string, options?: ScanFileOptions): Promise<ScanResult> {
    const force = options?.force ?? false;
    let hash = "";

    const fileHash = computeFileHash(basename(filePath));

    if (this.cache) {
      hash = await MatchCache.hashFile(filePath);

      if (!force) {
        const cached = this.cache.get(hash);
        if (cached) {
          const match: MatchResult = {
            anime: {
              id: cached.animeId,
              title: cached.title ?? "",
              entryType: cached.entryType as EntryType,
            },
            episode:
              cached.episodeId && cached.episode !== null
                ? {
                    id: cached.episodeId,
                    animeId: cached.animeId,
                    season: cached.season ?? 1,
                    episode: cached.episode,
                    title: cached.title ?? "",
                    entryType: cached.entryType as EntryType,
                  }
                : undefined,
            score: 1,
          };

          return {
            file: filePath,
            hash,
            parsed: createEmptyResult(),
            match,
            plan: null,
            cached: true,
            skipped: true,
            status: "cached",
          };
        }
      }
    }

    const parsed = parse(basename(filePath));
    const matches = await this.matcher.match(parsed, fileHash);

    if (!parsed.title || matches.length === 0 || matches[0]?.failureReason) {
      const failureReason = matches[0]?.failureReason ?? "No title parsed";
      const manual = await this.tryResolveFailed(parsed, options);
      if (manual) {
        return this.cacheAndPlan(filePath, hash, parsed, buildManualMatch(manual), options);
      }
      return {
        file: filePath,
        hash,
        parsed,
        match: null,
        plan: null,
        cached: false,
        skipped: false,
        status: "failed",
        failureReason,
      };
    }

    const hasEpisode = parsed.episode !== null;
    const scoredMatches = matches.filter((m) => !m.failureReason);
    const goodMatches = scoredMatches.filter((m) => (hasEpisode ? m.episode !== undefined : true));

    if (goodMatches.length === 0) {
      const manual = await this.tryResolveFailed(parsed, options);
      if (manual) {
        return this.cacheAndPlan(filePath, hash, parsed, buildManualMatch(manual), options);
      }
      return {
        file: filePath,
        hash,
        parsed,
        match: null,
        plan: null,
        cached: false,
        skipped: false,
        status: "failed",
        failureReason: "No matching episode found",
      };
    }

    if (goodMatches.length === 1 && goodMatches[0]) {
      return this.cacheAndPlan(filePath, hash, parsed, goodMatches[0], options);
    }

    if (options?.onAmbiguous) {
      const resolved = await options.onAmbiguous(goodMatches, parsed);
      if (resolved) {
        return this.cacheAndPlan(filePath, hash, parsed, resolved, options);
      }
    }

    return {
      file: filePath,
      hash,
      parsed,
      match: null,
      plan: null,
      cached: false,
      skipped: false,
      status: "ambiguous",
    };
  }

  private async tryResolveFailed(
    parsed: ParsedResult,
    options?: ScanFileOptions,
  ): Promise<{ animeId: string; episode: number; entryType: string } | null> {
    if (!options?.onFailed) return null;
    return await options.onFailed(parsed);
  }

  private async cacheAndPlan(
    filePath: string,
    hash: string,
    parsed: ParsedResult,
    match: MatchResult,
    options?: ScanFileOptions,
  ): Promise<ScanResult> {
    let fileHash = hash;

    if (this.cache) {
      if (!fileHash) {
        fileHash = await MatchCache.hashFile(filePath);
      }
      this.cache.set(fileHash, {
        animeId: match.anime.id,
        episodeId: match.episode?.id ?? null,
        entryType: match.anime.entryType,
        season: match.episode?.season ?? null,
        episode: match.episode?.episode ?? null,
        title: match.episode?.title ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    let plan: RenamePlan | null = null;
    if (this.renamer) {
      const extension = extname(filePath).replace(".", "") || "mkv";
      plan = this.renamer.plan(filePath, match, extension, parsed.tags);
      plan.action = options?.action ?? "move";

      if (!options?.dryRun) {
        const baseDir = dirname(filePath);
        this.renamer.execute(plan, baseDir);
      }
    }

    return {
      file: filePath,
      hash: fileHash,
      parsed,
      match,
      plan,
      cached: false,
      skipped: false,
      status: "matched",
    };
  }

  async scanBatch(filePaths: string[], options?: ScanBatchOptions): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const concurrency = Math.max(1, options?.concurrency ?? 1);

    let completed = 0;
    for (let i = 0; i < filePaths.length; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);
      const chunkResults = await Promise.all(
        chunk.map(async (filePath) => {
          const result = await this.scanFile(filePath, options);
          completed++;
          options?.onProgress?.({
            completed,
            total: filePaths.length,
            file: filePath,
            status: result.status,
          });
          return result;
        }),
      );
      results.push(...chunkResults);
    }

    return results;
  }

  async scanDir(dir: string, extensions: string[]): Promise<ScanResult[]> {
    const files = readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      return statSync(fullPath).isFile() && extensions.includes(extname(f).toLowerCase());
    });
    return Promise.all(files.map((f) => this.scanFile(join(dir, f))));
  }
}
