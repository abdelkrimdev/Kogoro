import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { AnimeResult, EpisodeResult } from "./db/types.ts";
import type { OverrideStore } from "./override-store.ts";
import type { ParsedResult } from "./parser.ts";

export interface MatchResult {
  anime: AnimeResult;
  episode?: EpisodeResult;
  score: number;
  failureReason?: string;
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

function noMatch(failureReason: string): MatchResult[] {
  return [{ anime: emptyAnimeResult(), score: 0, failureReason }];
}

export class Matcher {
  private db: DatabasePlugin;
  private overrideStore?: OverrideStore;

  constructor(options: MatcherOptions) {
    this.db = options.database;
    this.overrideStore = options.overrideStore;
  }

  async match(parsed: ParsedResult, fileHash?: string): Promise<MatchResult[]> {
    if (fileHash !== undefined) {
      const override = this.overrideStore?.get(fileHash);
      if (override?.animeId) {
        const anime: AnimeResult = {
          id: override.animeId,
          title: "(overridden)",
          entryType: override.entryType ?? "tv",
        };
        const episode: EpisodeResult | undefined = override.episodeId
          ? {
              id: override.episodeId,
              animeId: override.animeId,
              season: 0,
              episode: 0,
              title: "(overridden)",
              entryType: override.entryType ?? "tv",
            }
          : undefined;
        return [{ anime, episode, score: 1 }];
      }
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
        const matchingEpisode = episodes.find(
          (e) =>
            e.episode === parsed.episode && (parsed.season === null || e.season === parsed.season),
        );
        results.push({ anime, episode: matchingEpisode, score });
      } else {
        results.push({ anime, score });
      }
    }

    results.sort((a, b) => b.score - a.score);

    return this.applyOverrideEntryType(results, fileHash);
  }

  private applyOverrideEntryType(results: MatchResult[], fileHash?: string): MatchResult[] {
    if (fileHash === undefined) return results;
    const override = this.overrideStore?.get(fileHash);
    if (!override?.entryType) return results;
    const entryType = override.entryType;
    return results.map((r) => ({
      ...r,
      anime: { ...r.anime, entryType },
      episode: r.episode ? { ...r.episode, entryType } : undefined,
    }));
  }
}
