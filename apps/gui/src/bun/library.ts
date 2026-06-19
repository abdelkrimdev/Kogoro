import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { LibraryService } from "@kogoro/core";

interface LibraryAnimeItem {
  id: string;
  titleEn: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
}

export interface LibraryAnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    sourceDb: string;
    totalEpisodes: number;
    coverArt?: string;
    genres?: string[];
  };
  groups: Array<{
    id: string;
    entryType: string;
    seasonNumber?: number;
    watchStatus: string;
    synopsis?: string;
    rating?: number;
    coverArt?: string;
    episodes: Array<{
      id: string;
      episodeNumber: number;
      titleEn: string;
      filePath: string;
      watched: boolean;
    }>;
  }>;
  filesOnDisk: number;
}

type WatchStatusEntry = {
  episodeId: string;
  watched: boolean;
};

type LibraryStats = { animeCount: number; episodeCount: number };

type WatchStatusSetResult = { success: boolean };

type LibraryRebuildResult = { success: boolean; error?: string };

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

async function toDataUrl(filePath: string): Promise<string | undefined> {
  try {
    const buf = await readFile(filePath);
    const mime = MIME[extname(filePath).toLowerCase()] ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

interface LibraryHandlerOptions {
  libraryService: LibraryService;
  getSourceDb?: () => string;
}

export type LibraryHandlers = ReturnType<typeof createLibraryHandlers>;

function totalEpisodeCount(groups: LibraryAnimeDetail["groups"]): number {
  return groups.reduce((sum, g) => sum + g.episodes.length, 0);
}

export function createLibraryHandlers(options: LibraryHandlerOptions) {
  const svc = options.libraryService;

  return {
    async getLibrary(): Promise<LibraryAnimeItem[]> {
      const animeList = svc.listAnime();
      return Promise.all(
        animeList.map(async (a) => ({
          id: String(a.id),
          titleEn: a.title,
          episodeCount: a.episodeCount,
          filesOnDisk: a.filesOnDisk ?? a.episodeCount,
          coverArt: a.coverArtPath ? await toDataUrl(a.coverArtPath) : undefined,
        })),
      );
    },

    async getAnimeDetail(params: { id: string }): Promise<LibraryAnimeDetail | null> {
      const anime = svc.getAnime(Number(params.id));
      if (!anime) return null;

      const dbGroups = svc.getEpisodeGroupsByAnimeId(anime.id);
      const groups: LibraryAnimeDetail["groups"] = await Promise.all(
        dbGroups.map(async (group) => {
          const dbEpisodes = svc.getEpisodesByGroupId(group.id);
          return {
            id: String(group.id),
            entryType: group.entryType,
            seasonNumber: group.seasonNumber,
            watchStatus: group.watchStatus,
            synopsis: group.synopsis,
            rating: group.rating,
            coverArt: group.coverArtPath ? await toDataUrl(group.coverArtPath) : undefined,
            episodes: dbEpisodes.map((ep) => ({
              id: String(ep.id),
              episodeNumber: ep.episodeNumber,
              titleEn: ep.title ?? `Episode ${ep.episodeNumber}`,
              filePath: ep.filePath,
              watched: ep.watched,
            })),
          };
        }),
      );

      const coverArt = anime.coverArtPath ? await toDataUrl(anime.coverArtPath) : undefined;

      return {
        anime: {
          id: String(anime.id),
          titleEn: anime.title,
          titleJa: anime.titleJapanese,
          sourceDb: anime.sourceDb,
          totalEpisodes: anime.episodeCount,
          coverArt,
          genres: anime.genres,
        },
        groups,
        filesOnDisk: totalEpisodeCount(groups),
      };
    },

    async getWatchStatusByAnime(params: { animeId: string }): Promise<WatchStatusEntry[]> {
      const statuses = svc.getEpisodeWatchStatusByAnimeId(Number(params.animeId));
      return statuses.map((s) => ({
        episodeId: String(s.episodeId),
        watched: s.watched,
      }));
    },

    async setWatchStatus(params: {
      episodeId: string;
      watched: boolean;
    }): Promise<WatchStatusSetResult> {
      svc.setEpisodeWatched(Number(params.episodeId), params.watched);
      return { success: true };
    },

    async getLibraryStats(): Promise<LibraryStats> {
      return svc.getStats();
    },

    async updateGroupStatus(params: {
      groupId: string;
      status: string;
    }): Promise<{ success: boolean }> {
      const result = svc.setGroupWatchStatus(
        Number(params.groupId),
        params.status as "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped",
      );
      return { success: result !== null };
    },

    async toggleEpisodeWatched(params: {
      episodeId: string;
      watched: boolean;
    }): Promise<{ success: boolean }> {
      const result = svc.setEpisodeWatched(Number(params.episodeId), params.watched);
      return { success: result !== null };
    },

    rebuild(): LibraryRebuildResult {
      try {
        const sourceDb = options.getSourceDb?.();
        svc.rebuild(sourceDb);
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
