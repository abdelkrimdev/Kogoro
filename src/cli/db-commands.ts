import type { DatabasePlugin } from "../plugins/database/plugin";

export function createDBCommands(adapter: DatabasePlugin) {
  return {
    async search(
      title: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const results = await adapter.searchAnime(title);
        onLog(JSON.stringify(results, null, 2));
      } catch {
        onError("Search failed");
      }
    },

    async episodes(
      animeId: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const results = await adapter.getEpisodes(animeId);
        onLog(JSON.stringify(results, null, 2));
      } catch {
        onError("Failed to fetch episodes");
      }
    },
  };
}
