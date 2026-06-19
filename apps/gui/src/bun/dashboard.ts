import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { LibraryService } from "@kogoro/core";

interface DashboardCurrentlyWatching {
  id: string;
  title: string;
  groupName: string;
  coverArt?: string;
  watchedEpisodes: number;
  totalEpisodes: number;
}

interface DashboardContinueWatching {
  id: string;
  title: string;
  groupName: string;
  coverArt?: string;
  nextEpisode: string;
  watchedEpisodes: number;
  totalEpisodes: number;
  animeId: string;
}

interface DashboardStats {
  totalAnime: number;
  totalEpisodes: number;
  onDisk: number;
  partiallyOnDisk: number;
  notOnDisk: number;
}

export interface DashboardData {
  currentlyWatching: DashboardCurrentlyWatching[];
  libraryStats: DashboardStats;
  continueWatching: DashboardContinueWatching[];
}

type LibraryStats = { animeCount: number; episodeCount: number };

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

function entryTypeLabel(entryType: string, seasonNumber?: number): string {
  switch (entryType) {
    case "tv":
      return seasonNumber != null ? `Season ${seasonNumber}` : "TV";
    case "movie":
      return "Movie";
    case "ova":
      return "OVA";
    case "special":
      return "Specials";
    default:
      return entryType;
  }
}

export type DashboardHandlers = ReturnType<typeof createDashboardHandlers>;

export function createDashboardHandlers(options: { libraryService: LibraryService }) {
  const svc = options.libraryService;

  return {
    async getDashboardData(): Promise<DashboardData> {
      const animeList = svc.listAnime();
      const stats = svc.getStats();

      let onDisk = 0;
      let partiallyOnDisk = 0;
      let notOnDisk = 0;

      for (const a of animeList) {
        switch (a.libraryState) {
          case "on_disk":
            onDisk++;
            break;
          case "partially_on_disk":
            partiallyOnDisk++;
            break;
          default:
            notOnDisk++;
            break;
        }
      }

      const currentlyWatching: DashboardCurrentlyWatching[] = [];
      const continueWatching: DashboardContinueWatching[] = [];

      for (const a of animeList) {
        const groups = svc.getEpisodeGroupsByAnimeId(a.id);
        const coverArt = a.coverArtPath ? await toDataUrl(a.coverArtPath) : undefined;

        for (const group of groups) {
          if (group.watchStatus !== "watching") continue;

          const episodes = svc.getEpisodesByGroupId(group.id);
          const watchedCount = episodes.filter((ep) => ep.watched).length;

          currentlyWatching.push({
            id: String(group.id),
            title: a.title,
            groupName: entryTypeLabel(group.entryType, group.seasonNumber),
            coverArt,
            watchedEpisodes: watchedCount,
            totalEpisodes: episodes.length,
          });
        }

        for (const group of groups) {
          const episodes = svc.getEpisodesByGroupId(group.id);
          const watchedCount = episodes.filter((ep) => ep.watched).length;
          const unwatchedEpisodes = episodes.filter((ep) => !ep.watched);
          const hasFilesOnDisk = episodes.some((ep) => ep.filePath.length > 0);

          if (unwatchedEpisodes.length > 0 && hasFilesOnDisk && watchedCount > 0) {
            const nextEp = unwatchedEpisodes[0];
            continueWatching.push({
              id: String(group.id),
              title: a.title,
              groupName: entryTypeLabel(group.entryType, group.seasonNumber),
              coverArt,
              nextEpisode: nextEp?.title ?? `Episode ${nextEp?.episodeNumber}`,
              watchedEpisodes: watchedCount,
              totalEpisodes: episodes.length,
              animeId: String(a.id),
            });
            break;
          }
        }
      }

      return {
        currentlyWatching,
        libraryStats: {
          totalAnime: stats.animeCount,
          totalEpisodes: stats.episodeCount,
          onDisk,
          partiallyOnDisk,
          notOnDisk,
        },
        continueWatching,
      };
    },

    getLibraryStats(): LibraryStats {
      return svc.getStats();
    },
  };
}
