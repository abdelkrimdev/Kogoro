import { readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { EntryType } from "./db/types.ts";
import { MatchCache } from "./match-cache.ts";
import { Matcher, type MatchResult } from "./matcher.ts";
import { type ParsedResult, parse } from "./parser.ts";
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

export class Scanner {
  private db: DatabasePlugin;
  private matcher: Matcher;
  private cache?: MatchCache;
  private renamer?: Renamer;

  constructor(options: ScannerOptions) {
    this.db = options.database;
    this.matcher = new Matcher({ database: this.db });
    this.cache = options.cache;
    this.renamer = options.renamer;
  }

  async scanFile(filePath: string, options?: ScanFileOptions): Promise<ScanResult> {
    const force = options?.force ?? false;
    let hash = "";

    if (this.cache) {
      hash = await MatchCache.hashFile(filePath);

      if (!force) {
        const cached = this.cache.get(hash);
        if (cached) {
          return {
            file: filePath,
            hash,
            parsed: {
              title: null,
              season: null,
              episode: null,
              tags: { group: null, resolution: null, source: null, codec: null, audio: null },
            },
            match: {
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
            },
            plan: null,
            cached: true,
            skipped: true,
            status: "cached",
          };
        }
      }
    }

    const parsed = parse(basename(filePath));
    const matches = await this.matcher.match(parsed);

    if (!parsed.title || matches.length === 0 || matches[0]?.failureReason) {
      const failureReason = matches[0]?.failureReason ?? "No title parsed";
      if (options?.onFailed) {
        const manual = await options.onFailed(parsed);
        if (manual) {
          const manualMatch: MatchResult = {
            anime: { id: manual.animeId, title: "", entryType: manual.entryType as EntryType },
            episode: {
              id: "",
              animeId: manual.animeId,
              season: 1,
              episode: manual.episode,
              title: "",
              entryType: manual.entryType as EntryType,
            },
            score: 1,
          };
          const result = await this.cacheAndPlan(filePath, hash, parsed, manualMatch, options);
          return result;
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
        status: "failed",
        failureReason,
      };
    }

    const hasEpisode = parsed.episode !== null;
    const scoredMatches = matches.filter((m) => !m.failureReason);
    const goodMatches = scoredMatches.filter((m) => (hasEpisode ? m.episode !== undefined : true));

    if (goodMatches.length === 0) {
      if (options?.onFailed) {
        const manual = await options.onFailed(parsed);
        if (manual) {
          const manualMatch: MatchResult = {
            anime: { id: manual.animeId, title: "", entryType: manual.entryType as EntryType },
            episode: {
              id: "",
              animeId: manual.animeId,
              season: 1,
              episode: manual.episode,
              title: "",
              entryType: manual.entryType as EntryType,
            },
            score: 1,
          };
          const result = await this.cacheAndPlan(filePath, hash, parsed, manualMatch, options);
          return result;
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
        status: "failed",
        failureReason: "No matching episode found",
      };
    }

    if (goodMatches.length === 1 && goodMatches[0]) {
      const result = await this.cacheAndPlan(filePath, hash, parsed, goodMatches[0], options);
      return result;
    }

    if (options?.onAmbiguous) {
      const resolved = await options.onAmbiguous(goodMatches, parsed);
      if (resolved) {
        const result = await this.cacheAndPlan(filePath, hash, parsed, resolved, options);
        return result;
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

  private async cacheAndPlan(
    filePath: string,
    hash: string,
    parsed: ParsedResult,
    match: MatchResult,
    options?: ScanFileOptions,
  ): Promise<ScanResult> {
    if (this.cache) {
      if (!hash) hash = await MatchCache.hashFile(filePath);
      this.cache.set(hash, {
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
      hash,
      parsed,
      match,
      plan,
      cached: false,
      skipped: false,
      status: "matched",
    };
  }

  async scanDir(dir: string, extensions: string[]): Promise<ScanResult[]> {
    const files = readdirSync(dir).filter((f) => {
      const fullPath = join(dir, f);
      return statSync(fullPath).isFile() && extensions.includes(extname(f).toLowerCase());
    });
    return Promise.all(files.map((f) => this.scanFile(join(dir, f))));
  }
}
