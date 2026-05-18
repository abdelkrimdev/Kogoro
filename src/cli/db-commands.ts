import { TVDBAdapter } from "../database/tvdb-adapter.ts";
import type { DatabasePlugin } from "../database/types.ts";

export interface DbHandlerOptions {
  apiKey?: string;
  adapter?: DatabasePlugin;
}

export function createDbHandlers(options: DbHandlerOptions = {}) {
  const adapter = options.adapter ?? new TVDBAdapter({ apiKey: options.apiKey });

  return {
    async search(title: string): Promise<string> {
      const results = await adapter.searchAnime(title);
      return JSON.stringify(results, null, 2);
    },

    async episodes(animeId: string): Promise<string> {
      const results = await adapter.getEpisodes(animeId);
      return JSON.stringify(results, null, 2);
    },
  };
}
