import type { EnrichmentProvider, KnownEntry } from "../types";
import { FranchiseAggregate } from "./franchise-aggregate";
import type { LibraryRepository } from "./library-repository";

export class EnrichmentService {
  private franchiseAggregate: FranchiseAggregate;

  constructor(
    private repository: LibraryRepository,
    private provider: EnrichmentProvider,
  ) {
    this.franchiseAggregate = new FranchiseAggregate({ library: repository, provider });
  }

  async enrichAnime(animeIds: number[], knownAnilistEntries?: KnownEntry[]): Promise<void> {
    const needsSearch: Array<{ animeId: number; title: string }> = [];
    const animeByAnilistId = new Map<string, number[]>();

    const knownFromGroups = this.repository.getKnownAnilistIds();
    const titleToAnilistId = new Map<string, string>();
    const animeIdToAnilistId = new Map<number, string>();

    for (const [anilistId, ids] of knownFromGroups) {
      for (const animeId of ids) {
        const existing = animeByAnilistId.get(anilistId);
        if (existing) {
          existing.push(animeId);
        } else {
          animeByAnilistId.set(anilistId, [animeId]);
        }
        animeIdToAnilistId.set(animeId, anilistId);
      }
    }

    if (knownAnilistEntries) {
      for (const entry of knownAnilistEntries) {
        titleToAnilistId.set(entry.title.toLowerCase(), entry.anilistId);
      }
    }

    for (const animeId of animeIds) {
      const anime = this.repository.getAnime(animeId);
      if (!anime) continue;
      if (anime.franchiseId) continue;
      if (this.repository.hasAnimeTrackerMapping(animeId, "anilist")) continue;

      const matchedAnilistId = this.findKnownAnilistId(
        animeId,
        anime.title,
        animeIdToAnilistId,
        titleToAnilistId,
      );

      if (matchedAnilistId) {
        const existing = animeByAnilistId.get(matchedAnilistId);
        if (existing) {
          existing.push(animeId);
        } else {
          animeByAnilistId.set(matchedAnilistId, [animeId]);
        }
      } else {
        needsSearch.push({ animeId: anime.id, title: anime.title });
      }
    }

    if (animeByAnilistId.size > 0) {
      const allAnilistIds = [...animeByAnilistId.keys()];
      const mediaResults = await this.franchiseAggregate.walkFranchiseGraph(allAnilistIds);
      await this.franchiseAggregate.resolveFranchises(mediaResults, animeByAnilistId);
    }

    const needsSearchByTitle = new Map<string, number>();
    for (const { animeId, title } of needsSearch) {
      needsSearchByTitle.set(title.toLowerCase(), animeId);
    }

    for (const { animeId, title } of needsSearch) {
      const anime = this.repository.getAnime(animeId);
      if (!anime || anime.franchiseId) continue;
      if (this.repository.hasAnimeTrackerMapping(animeId, "anilist")) continue;

      const searchResult = await this.provider.searchByTitle(title);
      if (!searchResult) continue;

      const existing = animeByAnilistId.get(searchResult.anilistId);
      if (existing) {
        existing.push(animeId);
      } else {
        animeByAnilistId.set(searchResult.anilistId, [animeId]);
      }

      const mediaResults = await this.franchiseAggregate.walkFranchiseGraph([
        searchResult.anilistId,
      ]);
      await this.franchiseAggregate.resolveFranchises(
        mediaResults,
        animeByAnilistId,
        needsSearchByTitle,
      );
    }
  }

  private findKnownAnilistId(
    animeId: number,
    title: string,
    animeIdToAnilistId: Map<number, string>,
    titleToAnilistId: Map<string, string>,
  ): string | null {
    return animeIdToAnilistId.get(animeId) ?? titleToAnilistId.get(title.toLowerCase()) ?? null;
  }

  buildFranchiseSets(anilistIds: string[]): Map<string, Set<string>> {
    return this.franchiseAggregate.buildFranchiseSets(anilistIds);
  }

  assignSeasonNumbers(clusterAnilistIds: string[]): Map<string, number | undefined> {
    return this.franchiseAggregate.assignSeasonNumbers(clusterAnilistIds);
  }
}
