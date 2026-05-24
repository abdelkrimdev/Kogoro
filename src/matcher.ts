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

export interface MatcherLike {
  match(parsed: ParsedResult, fileHash?: string): Promise<MatchResult[]>;
  matchBatch(parsedList: ParsedResult[]): Promise<MatchResult[]>;
}

export interface MatcherOptions {
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

function emptyAnimeResult(): AnimeResult {
  return { id: "", titleEn: "", entryType: "tv" };
}

function noMatchResult(failureReason: string): MatchResult {
  return { anime: emptyAnimeResult(), score: 0, failureReason };
}

function noMatch(failureReason: string): MatchResult[] {
  return [noMatchResult(failureReason)];
}

function findMatchingEpisode(
  episodes: EpisodeResult[],
  season: number | null,
  episode: number,
): EpisodeResult | undefined {
  if (season === null) {
    const regular = episodes.find((e) => e.episode === episode && e.season > 0);
    if (regular) return regular;
  }
  return episodes.find((e) => e.episode === episode && (season === null || e.season === season));
}

export class Matcher implements MatcherLike {
  private static readonly FETCH_CONCURRENCY = 5;
  private static readonly MIN_SIMILARITY = 0.15;

  private db: DatabasePlugin;
  private overrideStore?: OverrideStore;
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

    const animeList = await this.db.searchAnime(parsed.title);
    if (animeList.length === 0) {
      return noMatch("No anime found");
    }

    const candidates = this.filterHighSimilarity(parsed.title, animeList);
    if (candidates.length === 0) return noMatch("No anime found");

    await this.batchFetchEpisodes(candidates.map((c) => c.anime.id));

    const results = candidates.map(({ anime, score }) => {
      if (parsed.episode !== null) {
        const episodes = this.episodeCache.get(anime.id) ?? [];
        const matchingEpisode = findMatchingEpisode(episodes, parsed.season, parsed.episode);
        return { anime, episode: matchingEpisode, score };
      }
      return { anime, score };
    });

    results.sort((a, b) => b.score - a.score);

    return this.applyOverrideEntryType(results, override);
  }

  async matchBatch(parsedList: ParsedResult[]): Promise<MatchResult[]> {
    if (parsedList.length === 0) return [];

    const titleCandidates = new Map<string, { originalTitle: string; candidates: AnimeResult[] }>();

    for (const parsed of parsedList) {
      if (!parsed.title) continue;
      const key = parsed.title.toLowerCase();
      if (titleCandidates.has(key)) continue;

      const animeList = await this.db.searchAnime(parsed.title);
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

      const matchResults = candidates.map(({ anime, score }) => {
        if (parsed.episode !== null) {
          const episodes = this.episodeCache.get(anime.id) ?? [];
          const matchingEpisode = findMatchingEpisode(episodes, parsed.season, parsed.episode);
          return { anime, episode: matchingEpisode, score };
        }
        return { anime, score };
      });

      matchResults.sort((a, b) => b.score - a.score);
      return matchResults[0] ?? noMatchResult("No anime found");
    });
  }

  private filterHighSimilarity(
    title: string,
    candidates: AnimeResult[],
  ): Array<{ anime: AnimeResult; score: number }> {
    return candidates
      .map((anime) => ({ anime, score: diceSimilarity(title, anime.titleEn) }))
      .filter(({ score }) => score > Matcher.MIN_SIMILARITY);
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
