import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { AnimeResult, EpisodeResult } from "./db/types.ts";
import type { ParsedResult } from "./parser.ts";

export interface MatchResult {
  anime: AnimeResult;
  episode?: EpisodeResult;
  score: number;
  failureReason?: string;
}

export interface MatcherOptions {
  database: DatabasePlugin;
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

export class Matcher {
  private db: DatabasePlugin;

  constructor(options: MatcherOptions) {
    this.db = options.database;
  }

  async match(parsed: ParsedResult): Promise<MatchResult[]> {
    if (!parsed.title)
      return [{ anime: {} as AnimeResult, score: 0, failureReason: "No title parsed" }];

    const animeList = await this.db.searchAnime(parsed.title);
    if (animeList.length === 0)
      return [{ anime: {} as AnimeResult, score: 0, failureReason: "No anime found" }];

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

    return results;
  }
}
