import { join } from "node:path";
import { LibraryDb } from "@kogoro/core";

export interface LibraryAnimeItem {
  id: string;
  titleEn: string;
  entryType: string;
  episodeCount: number;
  coverArt?: string;
}

export interface LibraryAnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    entryType: string;
    coverArt?: string;
  };
  episodes: Array<{
    id: string;
    season: number;
    episode: number;
    titleEn: string;
  }>;
}

export function createLibraryHandlers(configDir: string) {
  const dbPath = join(configDir, "library.db");
  function getDb(): LibraryDb {
    return new LibraryDb({ dbPath });
  }

  return {
    async getLibrary(): Promise<LibraryAnimeItem[]> {
      const db = getDb();
      try {
        const animeList = db.listAnime();
        return animeList.map((a) => ({
          id: String(a.id),
          titleEn: a.title,
          entryType: a.entryType,
          episodeCount: a.episodeCount,
          coverArt: a.coverArtPath,
        }));
      } finally {
        db.close();
      }
    },

    async getAnimeDetail(params: { id: string }): Promise<LibraryAnimeDetail | null> {
      const db = getDb();
      try {
        const anime = db.getAnime(Number(params.id));
        if (!anime) return null;

        const episodes = db.getEpisodesByAnimeId(anime.id);
        return {
          anime: {
            id: String(anime.id),
            titleEn: anime.title,
            titleJa: anime.titleJapanese,
            entryType: anime.entryType,
            coverArt: anime.coverArtPath,
          },
          episodes: episodes.map((ep) => ({
            id: String(ep.id),
            season: ep.season ?? 1,
            episode: ep.episodeNumber,
            titleEn: ep.title ?? `Episode ${ep.episodeNumber}`,
          })),
        };
      } finally {
        db.close();
      }
    },
  };
}
