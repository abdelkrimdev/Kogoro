import { join } from "node:path";
import type { ConfigManager, MatchEntry } from "@kogoro/core";
import { LibraryDb } from "@kogoro/core";

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

export function createLibraryHandlers(configDir: string, configManager: ConfigManager) {
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
          filesOnDisk: a.filesOnDisk ?? a.episodeCount,
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

        const dbEpisodes = db.getEpisodesByAnimeId(anime.id);

        const totalEpisodes = anime.episodeCount;

        const allEpisodes: LibraryAnimeDetail["episodes"] = [];
        for (let epNum = 1; epNum <= totalEpisodes; epNum++) {
          const dbEp = dbEpisodes.find((e) => e.episodeNumber === epNum);
          if (dbEp) {
            allEpisodes.push({
              id: String(dbEp.id),
              season: dbEp.season ?? 1,
              episode: dbEp.episodeNumber,
              titleEn: dbEp.title ?? `Episode ${dbEp.episodeNumber}`,
              filePath: dbEp.filePath,
              missing: false,
            });
          } else {
            allEpisodes.push({
              id: `missing-${anime.id}-${epNum}`,
              season: 1,
              episode: epNum,
              titleEn: `Episode ${epNum}`,
              filePath: "",
              missing: true,
            });
          }
        }

        return {
          anime: {
            id: String(anime.id),
            titleEn: anime.title,
            titleJa: anime.titleJapanese,
            entryType: anime.entryType,
            sourceDb: anime.sourceDb,
            totalEpisodes,
            coverArt: anime.coverArtPath,
          },
          episodes: allEpisodes,
          filesOnDisk: dbEpisodes.length,
        };
      } finally {
        db.close();
      }
    },

    async getWatchStatusByAnime(params: {
      animeId: string;
    }): Promise<Array<{ episodeId: string; watched: boolean; notes?: string; updatedAt: string }>> {
      const db = getDb();
      try {
        const statuses = db.getWatchStatusByAnimeId(Number(params.animeId));
        return statuses.map((s) => ({
          episodeId: String(s.episodeId),
          watched: s.watched,
          notes: s.notes,
          updatedAt: s.updatedAt,
        }));
      } finally {
        db.close();
      }
    },

    async setWatchStatus(params: {
      episodeId: string;
      watched: boolean;
      notes?: string;
    }): Promise<{ success: boolean }> {
      const db = getDb();
      try {
        db.setWatchStatus(Number(params.episodeId), params.watched, params.notes);
        return { success: true };
      } finally {
        db.close();
      }
    },

    async getLibraryStats(): Promise<{ animeCount: number; episodeCount: number }> {
      const db = getDb();
      try {
        return db.getStats();
      } finally {
        db.close();
      }
    },

    mergeMatches(matches: MatchEntry[], sourceDb: string): void {
      const db = getDb();
      try {
        db.mergeFromMatches(matches, sourceDb);
      } finally {
        db.close();
      }
    },

    rebuild(): { success: boolean; error?: string } {
      try {
        const db = getDb();
        try {
          const matches = db.exportMatches();
          db.rebuildFromMatches(matches, String(configManager.get("primary-db") ?? "tvdb"));
          return { success: true };
        } finally {
          db.close();
        }
      } catch (err) {
        return {
          success: false,
          error: `Rebuild failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };
}
