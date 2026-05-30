import type { AnimeResult, DatabasePlugin, EpisodeResult } from "@kogoro/plugins";

export function createDatabaseHandlers(plugin: DatabasePlugin) {
  return {
    async search(title: string): Promise<AnimeResult[]> {
      return plugin.searchAnime(title);
    },

    async episodes(animeId: string): Promise<EpisodeResult[]> {
      return plugin.getEpisodes(animeId);
    },
  };
}
