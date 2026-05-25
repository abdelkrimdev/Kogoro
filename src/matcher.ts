import type { CachedMatch } from "./match-cache";
import type { OverrideData, OverrideStore } from "./override-store";
import type { ParsedResult } from "./parser";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { AnimeResult, EntryType, EpisodeResult } from "./plugins/database/types";

export interface MatchResult {
  anime: AnimeResult;
  episode?: EpisodeResult;
  score: number;
  failureReason?: string;
}

export function matchResultFromCache(cached: CachedMatch): MatchResult {
  let episode: EpisodeResult | undefined;
  if (cached.episodeId !== null && cached.episode !== null) {
    episode = {
      id: cached.episodeId,
      animeId: cached.animeId,
      season: cached.season ?? 1,
      episode: cached.episode,
      titleEn: cached.title ?? "",
      entryType: cached.entryType as EntryType,
    };
  }

  return {
    anime: {
      id: cached.animeId,
      titleEn: cached.animeTitle ?? "",
      entryType: cached.entryType as EntryType,
    },
    episode,
    score: 1,
  };
}

export function matchResultFromOverride(override: OverrideData): MatchResult {
  const animeId = override.animeId ?? "";
  const entryType = override.entryType ?? "tv";

  let episode: EpisodeResult | undefined;
  if (override.episodeId !== undefined && override.animeId) {
    episode = {
      id: override.episodeId,
      animeId,
      season: 0,
      episode: 0,
      titleEn: "(overridden)",
      entryType,
    };
  }

  return {
    anime: {
      id: animeId,
      titleEn: "(overridden)",
      entryType,
    },
    episode,
    score: 1,
  };
}

export function matchResultFromManual(
  animeId: string,
  episode: number,
  entryType: EntryType,
): MatchResult {
  return {
    anime: { id: animeId, titleEn: "", entryType },
    episode: {
      id: "",
      animeId,
      season: 1,
      episode,
      titleEn: "",
      entryType,
    },
    score: 1,
  };
}

const AMBIGUITY_MARGIN = 0.2;
const AMBIGUITY_EPSILON = 0.001;
export const AMBIGUOUS_MATCH_REASON = "Ambiguous match";

export function isClearWinner(best: MatchResult[]): MatchResult | undefined {
  if (best.length === 0) return undefined;
  if (best.length === 1) return best[0];
  if (best[0] && best[1]) {
    const margin = best[0].score - best[1].score;
    if (margin >= AMBIGUITY_MARGIN - AMBIGUITY_EPSILON) return best[0];
  }
  return undefined;
}

export interface MatcherLike {
  match(parsed: ParsedResult, fileHash?: string): Promise<MatchResult[]>;
  matchBatch(parsedList: ParsedResult[]): Promise<MatchResult[]>;
  getEpisodes(animeId: string): EpisodeResult[];
}

export function bestPerAnimeId(matches: MatchResult[]): MatchResult[] {
  const seen = new Set<string>();
  const result: MatchResult[] = [];
  for (const m of matches) {
    if (!seen.has(m.anime.id)) {
      seen.add(m.anime.id);
      result.push(m);
    }
  }
  return result;
}

interface MatcherOptions {
  database: DatabasePlugin;
  overrideStore?: OverrideStore;
}

function createBigrams(s: string): Set<string> {
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2).toLowerCase());
  }
  return bigrams;
}

function diceSimilarity(a: string, b: string): number {
  const bigramsA = createBigrams(a);
  const bigramsB = createBigrams(b);
  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

function computeScore(parsedTitle: string, dbTitle: string): number {
  const dice = diceSimilarity(parsedTitle, dbTitle);

  const normalize = (w: string) => w.replace(/[^a-z0-9]/g, "");
  const parsedWords = parsedTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalize)
    .filter(Boolean);
  const dbWords = new Set(
    dbTitle.toLowerCase().split(/\s+/).filter(Boolean).map(normalize).filter(Boolean),
  );
  if (parsedWords.length === 0) return dice;

  const matchingWords = parsedWords.filter((w) => dbWords.has(w)).length;
  const wordRatio = matchingWords / parsedWords.length;

  return dice + 0.3 * wordRatio;
}

function emptyAnimeResult(): AnimeResult {
  return { id: "", titleEn: "", entryType: "tv" };
}

function noMatchResult(failureReason: string): MatchResult {
  return { anime: emptyAnimeResult(), score: 0, failureReason };
}

function noMatch(failureReason: string): MatchResult[] {
  return [noMatchResult(failureReason)];
}

function seasonMatchBoost(episodes: EpisodeResult[] | undefined, parsedSeason: number): number {
  return episodes?.some((e) => e.season === parsedSeason) ? 0.5 : 0;
}

export function resolveEpisode(
  episodes: EpisodeResult[],
  season: number | null,
  episode: number,
): EpisodeResult | undefined {
  if (season === null) {
    return findAbsolute(episodes, episode);
  }

  const seasonEpisodes = episodes
    .filter((e) => e.season === season)
    .sort((a, b) => a.episode - b.episode);

  if (seasonEpisodes.length > 0) {
    return seasonEpisodes[episode - 1];
  }

  const maxSeason = Math.max(...episodes.map((e) => e.season), 0);
  if (maxSeason <= 1) {
    return findAbsolute(episodes, episode);
  }

  return undefined;
}

function findAbsolute(episodes: EpisodeResult[], episode: number): EpisodeResult | undefined {
  const regular = episodes.find((e) => e.episode === episode && e.season > 0);
  if (regular) return regular;
  return episodes.find((e) => e.episode === episode);
}

