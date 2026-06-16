import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { LibraryService } from "@kogoro/core";

export interface LibraryAnimeItem {
  id: string;
  titleEn: string;
  entryType: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
}

export interface LibraryAnimeDetail {
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

export type WatchStatusEntry = {
  episodeId: string;
  watched: boolean;
  notes?: string;
  updatedAt: string;
};

export type LibraryStats = { animeCount: number; episodeCount: number };

export type WatchStatusSetResult = { success: boolean };

export type LibraryRebuildResult = { success: boolean; error?: string };

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

export function createLibraryHandlers(options: LibraryHandlerOptions) {
  const svc = options.libraryService;

  return {
    async getLibrary(): Promise<LibraryAnimeItem[]> {
      const animeList = svc.listAnime();
      return Promise.all(
        animeList.map(async (a) => ({
          id: String(a.id),
          titleEn: a.title,
          entryType: a.entryType,
          episodeCount: a.episodeCount,
          filesOnDisk: a.filesOnDisk ?? a.episodeCount,
          coverArt: a.coverArtPath ? await toDataUrl(a.coverArtPath) : undefined,
        })),
      );
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

      const coverArt = anime.coverArtPath ? await toDataUrl(anime.coverArtPath) : undefined;

      return {
        anime: {
          id: String(anime.id),
          titleEn: anime.title,
          titleJa: anime.titleJapanese,
          entryType: anime.entryType,
          sourceDb: anime.sourceDb,
          totalEpisodes: anime.episodeCount,
          coverArt,
        },
        episodes: allEpisodes,
        filesOnDisk: dbEpisodes.length,
      };
    },

    async getWatchStatusByAnime(params: { animeId: string }): Promise<WatchStatusEntry[]> {
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
    }): Promise<WatchStatusSetResult> {
      svc.setWatchStatus(Number(params.episodeId), params.watched, params.notes);
      return { success: true };
    },

    async getLibraryStats(): Promise<LibraryStats> {
      return svc.getStats();
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
