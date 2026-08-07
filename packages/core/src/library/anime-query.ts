import { dirname } from "node:path";
import { stripTypeDir } from "../config/schema";
import type { MatchEntry } from "../types";
import type { AnimeRepository, LibraryAnime } from "./anime-repository";
import { exportMatchesFromRepo } from "./anime-repository";
import type { EpisodeRepository, LibraryEpisode } from "./episode-repository";
import type { EpisodeGroup, GroupRepository } from "./group-repository";

export interface AnimeQueryDeps {
  anime: AnimeRepository;
  episodes: EpisodeRepository;
  groups: GroupRepository;
}

export class AnimeQuery {
  constructor(private deps: AnimeQueryDeps) {}

  getAnimeForDisplay(filters?: {
    sourceDb?: string;
    franchiseId?: number;
    watchStatus?: "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";
  }): Array<{
    anime: LibraryAnime;
    groups: Array<EpisodeGroup & { episodes: LibraryEpisode[] }>;
  }> {
    let animeList = this.deps.anime.listAnime();

    if (filters?.sourceDb) {
      const sourceDb = filters.sourceDb;
      animeList = animeList.filter(
        (a) => this.deps.anime.getAnimeSourceMapping(a.id, sourceDb) !== null,
      );
    }
    if (filters?.franchiseId !== undefined) {
      animeList = animeList.filter((a) => a.franchiseId === filters.franchiseId);
    }

    const result: Array<{
      anime: LibraryAnime;
      groups: Array<EpisodeGroup & { episodes: LibraryEpisode[] }>;
    }> = [];

    for (const anime of animeList) {
      const groups = this.deps.groups.getEpisodeGroupsByAnimeId(anime.id);

      const filteredGroups = filters?.watchStatus
        ? groups.filter((g) => g.watchStatus === filters.watchStatus)
        : groups;

      if (filters?.watchStatus && filteredGroups.length === 0) continue;

      const groupsWithEpisodes = filteredGroups.map((group) => ({
        ...group,
        episodes: this.deps.episodes.getEpisodesByGroupId(group.id),
      }));

      result.push({ anime, groups: groupsWithEpisodes });
    }

    return result;
  }

  exportMatches(): MatchEntry[] {
    return exportMatchesFromRepo(this.deps.anime);
  }

  getAnimeDir(animeId: number): string | null {
    const episodes = this.deps.episodes.getEpisodesByAnimeId(animeId);
    if (episodes.length === 0) return null;
    const paths = episodes.map((ep) => ep.filePath);
    const first = paths[0];
    if (!first) return null;
    let commonParent = dirname(first);
    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];
      if (!path) continue;
      while (commonParent && !path.startsWith(commonParent)) {
        commonParent = dirname(commonParent);
      }
    }
    if (commonParent) {
      commonParent = stripTypeDir(commonParent);
    }
    return commonParent;
  }

  animeExists(externalId: string, sourceDb = "tvdb"): boolean {
    return this.deps.anime.findAnime(externalId, sourceDb) !== null;
  }

  animeExistsByTitle(title: string): boolean {
    return this.deps.anime.findAnimeByTitle(title) !== null;
  }

  getStats(): { animeCount: number; episodeCount: number } {
    return this.deps.anime.getStats();
  }

  getEpisodesByGroupId(groupId: number): LibraryEpisode[] {
    return this.deps.episodes.getEpisodesByGroupId(groupId);
  }
}
