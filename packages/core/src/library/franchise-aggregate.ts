import type { EnrichmentRelation, KnownEntry } from "../types";
import type { LibraryRepository } from "./library-repository";

export interface EnrichmentMediaResult {
  anilistId: string;
  title: string;
  format?: string;
  episodes?: number;
  relations: EnrichmentRelation[];
  externalLinks?: { site: string; id: string }[];
}

export const RELATION_TYPES_TO_WALK = new Set([
  "SEQUEL",
  "PREQUEL",
  "SIDE_STORY",
  "SUMMARY",
  "PARENT",
]);

export interface FranchiseAggregateDeps {
  library: LibraryRepository;
}

export class FranchiseAggregate {
  constructor(private deps: FranchiseAggregateDeps) {}

  findConnectedComponents(mediaResults: Map<string, EnrichmentMediaResult>): Map<string, string[]> {
    const visited = new Set<string>();
    const components = new Map<string, string[]>();

    for (const [startId] of mediaResults) {
      if (visited.has(startId)) continue;

      const component: string[] = [];
      const queue = [startId];
      let qi = 0;

      while (qi < queue.length) {
        const current = queue[qi++];
        if (!current || visited.has(current)) continue;

        visited.add(current);
        component.push(current);

        const media = mediaResults.get(current);
        if (!media) continue;

        for (const relation of media.relations) {
          if (
            RELATION_TYPES_TO_WALK.has(relation.relationType) &&
            mediaResults.has(relation.anilistId) &&
            !visited.has(relation.anilistId)
          ) {
            queue.push(relation.anilistId);
          }
        }
      }

      components.set(startId, component);
    }

    return components;
  }

  resolveFranchises(
    mediaResults: Map<string, EnrichmentMediaResult>,
    animeByAnilistId: Map<string, number[]>,
  ): void {
    if (mediaResults.size === 0) return;

    const components = this.findConnectedComponents(mediaResults);

    for (const [rootId, componentIds] of components) {
      const franchise =
        this.findExistingFranchise(componentIds, animeByAnilistId) ??
        this.createFranchiseForComponent(rootId, componentIds, mediaResults, animeByAnilistId);

      this.assignComponentToFranchise(componentIds, franchise.id, animeByAnilistId);
    }
  }

  enrichAnime(_animeIds: number[], _knownAnilistEntries?: KnownEntry[]): void {
    // Stubbed out — previously depended on anilist_cache which has been removed.
  }

  private ensureMappingAndAssign(animeId: number, anilistId: string, franchiseId: number): void {
    if (!this.deps.library.hasAnimeSourceMapping(animeId, "anilist")) {
      this.deps.library.createAnimeSourceMapping({
        animeId,
        source: "anilist",
        externalId: anilistId,
      });
    }
    this.deps.library.assignAnimeToFranchise(animeId, franchiseId);
  }

  private findExistingFranchise(
    componentIds: string[],
    animeByAnilistId: Map<string, number[]>,
  ): { id: number } | null {
    for (const id of componentIds) {
      const animeIds = this.collectAnimeIdsForAnilistId(id, animeByAnilistId);
      for (const animeId of animeIds) {
        const anime = this.deps.library.getAnime(animeId);
        if (anime?.franchiseId) {
          const franchise = this.deps.library.getFranchiseById(anime.franchiseId);
          if (franchise) return franchise;
        }
      }
    }
    return null;
  }

  private collectAnimeIdsForAnilistId(
    anilistId: string,
    animeByAnilistId: Map<string, number[]>,
  ): number[] {
    const ids = new Set<number>(animeByAnilistId.get(anilistId) ?? []);
    const mapping = this.deps.library.findAnimeSourceMapping("anilist", anilistId);
    if (mapping) ids.add(mapping.animeId);
    return [...ids];
  }

  private createFranchiseForComponent(
    rootId: string,
    componentIds: string[],
    mediaResults: Map<string, EnrichmentMediaResult>,
    animeByAnilistId: Map<string, number[]>,
  ): { id: number } {
    const title = this.resolveFranchiseTitle(rootId, componentIds, mediaResults, animeByAnilistId);
    return this.deps.library.createFranchise({ title });
  }

  private resolveFranchiseTitle(
    rootId: string,
    componentIds: string[],
    mediaResults: Map<string, EnrichmentMediaResult>,
    animeByAnilistId: Map<string, number[]>,
  ): string {
    for (const id of componentIds) {
      const animeIds = animeByAnilistId.get(id) ?? [];
      for (const animeId of animeIds) {
        const anime = this.deps.library.getAnime(animeId);
        if (anime) return anime.title;
      }
    }
    return mediaResults.get(rootId)?.title ?? rootId;
  }

  private assignComponentToFranchise(
    componentIds: string[],
    franchiseId: number,
    animeByAnilistId: Map<string, number[]>,
  ): void {
    for (const id of componentIds) {
      const animeIds = this.collectAnimeIdsForAnilistId(id, animeByAnilistId);
      for (const animeId of animeIds) {
        this.ensureMappingAndAssign(animeId, id, franchiseId);
      }
    }
  }
}
