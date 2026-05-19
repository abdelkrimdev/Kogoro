import { readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { EntryType } from "./db/types.ts";
import { MatchCache } from "./match-cache.ts";
import { Matcher, type MatchResult } from "./matcher.ts";
import type { OverrideStore } from "./override-store.ts";
import { createEmptyResult, type ParsedResult, parse } from "./parser.ts";
import type { FileAction, RenamePlan, RenameResult, Renamer } from "./renamer.ts";

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
  abortSignal?: AbortSignal;
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

export function computeFileHash(input: string): string {
  return Bun.hash(input).toString(16);
}

export class Scanner {
  private db: DatabasePlugin;
  private matcher: Matcher;
  private cache?: MatchCache;
  private renamer?: Renamer;
  private overrideStore?: OverrideStore;

  constructor(options: ScannerOptions) {
    this.db = options.database;
    this.matcher = new Matcher({ database: this.db, overrideStore: options.overrideStore });
    this.cache = options.cache;
    this.renamer = options.renamer;
    this.overrideStore = options.overrideStore;
  }

  hasRollback(): boolean {
    return this.renamer?.canRollback() ?? false;
  }

  rollback(): RenameResult[] {
    if (!this.renamer) return [];
    return this.renamer.rollback();
  }

  async scanFile(filePath: string, options?: ScanFileOptions): Promise<ScanResult> {
    const force = options?.force ?? false;
    let hash = "";

    const overrideKey = computeFileHash(basename(filePath));

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
    const matches = await this.matcher.match(parsed, overrideKey);

    if (!parsed.title || matches.length === 0 || matches[0]?.failureReason) {
      const failureReason = matches[0]?.failureReason ?? "No title parsed";
      const manual = await this.tryResolveFailed(parsed, options);
      if (manual) {
        return this.cacheAndPlan(
          filePath,
          hash,
          parsed,
          buildManualMatch(manual),
          options,
          true,
          overrideKey,
        );
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
        return this.cacheAndPlan(
          filePath,
          hash,
          parsed,
          buildManualMatch(manual),
          options,
          true,
          overrideKey,
        );
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
        return this.cacheAndPlan(filePath, hash, parsed, resolved, options, true, overrideKey);
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
    contentHash: string,
    parsed: ParsedResult,
    match: MatchResult,
    options?: ScanFileOptions,
    persistOverride?: boolean,
    overrideHash?: string,
  ): Promise<ScanResult> {
    let hash = contentHash;

    if (this.cache) {
      if (!hash) {
        hash = await MatchCache.hashFile(filePath);
      }
      this.cache.set(hash, {
        animeId: match.anime.id,
        animeTitle: match.anime.title,
        episodeId: match.episode?.id ?? null,
        entryType: match.anime.entryType,
        season: match.episode?.season ?? null,
        episode: match.episode?.episode ?? null,
        title: match.episode?.title ?? null,
        timestamp: new Date().toISOString(),
      });
    }

    if (persistOverride && this.overrideStore && overrideHash) {
      this.overrideStore.set(overrideHash, {
        animeId: match.anime.id,
        episodeId: match.episode?.id,
        entryType: match.anime.entryType,
      });
    }

    let plan: RenamePlan | null = null;
    if (this.renamer) {
      const extension = extname(filePath).replace(".", "") || "mkv";
      plan = this.renamer.plan(filePath, match, extension, parsed.tags);
      plan.action = options?.action ?? "move";

      if (!options?.dryRun) {
        const baseDir = dirname(filePath);
        const result = this.renamer.execute(plan, baseDir);
        if (!result.success) {
          return {
            file: filePath,
            hash,
            parsed,
            match,
            plan: null,
            cached: false,
            skipped: false,
            status: "failed",
            failureReason: result.error?.message ?? "Rename failed",
          };
        }
      }
    }

    return {
      file: filePath,
      hash,
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
    for (let i = 0; i < filePaths.length && !options?.abortSignal?.aborted; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);

      const entries = await Promise.all(
        chunk.map(async (filePath) => {
          const overrideKey = computeFileHash(basename(filePath));
          let hash = "";

          if (this.cache) {
            hash = await MatchCache.hashFile(filePath);
            if (!options?.force) {
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
                  filePath,
                  hash,
                  match,
                  overrideKey,
                  parsed: createEmptyResult(),
                  cached: true,
                };
              }
            }
          }

          const parsed = parse(basename(filePath));
          const override = this.overrideStore?.get(overrideKey);

          if (override?.animeId) {
            const entryType = override.entryType ?? "tv";
            const match: MatchResult = {
              anime: {
                id: override.animeId,
                title: "(overridden)",
                entryType: entryType as EntryType,
              },
              episode: override.episodeId
                ? {
                    id: override.episodeId,
                    animeId: override.animeId,
                    season: 0,
                    episode: 0,
                    title: "(overridden)",
                    entryType: entryType as EntryType,
                  }
                : undefined,
              score: 1,
            };
            return {
              filePath,
              hash,
              match,
              overrideKey,
              parsed,
              cached: false,
            };
          }

          return {
            filePath,
            hash,
            overrideKey,
            parsed,
            match: null,
            cached: false,
          };
        }),
      );

      const needsMatch = entries.filter((e) => !e.cached && e.match === null);
      if (needsMatch.length > 0) {
        const matchResults = await this.matcher.matchBatch(needsMatch.map((e) => e.parsed));
        for (let index = 0; index < needsMatch.length; index++) {
          const entry = needsMatch[index];
          const match = matchResults[index];
          if (!entry || !match) continue;

          if (match.failureReason && !match.anime.id) {
            const manual = await this.tryResolveFailed(entry.parsed, options);
            if (manual) {
              entry.match = buildManualMatch(manual);
            }
          } else {
            entry.match = match;
          }
        }
      }

      for (const entry of entries) {
        if (options?.abortSignal?.aborted) break;

        let result: ScanResult;

        if (entry.cached) {
          result = {
            file: entry.filePath,
            hash: entry.hash,
            parsed: entry.parsed,
            match: entry.match,
            plan: null,
            cached: true,
            skipped: true,
            status: "cached",
          };
        } else if (entry.match && !entry.match.failureReason) {
          result = await this.cacheAndPlan(
            entry.filePath,
            entry.hash,
            entry.parsed,
            entry.match,
            options,
            false,
            entry.overrideKey,
          );
        } else {
          const failureReason = entry.match?.failureReason ?? "No title parsed";
          result = {
            file: entry.filePath,
            hash: entry.hash,
            parsed: entry.parsed,
            match: null,
            plan: null,
            cached: false,
            skipped: false,
            status: "failed",
            failureReason,
          };
        }

        results.push(result);
        completed++;
        options?.onProgress?.({
          completed,
          total: filePaths.length,
          file: entry.filePath,
          status: result.status,
        });
      }
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
