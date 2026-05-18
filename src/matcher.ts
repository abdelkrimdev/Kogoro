import type { AnimeResult, DatabasePlugin, EpisodeResult } from "./database/types.ts";
import type { ParsedResult } from "./parser.ts";

export interface MatchResult {
  anime: AnimeResult;
  episode?: EpisodeResult;
}

export interface MatcherOptions {
  database: DatabasePlugin;
}

export class Matcher {
  private db: DatabasePlugin;

  constructor(options: MatcherOptions) {
    this.db = options.database;
  }

  async match(parsed: ParsedResult): Promise<MatchResult[]> {
    if (!parsed.title) return [];

    const animeList = await this.db.searchAnime(parsed.title);
    if (animeList.length === 0) return [];

    const results: MatchResult[] = [];

    for (const anime of animeList) {
      if (parsed.episode !== null) {
        const episodes = await this.db.getEpisodes(anime.id);
        const matchingEpisode = episodes.find(
          (e) =>
            e.episodeNumber === parsed.episode &&
            (parsed.season === null || e.seasonNumber === parsed.season),
        );
        results.push({ anime, episode: matchingEpisode });
      } else {
        results.push({ anime });
      }
    }

    return results;
  }
}
