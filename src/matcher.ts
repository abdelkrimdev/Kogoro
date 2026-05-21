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
  const entryType = cached.entryType as EntryType;

  let episode: EpisodeResult | undefined;
  if (cached.episodeId !== null && cached.episode !== null) {
    episode = {
      id: cached.episodeId,
      animeId: cached.animeId,
      season: cached.season ?? 1,
      episode: cached.episode,
      title: cached.title ?? "",
      entryType,
    };
  }

  return {
    anime: {
      id: cached.animeId,
      title: cached.animeTitle ?? "",
      entryType,
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
      title: "(overridden)",
      entryType,
    };
  }

  return {
    anime: {
      id: animeId,
      title: "(overridden)",
      entryType,
    },
    episode,
    score: 1,
  };
}

export function matchResultFromManual(
  animeId: string,
  episode: number,
  entryType: string,
): MatchResult {
  const typedEntryType = entryType as EntryType;
  return {
    anime: { id: animeId, title: "", entryType: typedEntryType },
    episode: {
      id: "",
      animeId,
      season: 1,
      episode,
      title: "",
      entryType: typedEntryType,
    },
    score: 1,
  };
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
  return { id: "", title: "", entryType: "tv" };
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
  return episodes.find((e) => e.episode === episode && (season === null || e.season === season));
}

export class Matcher {
  private db: DatabasePlugin;
  private overrideStore?: OverrideStore;

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

    const results: MatchResult[] = [];

    for (const anime of animeList) {
      const score = diceSimilarity(parsed.title, anime.title);
      if (parsed.episode !== null) {
        const episodes = await this.db.getEpisodes(anime.id);
        const matchingEpisode = findMatchingEpisode(episodes, parsed.season, parsed.episode);
        results.push({ anime, episode: matchingEpisode, score });
      } else {
        results.push({ anime, score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return this.applyOverrideEntryType(results, override);
  }

  async matchBatch(parsedList: ParsedResult[]): Promise<MatchResult[]> {
    if (parsedList.length === 0) return [];

    const titleCandidates = new Map<string, AnimeResult[]>();
    const animeIds = new Set<string>();

    for (const parsed of parsedList) {
      if (!parsed.title) continue;
      if (titleCandidates.has(parsed.title)) continue;

      const animeList = await this.db.searchAnime(parsed.title);
      titleCandidates.set(parsed.title, animeList);
      for (const anime of animeList) {
        animeIds.add(anime.id);
      }
    }

    const episodeCache = new Map<string, EpisodeResult[]>();
    await Promise.all(
      Array.from(animeIds).map(async (id) => {
        episodeCache.set(id, await this.db.getEpisodes(id));
      }),
    );

    return parsedList.map((parsed) => {
      if (!parsed.title) {
        return noMatchResult("No title parsed");
      }

      const candidates = titleCandidates.get(parsed.title) ?? [];
      if (candidates.length === 0) {
        return noMatchResult("No anime found");
      }

      const matchResults: MatchResult[] = [];
      for (const anime of candidates) {
        const score = diceSimilarity(parsed.title, anime.title);
        if (parsed.episode !== null) {
          const episodes = episodeCache.get(anime.id) ?? [];
          const matchingEpisode = findMatchingEpisode(episodes, parsed.season, parsed.episode);
          matchResults.push({ anime, episode: matchingEpisode, score });
        } else {
          matchResults.push({ anime, score });
        }
      }

      matchResults.sort((a, b) => b.score - a.score);
      return matchResults[0] ?? noMatchResult("No anime found");
    });
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
