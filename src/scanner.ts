import { basename, dirname, extname } from "node:path";
import { type EpisodeNumbering, ORGANIZED_DIRS } from "./config/schema";
import type { CachedMatch } from "./match-cache";
import { MatchCache } from "./match-cache";
import {
  AMBIGUOUS_MATCH_REASON,
  bestPerAnimeId,
  isClearWinner,
  type MatcherLike,
  type MatchResult,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
} from "./matcher";
import { relativeToAbsolute } from "./numbering-converter";
import type { OverrideData, OverrideStore } from "./override-store";
import { createEmptyResult, type ParsedResult, parse } from "./parser";
import type { EntryType } from "./plugins/database/types";
import type { RenameAction, RenamePlan, RenameResult, Renamer } from "./renamer";

type ScanStatus = "matched" | "cached" | "skipped" | "ambiguous" | "failed";

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

interface ScannerOptions {
  matcher: MatcherLike;
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

interface ScanBatchOptions extends ScanFileOptions {
  concurrency?: number;
  onProgress?: (progress: ScanProgress) => void;
  abortSignal?: AbortSignal;
}

interface ScanFileOptions {
  force?: boolean;
  dryRun?: boolean;
  action?: RenameAction;
  baseDir?: string;
  extensions?: readonly string[];
  episodeNumbering?: EpisodeNumbering;
  onAmbiguous?: (
    candidates: MatchResult[],
    parsed: ParsedResult,
    filePath: string,
  ) => Promise<MatchResult | null>;
  onFailed?: (
    parsed: ParsedResult,
    filePath: string,
  ) => Promise<{ animeId: string; episode: number; entryType: string } | null>;
}

export function computeFileHash(input: string): string {
  return Bun.hash(input).toString(16);
}

function isValidDirName(name: string): boolean {
  return name !== "" && name !== "." && name !== "..";
}

export function getDirectoryTitle(filePath: string): string | null {
  const parent = basename(dirname(filePath));
  if (!isValidDirName(parent)) return null;

  if (ORGANIZED_DIRS.has(parent)) {
    const grandparent = basename(dirname(dirname(filePath)));
    if (isValidDirName(grandparent) && !ORGANIZED_DIRS.has(grandparent)) {
      return grandparent;
    }
    return null;
  }

  if (/-[A-Za-z0-9]{6,}$/.test(parent)) return null;
  return parent;
}

interface PreparedFile {
  filePath: string;
  hash: string;
  parsed: ParsedResult;
  overrideKey: string;
  override: OverrideData | null;
  cachedMatch: CachedMatch | null;
}

interface BatchEntry extends PreparedFile {
  match: MatchResult | null;
}

export class Scanner {
  private matcher: MatcherLike;
  private cache?: MatchCache;
  private renamer?: Renamer;
  private overrideStore?: OverrideStore;

