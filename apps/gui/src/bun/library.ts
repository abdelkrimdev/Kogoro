import type { AnimeAggregate, EpisodeRepository, GroupRepository } from "@kogoro/core";
import { toDataUrl } from "./image-utils";

interface LibraryAnimeItem {
  id: string;
  titleEn: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
  libraryState: "on_disk" | "partially_on_disk" | "not_on_disk";
  groups: Array<{ entryType: string; watchStatus: string }>;
  groupCount: number;
}

export interface LibraryAnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    alternativeTitles?: string[];
    totalEpisodes: number;
    coverArt?: string;
  };
  groups: Array<{
    id: string;
    entryType: string;
    seasonNumber?: number;
    watchStatus: string;
    synopsis?: string;
    rating?: number;
    coverArt?: string;
    onDiskCount: number;
    missingCount: number;
    episodes: Array<{
      id: string;
      episodeNumber: number;
      titleEn: string;
      filePath: string;
      watched: boolean;
      notes?: string;
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

interface LibraryHandlerOptions {
  animeAggregate: AnimeAggregate;
  episodeRepo: EpisodeRepository;
  groupRepo: GroupRepository;
  getSourceDb?: () => string;
}

export type LibraryHandlers = ReturnType<typeof createLibraryHandlers>;

function totalEpisodeCount(groups: LibraryAnimeDetail["groups"]): number {
  return groups.reduce((sum, g) => sum + g.episodes.length, 0);
}

export function createLibraryHandlers(options: LibraryHandlerOptions) {
  const svc = options.animeAggregate;
  const { episodeRepo, groupRepo } = options;

  return {
    async getLibrary(): Promise<LibraryAnimeItem[]> {
      const displayData = svc.getAnimeForDisplay();
      return Promise.all(
        displayData.map(async ({ anime: a, groups }) => {
          const episodeCount = groups.reduce(
            (sum, g) => sum + svc.episodeRepo.getEpisodesByGroupId(g.id).length,
            0,
          );
          const filesOnDisk = a.filesOnDisk ?? episodeCount;

          let libraryState: "on_disk" | "partially_on_disk" | "not_on_disk";
          if (filesOnDisk === 0) {
            libraryState = "not_on_disk";
          } else if (filesOnDisk >= episodeCount) {
            libraryState = "on_disk";
          } else {
            libraryState = "partially_on_disk";
          }
          return {
            id: String(a.id),
            titleEn: a.title,
            episodeCount,
            filesOnDisk,
            coverArt: a.coverArtPath ? await toDataUrl(a.coverArtPath) : undefined,
            libraryState,
            groups: groups.map((g) => ({
              entryType: g.entryType,
              watchStatus: g.watchStatus,
            })),
            groupCount: groups.length,
          };
        }),
      );
    },

    async getAnimeDetail(params: { id: string }): Promise<LibraryAnimeDetail | null> {
      const anime = svc.animeRepo.getAnime(Number(params.id));
      if (!anime) return null;

      const dbGroups = svc.groupRepo.getEpisodeGroupsByAnimeId(anime.id);
      const groups: LibraryAnimeDetail["groups"] = await Promise.all(
        dbGroups.map(async (group) => {
          const dbEpisodes = svc.episodeRepo.getEpisodesByGroupId(group.id);
          const episodes = dbEpisodes.map((ep) => ({
            id: String(ep.id),
            episodeNumber: ep.episodeNumber,
            titleEn: ep.title ?? `Episode ${ep.episodeNumber}`,
            filePath: ep.filePath,
            watched: ep.watched,
            notes: ep.notes,
          }));
          const onDiskCount = episodes.filter((ep) => ep.filePath !== "").length;
          return {
            id: String(group.id),
            entryType: group.entryType,
            seasonNumber: group.seasonNumber,
            watchStatus: group.watchStatus,
            synopsis: group.synopsis,
            rating: group.rating,
            coverArt: group.coverArtPath ? await toDataUrl(group.coverArtPath) : undefined,
            onDiskCount,
            missingCount: episodes.length - onDiskCount,
            episodes,
          };
        }),
      );

      const coverArt = anime.coverArtPath ? await toDataUrl(anime.coverArtPath) : undefined;
      const totalEpisodes = totalEpisodeCount(groups);

      return {
        anime: {
          id: String(anime.id),
          titleEn: anime.title,
          alternativeTitles: anime.alternativeTitles,
          totalEpisodes,
          coverArt,
        },
        groups,
        filesOnDisk: totalEpisodes,
      };
    },

    async getWatchStatusByAnime(params: { animeId: string }): Promise<WatchStatusEntry[]> {
      const statuses = episodeRepo.getEpisodeWatchStatusByAnimeId(Number(params.animeId));
      return statuses.map((s) => ({
        episodeId: String(s.episodeId),
        watched: s.watched,
      }));
    },

    async setWatchStatus(params: {
      episodeId: string;
      watched: boolean;
    }): Promise<WatchStatusSetResult> {
      episodeRepo.setEpisodeWatched(Number(params.episodeId), params.watched);
      return { success: true };
    },

    async getLibraryStats(): Promise<LibraryStats> {
      return svc.animeRepo.getStats();
    },

    async updateGroupStatus(params: {
      groupId: string;
      status: string;
    }): Promise<{ success: boolean }> {
      const result = groupRepo.updateEpisodeGroupStatus(
        Number(params.groupId),
        params.status as "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped",
      );
      return { success: result !== null };
    },

    async toggleEpisodeWatched(params: {
      episodeId: string;
      watched: boolean;
    }): Promise<{ success: boolean }> {
      const result = episodeRepo.setEpisodeWatched(Number(params.episodeId), params.watched);
      return { success: result !== null };
    },

    async updateEpisodeNotes(params: {
      episodeId: string;
      notes: string;
    }): Promise<{ success: boolean }> {
      const result = episodeRepo.setEpisodeNotes(Number(params.episodeId), params.notes);
      return { success: result !== null };
    },

    async rebuild(): Promise<LibraryRebuildResult> {
      try {
        const sourceDb = options.getSourceDb?.();
        await svc.rebuild(sourceDb);
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
