import type { AnimeAggregate } from "@kogoro/core";
import { toDataUrl } from "./image-utils";

export interface DashboardCurrentlyWatching {
  id: string;
  title: string;
  groupName: string;
  coverArt?: string;
  watchedEpisodes: number;
  totalEpisodes: number;
}

export interface DashboardContinueWatching {
  id: string;
  title: string;
  groupName: string;
  coverArt?: string;
  nextEpisode: string;
  watchedEpisodes: number;
  totalEpisodes: number;
  animeId: string;
}

export interface DashboardStats {
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

export function createDashboardHandlers(options: { animeAggregate: AnimeAggregate }) {
  const svc = options.animeAggregate;

  return {
    async getDashboardData(): Promise<DashboardData> {
      const displayData = svc.getAnimeForDisplay();
      const stats = svc.library.getStats();

      let onDisk = 0;
      let partiallyOnDisk = 0;
      let notOnDisk = 0;

      for (const { anime } of displayData) {
        switch (anime.libraryState) {
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

      for (const { anime, groups } of displayData) {
        const coverArt = anime.coverArtPath ? await toDataUrl(anime.coverArtPath) : undefined;

        for (const group of groups) {
          const watchedCount = group.episodes.filter((ep) => ep.watched).length;
          const groupName = entryTypeLabel(group.entryType, group.seasonNumber);

          if (group.watchStatus === "watching") {
            currentlyWatching.push({
              id: String(group.id),
              title: anime.title,
              groupName,
              coverArt,
              watchedEpisodes: watchedCount,
              totalEpisodes: group.episodes.length,
            });
          }

          const nextUnwatched = group.episodes.find((ep) => !ep.watched);
          const hasFilesOnDisk = group.episodes.some((ep) => ep.filePath.length > 0);

          if (nextUnwatched && hasFilesOnDisk && watchedCount > 0) {
            continueWatching.push({
              id: String(group.id),
              title: anime.title,
              groupName,
              coverArt,
              nextEpisode: nextUnwatched.title ?? `Episode ${nextUnwatched.episodeNumber}`,
              watchedEpisodes: watchedCount,
              totalEpisodes: group.episodes.length,
              animeId: String(anime.id),
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
      return svc.library.getStats();
    },
  };
}
