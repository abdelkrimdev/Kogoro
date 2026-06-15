import { extname } from "node:path";
import type { EpisodeNumbering } from "../config/schema";
import type { MatchResult } from "../match/matcher";
import { relativeToAbsolute } from "../parse/numbering-converter";
import type { ParsedResult } from "../parse/parser";
import type { RenameAction, RenamePlan, RenameResult, Renamer } from "../rename/renamer";

export interface RenameExecutorOptions {
  renamer?: Renamer;
}

export interface RenameOptions {
  episodeNumbering?: EpisodeNumbering;
  action?: RenameAction;
  dryRun?: boolean;
  baseDir?: string;
}

export interface PlanResult {
  match: MatchResult;
  plan: RenamePlan | null;
}

export class RenameExecutor {
  private renamer?: Renamer;

  constructor(options: RenameExecutorOptions) {
    this.renamer = options.renamer;
  }

  hasRollback(): boolean {
    return this.renamer?.canRollback() ?? false;
  }

  rollback(): RenameResult[] {
    if (!this.renamer) return [];
    return this.renamer.rollback();
  }

  planFromCache(filePath: string, match: MatchResult): PlanResult {
    let plan: RenamePlan | null = null;
    if (this.renamer) {
      const extension = extname(filePath).replace(".", "") || "mkv";
      plan = this.renamer.plan(filePath, match, extension);
    }
    return { match, plan };
  }

  planRename(
    filePath: string,
    match: MatchResult,
    parsed: ParsedResult,
    options?: RenameOptions,
  ): RenamePlan | null {
    if (!this.renamer) return null;

    const extension = extname(filePath).replace(".", "") || "mkv";
    const episodeNumbering = options?.episodeNumbering ?? "relative";

    const numberingOverride = this.computeNumberingOverride(parsed, match, episodeNumbering);

    const plan = this.renamer.plan(filePath, match, extension, parsed.tags, numberingOverride);
    plan.action = options?.action ?? "move";
    return plan;
  }

  executeRename(plan: RenamePlan, baseDir?: string): RenameResult {
    if (!this.renamer) {
      return { success: true };
    }
    return this.renamer.execute(plan, baseDir);
  }

  private computeNumberingOverride(
    parsed: ParsedResult,
    match: MatchResult,
    episodeNumbering: EpisodeNumbering,
  ): { season: number; episode: number } | undefined {
    if (parsed.season !== null && parsed.episode !== null) {
      if (episodeNumbering === "absolute") {
        const allEpisodes = match.allEpisodes ?? [];
        const absolute = relativeToAbsolute(parsed.season, parsed.episode, allEpisodes);
        if (absolute !== null) {
          return { season: 1, episode: absolute };
        }
        return { season: parsed.season, episode: parsed.episode };
      }
      return { season: parsed.season, episode: parsed.episode };
    }

    if (parsed.episode !== null && match.episode) {
      if (episodeNumbering === "absolute") {
        const allEpisodes = match.allEpisodes ?? [];
        const absolute = relativeToAbsolute(
          match.episode.season,
          match.episode.episode,
          allEpisodes,
        );
        if (absolute !== null) {
          return { season: 1, episode: absolute };
        }
      } else {
        return { season: match.episode.season, episode: match.episode.episode };
      }
    }

    return undefined;
  }
}
