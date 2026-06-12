import type { LibraryService, MatchEntry } from "@kogoro/core";

interface LibraryAnimeItem {
  id: string;
  titleEn: string;
  entryType: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
}

interface LibraryAnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    entryType: string;
    sourceDb: string;
    totalEpisodes: number;
    coverArt?: string;
  };
  episodes: Array<{
    id: string;
    season: number;
    episode: number;
    titleEn: string;
    filePath: string;
    missing: boolean;
  }>;
  filesOnDisk: number;
}

interface LibraryHandlerOptions {
  libraryService: LibraryService;
}

export function createLibraryHandlers(options: LibraryHandlerOptions) {
  const svc = options.libraryService;

  return {
    async getLibrary(): Promise<LibraryAnimeItem[]> {
      const animeList = svc.listAnime();
      return animeList.map((a) => ({
        id: String(a.id),
        titleEn: a.title,
        entryType: a.entryType,
        episodeCount: a.episodeCount,
        filesOnDisk: a.filesOnDisk ?? a.episodeCount,
        coverArt: a.coverArtPath,
      }));
    },

    async getAnimeDetail(params: { id: string }): Promise<LibraryAnimeDetail | null> {
      const anime = svc.getAnime(Number(params.id));
      if (!anime) return null;

      const dbEpisodes = svc.getEpisodesByAnimeId(anime.id);

      const allEpisodes: LibraryAnimeDetail["episodes"] = dbEpisodes.map((dbEp) => ({
        id: String(dbEp.id),
        season: dbEp.season ?? 1,
        episode: dbEp.episodeNumber,
        titleEn: dbEp.title ?? `Episode ${dbEp.episodeNumber}`,
        filePath: dbEp.filePath,
        missing: false,
      }));

      return {
        anime: {
          id: String(anime.id),
          titleEn: anime.title,
          titleJa: anime.titleJapanese,
          entryType: anime.entryType,
          sourceDb: anime.sourceDb,
          totalEpisodes: anime.episodeCount,
          coverArt: anime.coverArtPath,
        },
        episodes: allEpisodes,
        filesOnDisk: dbEpisodes.length,
      };
    },

    async getWatchStatusByAnime(params: {
      animeId: string;
    }): Promise<Array<{ episodeId: string; watched: boolean; notes?: string; updatedAt: string }>> {
      const statuses = svc.getWatchStatusByAnimeId(Number(params.animeId));
      return statuses.map((s) => ({
        episodeId: String(s.episodeId),
        watched: s.watched,
        notes: s.notes,
        updatedAt: s.updatedAt,
      }));
    },

    async setWatchStatus(params: {
      episodeId: string;
      watched: boolean;
      notes?: string;
    }): Promise<{ success: boolean }> {
      svc.setWatchStatus(Number(params.episodeId), params.watched, params.notes);
      return { success: true };
    },

    async getLibraryStats(): Promise<{ animeCount: number; episodeCount: number }> {
      return svc.getStats();
    },

    mergeMatches(matches: MatchEntry[]): void {
      svc.mergeFromMatches(matches);
    },

    rebuild(): { success: boolean; error?: string } {
      try {
        svc.rebuild();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: `Rebuild failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
