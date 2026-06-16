import { basename, dirname } from "node:path";
import { ORGANIZED_DIRS } from "../config/schema";
import type { CachedMatch } from "../match/match-repository";
import {
  bestPerAnimeId,
  isClearWinner,
  type MatcherLike,
  type MatchResult,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
} from "../match/matcher";
import type { OverrideData } from "../match/override-store";
import { type ParsedResult, parse } from "../parse/parser";
import type { EntryType } from "../types";

export type MatchDecision =
  | { type: "cached"; match: MatchResult }
  | { type: "override"; match: MatchResult }
  | { type: "match"; match: MatchResult }
  | { type: "ambiguous"; candidates: MatchResult[] }
  | { type: "failed"; failureReason: string };

export interface MatchInput {
  parsed: ParsedResult;
  override: OverrideData | null;
  cachedMatch: CachedMatch | null;
  sourceDb: string;
}

export interface ManualResolution {
  animeId: string;
  episode: number;
  entryType: EntryType;
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

export function parseFilePath(filePath: string, extensions?: readonly string[]): ParsedResult {
  const parsed = parse(basename(filePath), extensions);
  if (!parsed.title) {
    const dirTitle = getDirectoryTitle(filePath);
    if (dirTitle) parsed.title = dirTitle;
  }
  return parsed;
}

export function checkCached(input: MatchInput): MatchDecision | null {
  if (!input.cachedMatch) return null;
  return { type: "cached", match: matchResultFromCache(input.cachedMatch) };
}

export function checkOverride(input: MatchInput): MatchDecision | null {
  if (!input.override?.animeId) return null;
  return { type: "override", match: matchResultFromOverride(input.override) };
}

export function applyEntryTypeOverride(matches: MatchResult[], entryType?: EntryType): void {
  if (!entryType) return;
  for (const match of matches) {
    match.anime.entryType = entryType;
    if (match.episode) match.episode.entryType = entryType;
  }
}

export function filterViableMatches(matches: MatchResult[], hasEpisode: boolean): MatchResult[] {
  const scoredMatches = matches.filter((m) => !m.failureReason);
  return scoredMatches.filter((m) => (hasEpisode ? m.episode !== undefined : true));
}

export function resolveMatches(matches: MatchResult[]): MatchDecision {
  if (matches.length === 0) {
    return { type: "failed", failureReason: "No matching episode found" };
  }

  const best = bestPerAnimeId(matches);
  const winner = isClearWinner(best);
  if (winner) {
    return { type: "match", match: winner };
  }

  if (best.length === 0) {
    return { type: "failed", failureReason: "No matching episode found" };
  }

  return { type: "ambiguous", candidates: best };
}

export function resolveManual(resolution: ManualResolution): MatchResult {
  return matchResultFromManual(resolution.animeId, resolution.episode, resolution.entryType);
}

export async function probeMatches(
  matcher: MatcherLike,
  filePath: string,
): Promise<{ parsed: ParsedResult; best: MatchResult[] }> {
  const parsed = parseFilePath(filePath);
  const matches = await matcher.match(parsed);
  const hasEpisode = parsed.episode !== null;
  const viable = filterViableMatches(matches, hasEpisode);
  const best = bestPerAnimeId(viable);
  return { parsed, best };
}

export class MatchPipeline {
  private matcher: MatcherLike;

  constructor(matcher: MatcherLike) {
    this.matcher = matcher;
  }

  async decide(input: MatchInput, precomputedMatch?: MatchResult | null): Promise<MatchDecision> {
    if (precomputedMatch != null) {
      return this.resolveEntry(input, [precomputedMatch]);
    }

    const cached = checkCached(input);
    if (cached) return cached;

    const overrideDecision = checkOverride(input);
    if (overrideDecision) return overrideDecision;

    const matches = await this.matcher.match(input.parsed);
    return this.resolveEntry(input, matches);
  }

  private resolveEntry(input: MatchInput, matches: MatchResult[]): MatchDecision {
    if (input.override?.entryType) {
      applyEntryTypeOverride(matches, input.override.entryType);
    }

    if (!input.parsed.title || matches.length === 0 || matches[0]?.failureReason) {
      const failureReason = matches[0]?.failureReason ?? "No title parsed";
      return { type: "failed", failureReason };
    }

    const hasEpisode = input.parsed.episode !== null;
    const viable = filterViableMatches(matches, hasEpisode);
    return resolveMatches(viable);
  }
}
