import { dirname } from "node:path";
import type { EpisodeNumbering } from "../config/schema";
import type { TaskContext } from "../io/progress";
import type { MatcherLike, MatchResult } from "../match/matcher";
import type { OverrideStore } from "../match/override-store";
import { createEmptyResult, type ParsedResult } from "../parse/parser";
import type { RenameAction, RenamePlan, RenameResult, Renamer } from "../rename/renamer";
import type { EntryType } from "../types";
import type { HashCache } from "./hash-cache";
import { type MatchDecision, MatchPipeline, parseFilePath, resolveManual } from "./match-pipeline";
import { RenameExecutor, type RenameOptions } from "./rename-executor";

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

interface ScanBatchOptions extends ScanFileOptions {
  concurrency?: number;
  ctx?: TaskContext;
}

interface ScannerOptions {
  matcher?: MatcherLike;
  hashCache: HashCache;
  matchPipeline?: MatchPipeline;
  renameExecutor?: RenameExecutor;
  renamer?: Renamer;
  overrideStore?: OverrideStore;
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

export class Scanner {
  private hashCache: HashCache;
  private matchPipeline: MatchPipeline | null;
  private renameExecutor: RenameExecutor;
  private matcher: MatcherLike | null;

  constructor(options: ScannerOptions) {
    this.matcher = options.matcher ?? null;
    this.hashCache = options.hashCache;
    this.matchPipeline = options.matcher
      ? (options.matchPipeline ?? new MatchPipeline(options.matcher))
      : null;
    this.renameExecutor =
      options.renameExecutor ?? new RenameExecutor({ renamer: options.renamer });
  }

  hasRollback(): boolean {
    return this.renameExecutor.hasRollback();
  }

  rollback(): RenameResult[] {
    return this.renameExecutor.rollback();
  }

  private noMatchResult(filePath: string): ScanResult {
    const parsed = parseFilePath(filePath);
    return {
      file: filePath,
      hash: "",
      parsed,
      match: null,
      plan: null,
      cached: false,
      skipped: false,
      status: "failed",
      failureReason: "No database configured",
    };
  }

  async scanFile(filePath: string, options?: ScanFileOptions): Promise<ScanResult> {
    if (!this.matcher || !this.matchPipeline) {
      return this.noMatchResult(filePath);
    }

    const prepared = await this.hashCache.prepareFile(filePath, options?.force);
    const parsed = parseFilePath(filePath, options?.extensions);

    const input = {
      parsed,
      override: prepared.override,
      cachedMatch: prepared.cachedMatch,
      sourceDb: prepared.sourceDb,
    };

    const decision = await this.matchPipeline.decide(input);
    return this.executeDecision(prepared.filePath, prepared.hash, parsed, decision, options);
  }

  async scanBatch(filePaths: string[], options?: ScanBatchOptions): Promise<ScanResult[]> {
    if (!this.matcher || !this.matchPipeline) {
      return filePaths.map((fp) => this.noMatchResult(fp));
    }

    const results: ScanResult[] = [];
    const concurrency = Math.max(1, options?.concurrency ?? 1);
    const signal = options?.ctx?.abortSignal;

    let completed = 0;
    for (let i = 0; i < filePaths.length && !signal?.aborted; i += concurrency) {
      const chunk = filePaths.slice(i, i + concurrency);

      const preparedFiles = await Promise.all(
        chunk.map(async (filePath) => {
          const prepared = await this.hashCache.prepareFile(filePath, options?.force);
          const parsed = parseFilePath(filePath, options?.extensions);
          return { ...prepared, parsed };
        }),
      );

      const needsMatch = preparedFiles.filter((e) => !e.cachedMatch && !e.override?.animeId);
      const matchResults =
        needsMatch.length > 0 ? await this.matcher.matchBatch(needsMatch.map((e) => e.parsed)) : [];
      const matchMap = new Map(needsMatch.map((e, idx) => [e, matchResults[idx]]));

      for (const entry of preparedFiles) {
        if (signal?.aborted) break;

        const input = {
          parsed: entry.parsed,
          override: entry.override,
          cachedMatch: entry.cachedMatch,
          sourceDb: entry.sourceDb,
        };

        const precomputed = matchMap.get(entry) ?? null;
        const decision = await this.matchPipeline.decide(input, precomputed);

        const result = await this.executeDecision(
          entry.filePath,
          entry.hash,
          entry.parsed,
          decision,
          options,
        );

        results.push(result);
        completed++;
        options?.ctx?.progress({
          completed,
          total: filePaths.length,
          file: entry.filePath,
          status: result.status,
        });
      }
    }

    return results;
  }

  private async executeDecision(
    filePath: string,
    hash: string,
    parsed: ParsedResult,
    decision: MatchDecision,
    options?: ScanFileOptions,
  ): Promise<ScanResult> {
    switch (decision.type) {
      case "cached": {
        const { plan } = this.renameExecutor.planFromCache(filePath, decision.match);
        return {
          file: filePath,
          hash,
          parsed: createEmptyResult(),
          match: decision.match,
          plan,
          cached: true,
          skipped: true,
          status: "cached",
        };
      }

      case "override":
      case "match": {
        const resolvedHash = await this.hashCache.persistMatch(filePath, hash, decision.match);
        return this.planAndExecute(filePath, resolvedHash, decision.match, parsed, options);
      }

      case "ambiguous": {
        const resolved = await options?.onAmbiguous?.(decision.candidates, parsed, filePath);
        if (resolved) {
          const resolvedHash = await this.hashCache.persistMatch(filePath, hash, resolved);
          this.hashCache.persistOverride(filePath, resolved);
          return this.planAndExecute(filePath, resolvedHash, resolved, parsed, options);
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

      case "failed": {
        const manual = await options?.onFailed?.(parsed, filePath);
        if (manual) {
          const manualMatch = resolveManual({
            animeId: manual.animeId,
            episode: manual.episode,
            entryType: manual.entryType as EntryType,
          });
          const resolvedHash = await this.hashCache.persistMatch(filePath, hash, manualMatch);
          this.hashCache.persistOverride(filePath, manualMatch);
          return this.planAndExecute(filePath, resolvedHash, manualMatch, parsed, options);
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
          failureReason: decision.failureReason,
        };
      }
    }
  }

  private async planAndExecute(
    filePath: string,
    hash: string,
    match: MatchResult,
    parsed: ParsedResult,
    options?: ScanFileOptions,
  ): Promise<ScanResult> {
    const renameOptions: RenameOptions = {
      episodeNumbering: options?.episodeNumbering,
      action: options?.action,
      dryRun: options?.dryRun,
      baseDir: options?.baseDir,
    };

    const plan = this.renameExecutor.planRename(filePath, match, parsed, renameOptions);

    if (plan && !options?.dryRun) {
      const baseDir = options?.baseDir ?? dirname(filePath);
      const result = this.renameExecutor.executeRename(plan, baseDir);
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
}