export class Matcher implements MatcherLike {
  private static readonly FETCH_CONCURRENCY = 5;
  private static readonly MIN_SIMILARITY = 0.15;

  private db: DatabasePlugin;
  private overrideStore?: OverrideStore;
  private searchCache = new Map<string, AnimeResult[]>();
  private episodeCache = new Map<string, EpisodeResult[]>();

  constructor(options: MatcherOptions) {
    this.db = options.database;
    this.overrideStore = options.overrideStore;
  }

  async match(parsed: ParsedResult, fileHash?: string): Promise<MatchResult[]> {
    const override = fileHash !== undefined ? this.overrideStore?.get(fileHash) : undefined;
    if (override?.animeId) {
      return [matchResultFromOverride(override)];
    }

    if (!parsed.title) {
      return noMatch("No title parsed");
    }

    const animeList = await this.fetchAnimeSearch(parsed.title);
    if (animeList.length === 0) {
      return noMatch("No anime found");
    }

    const candidates = this.filterHighSimilarity(parsed.title, animeList);
    if (candidates.length === 0) return noMatch("No anime found");

    await this.batchFetchEpisodes(candidates.map((c) => c.anime.id));

    const results = candidates
      .map(({ anime, score }) => this.toMatchResult(anime, score, parsed))
      .sort((a, b) => b.score - a.score);

    return this.applyOverrideEntryType(results, override);
  }

  async matchBatch(parsedList: ParsedResult[]): Promise<MatchResult[]> {
    if (parsedList.length === 0) return [];

    const titleCandidates = new Map<string, { originalTitle: string; candidates: AnimeResult[] }>();

    for (const parsed of parsedList) {
      if (!parsed.title) continue;
      const key = parsed.title.toLowerCase();
      if (titleCandidates.has(key)) continue;

      const animeList = await this.fetchAnimeSearch(parsed.title);
      titleCandidates.set(key, { originalTitle: parsed.title, candidates: animeList });
    }

    const allScored = new Map<string, Array<{ anime: AnimeResult; score: number }>>();
    for (const [key, { originalTitle, candidates }] of titleCandidates) {
      const scored = this.filterHighSimilarity(originalTitle, candidates);
      allScored.set(key, scored);
    }

    const relevantIds = new Set<string>();
    for (const scored of allScored.values()) {
      for (const { anime } of scored) {
        relevantIds.add(anime.id);
      }
    }

    await this.batchFetchEpisodes(Array.from(relevantIds));

    return parsedList.map((parsed) => {
      if (!parsed.title) {
        return noMatchResult("No title parsed");
      }

      const key = parsed.title.toLowerCase();
      const candidates = allScored.get(key);
      if (!candidates || candidates.length === 0) {
        return noMatchResult("No anime found");
      }

      const matchResults = candidates
        .map(({ anime, score }) => this.toMatchResult(anime, score, parsed))
        .sort((a, b) => b.score - a.score);

      const viable =
        parsed.episode !== null
          ? matchResults.filter((r) => r.episode !== undefined)
          : matchResults;

      if (viable.length === 0) {
        return noMatchResult("No matching episode found");
      }

      const best = bestPerAnimeId(viable);
      const winner = isClearWinner(best);
      if (!winner) return noMatchResult(AMBIGUOUS_MATCH_REASON);
      return winner;
    });
  }

  private filterHighSimilarity(
    title: string,
    candidates: AnimeResult[],
  ): Array<{ anime: AnimeResult; score: number }> {
    return candidates
      .map((anime) => ({ anime, score: computeScore(title, anime.titleEn) }))
      .filter(({ score }) => score > Matcher.MIN_SIMILARITY);
  }

  private toMatchResult(anime: AnimeResult, score: number, parsed: ParsedResult): MatchResult {
    const totalScore =
      parsed.season !== null
        ? score + seasonMatchBoost(this.episodeCache.get(anime.id), parsed.season)
        : score;

    if (parsed.episode !== null) {
      const episodes = this.episodeCache.get(anime.id) ?? [];
      const matchingEpisode = resolveEpisode(episodes, parsed.season, parsed.episode);
      return { anime, episode: matchingEpisode, score: totalScore };
    }
    return { anime, score: totalScore };
  }

  private async fetchAnimeSearch(title: string): Promise<AnimeResult[]> {
    const key = title.toLowerCase();
    let results = this.searchCache.get(key);
    if (!results) {
      results = await this.db.searchAnime(title);
      this.searchCache.set(key, results);
    }
    return results;
  }

  getEpisodes(animeId: string): EpisodeResult[] {
    return this.episodeCache.get(animeId) ?? [];
  }

  private async batchFetchEpisodes(ids: string[]): Promise<void> {
    const uncached = ids.filter((id) => !this.episodeCache.has(id));
    for (let i = 0; i < uncached.length; i += Matcher.FETCH_CONCURRENCY) {
      const chunk = uncached.slice(i, i + Matcher.FETCH_CONCURRENCY);
      await Promise.all(
        chunk.map(async (id) => {
          const episodes = await this.db.getEpisodes(id);
          this.episodeCache.set(id, episodes);
        }),
      );
    }
  }

  private applyOverrideEntryType(results: MatchResult[], override?: OverrideData): MatchResult[] {
    if (!override?.entryType) return results;
    const entryType = override.entryType;
    return results.map((result) => ({
      ...result,
      anime: { ...result.anime, entryType },
      episode: result.episode ? { ...result.episode, entryType } : undefined,
    }));
  }
}