  constructor(options: ScannerOptions) {
    this.matcher = options.matcher;
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

  private parseFile(filePath: string, extensions?: readonly string[]): ParsedResult {
    const parsed = parse(basename(filePath), extensions);
    if (!parsed.title) {
      const dirTitle = getDirectoryTitle(filePath);
      if (dirTitle) parsed.title = dirTitle;
    }
    return parsed;
  }

  private async prepareFile(
    filePath: string,
    force?: boolean,
    extensions?: readonly string[],
  ): Promise<PreparedFile> {
    const overrideKey = computeFileHash(basename(filePath));
    let hash = "";
    let cachedMatch: CachedMatch | null = null;

    if (this.cache) {
      hash = await MatchCache.hashFile(filePath);
      if (!force) {
        cachedMatch = this.cache.get(hash);
      }
    }

    const parsed = this.parseFile(filePath, extensions);
    const override = this.overrideStore?.get(overrideKey) ?? null;

    return { filePath, hash, parsed, overrideKey, override, cachedMatch };
  }

  async scanFile(filePath: string, options?: ScanFileOptions): Promise<ScanResult> {
    const prepared = await this.prepareFile(filePath, options?.force, options?.extensions);

    if (prepared.cachedMatch) {
      return {
        file: filePath,
        hash: prepared.hash,
        parsed: createEmptyResult(),
        match: matchResultFromCache(prepared.cachedMatch),
        plan: null,
        cached: true,
        skipped: true,
        status: "cached",
      };
    }

    if (prepared.override?.animeId) {
      const overrideMatch = matchResultFromOverride(prepared.override);
      const resolvedHash = await this.persistMatch(filePath, prepared.hash, overrideMatch);
      return this.renameFile(filePath, resolvedHash, overrideMatch, prepared.parsed, options);
    }

    const matches = await this.matcher.match(prepared.parsed);

    if (prepared.override?.entryType) {
      for (const match of matches) {
        match.anime.entryType = prepared.override.entryType;
        if (match.episode) match.episode.entryType = prepared.override.entryType;
      }
    }

    return this.resolveMatches(
      filePath,
      prepared.hash,
      prepared.parsed,
      matches,
      options,
      prepared.overrideKey,
    );
  }

  private async resolveMatches(
    filePath: string,
    hash: string,
    parsed: ParsedResult,
    matches: MatchResult[],
    options?: ScanFileOptions,
    overrideKey?: string,
  ): Promise<ScanResult> {
    if (!parsed.title || matches.length === 0 || matches[0]?.failureReason) {
      const failureReason = matches[0]?.failureReason ?? "No title parsed";
      const manualResult = await this.resolveManual(filePath, hash, parsed, options, overrideKey);
      if (manualResult) return manualResult;
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
    const best = bestPerAnimeId(goodMatches);

    const winner = isClearWinner(best);
    if (winner) {
      const resolvedHash = await this.persistMatch(filePath, hash, winner);
      return this.renameFile(filePath, resolvedHash, winner, parsed, options);
    }

    if (best.length === 0) {
      const manualResult = await this.resolveManual(filePath, hash, parsed, options, overrideKey);
      if (manualResult) return manualResult;
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

    const resolved = await options?.onAmbiguous?.(best, parsed, filePath);
    if (resolved) {
      const resolvedHash = await this.persistMatch(filePath, hash, resolved);
      this.persistOverride(overrideKey, resolved);
      return this.renameFile(filePath, resolvedHash, resolved, parsed, options);
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
    filePath: string,
    parsed: ParsedResult,
    options?: ScanFileOptions,
  ): Promise<{ animeId: string; episode: number; entryType: EntryType } | null> {
    if (!options?.onFailed) return null;
    const result = await options.onFailed(parsed, filePath);
    if (!result) return null;
    return { ...result, entryType: result.entryType as EntryType };
  }

  private async resolveManual(
    filePath: string,
    hash: string,
    parsed: ParsedResult,
    options: ScanFileOptions | undefined,
    overrideKey: string | undefined,
  ): Promise<ScanResult | null> {
    const manual = await this.tryResolveFailed(filePath, parsed, options);
    if (!manual) return null;

    const manualMatch = matchResultFromManual(manual.animeId, manual.episode, manual.entryType);
    const resolvedHash = await this.persistMatch(filePath, hash, manualMatch);
    this.persistOverride(overrideKey, manualMatch);
    return this.renameFile(filePath, resolvedHash, manualMatch, parsed, options);
  }

  private async persistMatch(filePath: string, hash: string, match: MatchResult): Promise<string> {
    if (!this.cache) return hash;

    const resolvedHash = hash || (await MatchCache.hashFile(filePath));

    this.cache.set(resolvedHash, {
      animeId: match.anime.id,
      animeTitle: match.anime.titleEn,
      episodeId: match.episode?.id ?? null,
      entryType: match.anime.entryType,
      season: match.episode?.season ?? null,
      episode: match.episode?.episode ?? null,
      title: match.episode?.titleEn ?? null,
      timestamp: new Date().toISOString(),
    });

    return resolvedHash;
  }

  private persistOverride(overrideKey: string | undefined, match: MatchResult): void {
    if (!this.overrideStore || !overrideKey) return;

    this.overrideStore.set(overrideKey, {
      animeId: match.anime.id,
      episodeId: match.episode?.id,
      entryType: match.anime.entryType,
    });
  }

  private async renameFile(
    filePath: string,
    hash: string,
    match: MatchResult,
    parsed: ParsedResult,
    options?: ScanFileOptions,
  ): Promise<ScanResult> {
    let plan: RenamePlan | null = null;

    if (this.renamer) {
      const extension = extname(filePath).replace(".", "") || "mkv";
      const episodeNumbering = options?.episodeNumbering ?? "relative";

      let numberingOverride: { season: number; episode: number } | undefined;
      if (parsed.season !== null && parsed.episode !== null) {
        if (episodeNumbering === "absolute") {
          const allEpisodes = this.matcher.getEpisodes(match.anime.id);
          const absolute = relativeToAbsolute(parsed.season, parsed.episode, allEpisodes);
          if (absolute !== null) {
            numberingOverride = { season: 1, episode: absolute };
          } else {
            numberingOverride = { season: parsed.season, episode: parsed.episode };
          }
        } else {
          numberingOverride = { season: parsed.season, episode: parsed.episode };
        }
      } else if (parsed.episode !== null && match.episode) {
        if (episodeNumbering === "absolute") {
          const allEpisodes = this.matcher.getEpisodes(match.anime.id);
          const absolute = relativeToAbsolute(
            match.episode.season,
            match.episode.episode,
            allEpisodes,
          );
          if (absolute !== null) {
            numberingOverride = { season: 1, episode: absolute };
          }
        } else {
          numberingOverride = { season: match.episode.season, episode: match.episode.episode };
        }
      }

      plan = this.renamer.plan(filePath, match, extension, parsed.tags, numberingOverride);
      plan.action = options?.action ?? "move";

      if (!options?.dryRun) {
        const baseDir = options?.baseDir ?? dirname(filePath);
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

  private async finalizeEntry(entry: BatchEntry, options?: ScanFileOptions): Promise<ScanResult> {
    if (entry.cachedMatch) {
      return {
        file: entry.filePath,
        hash: entry.hash,
        parsed: entry.parsed,
        match: matchResultFromCache(entry.cachedMatch),
        plan: null,
        cached: true,
        skipped: true,
        status: "cached",
      };
    }

    if (entry.match && !entry.match.failureReason) {
      const resolvedHash = await this.persistMatch(entry.filePath, entry.hash, entry.match);
      return this.renameFile(entry.filePath, resolvedHash, entry.match, entry.parsed, options);
    }

    if (entry.match?.failureReason === AMBIGUOUS_MATCH_REASON) {
      return {
        file: entry.filePath,
        hash: entry.hash,
        parsed: entry.parsed,
        match: null,
        plan: null,
        cached: false,
        skipped: false,
        status: "ambiguous",
        failureReason: AMBIGUOUS_MATCH_REASON,
      };
    }

    const failureReason = entry.match?.failureReason ?? "No title parsed";
    return {
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

  async scanBatch(filePaths: string[], options?: ScanBatchOptions): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const concurrency = Math.max(1, options?.concurrency ?? 1);

    let completed = 0;
    for (let i = 0; i < filePaths.length && !options?.abortSignal?.aborted; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);

      const entries: BatchEntry[] = await Promise.all(
        chunk.map(async (filePath) => {
          const prepared = await this.prepareFile(filePath, options?.force, options?.extensions);

          if (prepared.cachedMatch) {
            return {
              ...prepared,
              match: matchResultFromCache(prepared.cachedMatch),
            };
          }

          if (prepared.override?.animeId) {
            return {
              ...prepared,
              match: matchResultFromOverride(prepared.override),
            };
          }

          return {
            ...prepared,
            match: null,
          };
        }),
      );

      const needsMatch = entries.filter((e) => !e.cachedMatch && e.match === null);
      if (needsMatch.length > 0) {
        const matchResults = await this.matcher.matchBatch(needsMatch.map((e) => e.parsed));
        for (let idx = 0; idx < needsMatch.length; idx++) {
          const entry = needsMatch[idx];
          const matchResult = matchResults[idx];
          if (!entry || !matchResult) continue;

          if (matchResult.failureReason) {
            const manual = await this.tryResolveFailed(entry.filePath, entry.parsed, options);
            if (manual) {
              entry.match = matchResultFromManual(manual.animeId, manual.episode, manual.entryType);
            }
          } else {
            const override = this.overrideStore?.get(entry.overrideKey);
            if (override?.entryType) {
              matchResult.anime.entryType = override.entryType;
              if (matchResult.episode) matchResult.episode.entryType = override.entryType;
            }
            entry.match = matchResult;
          }
        }
      }

      for (const entry of entries) {
        if (options?.abortSignal?.aborted) break;

        const result = await this.finalizeEntry(entry, options);

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
}
