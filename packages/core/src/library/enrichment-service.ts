import type { EnrichmentMediaResult, EnrichmentProvider } from "../types";
import type { LibraryAnime, LibraryRepository } from "./library-repository";

const RELATION_TYPES_TO_WALK = new Set(["SEQUEL", "PREQUEL", "SIDE_STORY", "SUMMARY", "PARENT"]);

export class EnrichmentService {
  constructor(
    private repository: LibraryRepository,
    private provider: EnrichmentProvider,
  ) {}

  async enrichAnime(animeIds: number[]): Promise<void> {
    for (const animeId of animeIds) {
      const anime = this.repository.getAnime(animeId);
      if (!anime) continue;

      if (anime.franchiseId) continue;

      const hasMapping = this.repository.hasAnimeTrackerMapping(animeId, "anilist");
      if (hasMapping) continue;

      const searchResult = await this.provider.searchByTitle(anime.title);
      if (!searchResult) continue;

      const mediaResults = await this.walkFranchiseGraph(searchResult.anilistId);

      await this.resolveFranchise(anime.id, mediaResults);
    }
  }

  private async walkFranchiseGraph(
    startAnilistId: string,
  ): Promise<Map<string, EnrichmentMediaResult>> {
    const visited = new Map<string, EnrichmentMediaResult>();
    const queue = [startAnilistId];

    while (queue.length > 0) {
      const currentBatch = queue.filter((id) => !visited.has(id));
      if (currentBatch.length === 0) break;

      const uncachedIds = this.repository.getUncachedAnilistIds(currentBatch);
      if (uncachedIds.length > 0) {
        const results = await this.provider.getMediaDetailsBatch(uncachedIds);
        for (const result of results) {
          this.repository.setAnilistCacheEntry({
            anilistId: result.anilistId,
            title: result.title,
            format: result.format ?? null,
            episodes: result.episodes ?? null,
            relations: result.relations,
            externalLinks: result.externalLinks ?? null,
            fetchedAt: new Date().toISOString(),
          });
          visited.set(result.anilistId, result);
        }
      }

      for (const id of currentBatch) {
        if (visited.has(id)) continue;

        const cached = this.repository.getAnilistCacheEntry(id);
        if (cached) {
          visited.set(id, {
            anilistId: cached.anilistId,
            title: cached.title,
            format: cached.format ?? undefined,
            episodes: cached.episodes ?? undefined,
            relations: cached.relations,
            externalLinks: cached.externalLinks ?? undefined,
          });
        }
      }

      for (const id of currentBatch) {
        const media = visited.get(id);
        if (!media) continue;

        for (const relation of media.relations) {
          if (
            RELATION_TYPES_TO_WALK.has(relation.relationType) &&
            !visited.has(relation.anilistId)
          ) {
            queue.push(relation.anilistId);
          }
        }
      }
    }

    return visited;
  }

  private async resolveFranchise(
    animeId: number,
    mediaResults: Map<string, EnrichmentMediaResult>,
  ): Promise<void> {
    if (mediaResults.size === 0) return;

    const rootMedia = mediaResults.values().next().value;
    if (!rootMedia) return;

    let franchise = this.repository.findFranchiseByAnilistId(rootMedia.anilistId);
    if (!franchise) {
      for (const [anilistId] of mediaResults) {
        franchise = this.repository.findFranchiseByAnilistId(anilistId);
        if (franchise) break;

        const existingMapping = this.repository.findAnimeByTrackerMapping("anilist", anilistId);
        if (existingMapping) {
          const existingAnime = this.repository.getAnime(existingMapping.animeId);
          if (existingAnime?.franchiseId) {
            franchise = this.repository.getFranchiseById(existingAnime.franchiseId);
            if (franchise) break;
          }
        }
      }
    }

    if (!franchise) {
      const anime = this.repository.getAnime(animeId);
      franchise = this.repository.createFranchise({
        title: anime?.title ?? rootMedia.title,
        anilistId: rootMedia.anilistId,
      });
    }

    const hasMapping = this.repository.hasAnimeTrackerMapping(animeId, "anilist");
    if (!hasMapping) {
      this.repository.createAnimeTrackerMapping({
        animeId,
        source: "anilist",
        externalId: rootMedia.anilistId,
      });
    }

    this.repository.assignAnimeToFranchise(animeId, franchise.id);

    for (const [anilistId] of mediaResults) {
      if (anilistId === rootMedia.anilistId) continue;

      const existingAnime = this.findAnimeByAnilistId(anilistId);
      if (existingAnime) {
        const hasAnimeMapping = this.repository.hasAnimeTrackerMapping(existingAnime.id, "anilist");
        if (!hasAnimeMapping) {
          this.repository.createAnimeTrackerMapping({
            animeId: existingAnime.id,
            source: "anilist",
            externalId: anilistId,
          });
        }
        this.repository.assignAnimeToFranchise(existingAnime.id, franchise.id);
      }
    }
  }

  private findAnimeByAnilistId(anilistId: string): LibraryAnime | null {
    const mapping = this.repository.findAnimeByTrackerMapping("anilist", anilistId);
    if (mapping) {
      return this.repository.getAnime(mapping.animeId);
    }
    return null;
  }
}
