import type { EnrichmentMediaResult, EnrichmentProvider, KnownEntry } from "../types";
import type { LibraryAnime, LibraryRepository } from "./library-repository";

export const RELATION_TYPES_TO_WALK = new Set([
  "SEQUEL",
  "PREQUEL",
  "SIDE_STORY",
  "SUMMARY",
  "PARENT",
]);

export interface FranchiseAggregateDeps {
  library: LibraryRepository;
  provider: EnrichmentProvider;
}

export class FranchiseAggregate {
  constructor(private deps: FranchiseAggregateDeps) {}

  async walkFranchiseGraph(startAnilistIds: string[]): Promise<Map<string, EnrichmentMediaResult>> {
    const visited = new Map<string, EnrichmentMediaResult>();
    const failed = new Set<string>();
    const queue = [...startAnilistIds];

    while (queue.length > 0) {
      const currentBatch = queue.filter((id) => !visited.has(id) && !failed.has(id));
      if (currentBatch.length === 0) break;

      const uncachedIds = this.deps.library.getUncachedAnilistIds(currentBatch);
      if (uncachedIds.length > 0) {
        try {
          const results = await this.deps.provider.getMediaDetailsBatch(uncachedIds);
          for (const result of results) {
            this.deps.library.setAnilistCacheEntry({
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
        } catch {
          for (const id of uncachedIds) {
            failed.add(id);
          }
        }
      }

      for (const id of currentBatch) {
        if (visited.has(id)) continue;

        const cached = this.deps.library.getAnilistCacheEntry(id);
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

  async resolveFranchises(
    mediaResults: Map<string, EnrichmentMediaResult>,
    animeByAnilistId: Map<string, number[]>,
    needsSearchByTitle?: Map<string, number>,
  ): Promise<void> {
    if (mediaResults.size === 0) return;

    const components = this.findConnectedComponents(mediaResults);

    for (const [rootId, componentIds] of components) {
      const franchise =
        this.findExistingFranchise(componentIds) ??
        this.createFranchiseForComponent(rootId, componentIds, mediaResults, animeByAnilistId);

      this.assignComponentToFranchise(
        componentIds,
        franchise.id,
        animeByAnilistId,
        mediaResults,
        needsSearchByTitle,
      );
    }
  }

  buildFranchiseSets(anilistIds: string[]): Map<string, Set<string>> {
    const franchiseSets = new Map<string, Set<string>>();

    for (const id of anilistIds) {
      if (franchiseSets.has(id)) continue;

      const cached = this.deps.library.getAnilistCacheEntry(id);
      if (!cached) continue;

      const franchise = new Set<string>();
      const queue = [id];

      while (queue.length > 0) {
        const current = queue.pop();
        if (current === undefined || franchise.has(current)) continue;

        const currentCached = this.deps.library.getAnilistCacheEntry(current);
        if (!currentCached) continue;

        franchise.add(current);

        for (const relation of currentCached.relations) {
          if (
            (relation.relationType === "SEQUEL" || relation.relationType === "PREQUEL") &&
            !franchise.has(relation.anilistId)
          ) {
            queue.push(relation.anilistId);
          }
        }
      }

      for (const memberId of franchise) {
        franchiseSets.set(memberId, franchise);
      }
    }

    return franchiseSets;
  }

  assignSeasonNumbers(clusterAnilistIds: string[]): Map<string, number | undefined> {
    const seasonMap = new Map<string, number | undefined>();

    if (clusterAnilistIds.length === 0) return seasonMap;

    for (const id of clusterAnilistIds) {
      seasonMap.set(id, undefined);
    }

    const idSet = new Set(clusterAnilistIds);
    const firstId = clusterAnilistIds[0];
    if (firstId === undefined) return seasonMap;
    const root = this.findPrequelChainRoot(firstId, idSet);

    const rootCached = this.deps.library.getAnilistCacheEntry(root);
    const hasChain = rootCached?.relations.some(
      (r) => r.relationType === "SEQUEL" && idSet.has(r.anilistId),
    );

    if (!hasChain) return seasonMap;

    let season = 1;
    let current = root;
    const visited = new Set<string>();

    while (current && !visited.has(current) && idSet.has(current)) {
      visited.add(current);
      seasonMap.set(current, season);
      season++;

      const cached = this.deps.library.getAnilistCacheEntry(current);
      if (!cached) break;

      const sequelRel = cached.relations.find(
        (r) => r.relationType === "SEQUEL" && idSet.has(r.anilistId),
      );

      current = sequelRel?.anilistId ?? "";
    }

    return seasonMap;
  }

  async enrichAnime(animeIds: number[], knownAnilistEntries?: KnownEntry[]): Promise<void> {
    const needsSearch: Array<{ animeId: number; title: string }> = [];
    const animeByAnilistId = new Map<string, number[]>();

    const pushToMap = (key: string, value: number): void => {
      const existing = animeByAnilistId.get(key);
      if (existing) existing.push(value);
      else animeByAnilistId.set(key, [value]);
    };

    const knownFromGroups = this.deps.library.getKnownAnilistIds();
    const titleToAnilistId = new Map<string, string>();
    const animeIdToAnilistId = new Map<number, string>();

    for (const [anilistId, ids] of knownFromGroups) {
      for (const animeId of ids) {
        pushToMap(anilistId, animeId);
        animeIdToAnilistId.set(animeId, anilistId);
      }
    }

    if (knownAnilistEntries) {
      for (const entry of knownAnilistEntries) {
        titleToAnilistId.set(entry.title.toLowerCase(), entry.anilistId);
      }
    }

    for (const animeId of animeIds) {
      const anime = this.deps.library.getAnime(animeId);
      if (!anime) continue;
      if (anime.franchiseId) continue;
      if (this.deps.library.hasAnimeSourceMapping(animeId, "anilist")) continue;

      const matchedAnilistId =
        animeIdToAnilistId.get(animeId) ?? titleToAnilistId.get(anime.title.toLowerCase()) ?? null;

      if (matchedAnilistId) {
        pushToMap(matchedAnilistId, animeId);
      } else {
        needsSearch.push({ animeId: anime.id, title: anime.title });
      }
    }

    if (animeByAnilistId.size > 0) {
      const allAnilistIds = [...animeByAnilistId.keys()];
      const mediaResults = await this.walkFranchiseGraph(allAnilistIds);
      await this.resolveFranchises(mediaResults, animeByAnilistId);
    }

    const needsSearchByTitle = new Map<string, number>();
    for (const { animeId, title } of needsSearch) {
      needsSearchByTitle.set(title.toLowerCase(), animeId);
    }

    for (const { animeId, title } of needsSearch) {
      const anime = this.deps.library.getAnime(animeId);
      if (!anime || anime.franchiseId) continue;
      if (this.deps.library.hasAnimeSourceMapping(animeId, "anilist")) continue;

      const searchResult = await this.deps.provider.searchByTitle(title);
      if (!searchResult) continue;

      pushToMap(searchResult.anilistId, animeId);

      const mediaResults = await this.walkFranchiseGraph([searchResult.anilistId]);
      await this.resolveFranchises(mediaResults, animeByAnilistId, needsSearchByTitle);
    }
  }

  private findPrequelChainRoot(startId: string, idSet: Set<string>): string {
    let current = startId;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);

      const cached = this.deps.library.getAnilistCacheEntry(current);
      if (!cached) break;

      const prequelRel = cached.relations.find(
        (r) => r.relationType === "PREQUEL" && idSet.has(r.anilistId),
      );

      if (!prequelRel) break;
      current = prequelRel.anilistId;
    }

    return current;
  }

  private findAnimeByAnilistId(anilistId: string): LibraryAnime | null {
    const mapping = this.deps.library.findAnimeSourceMapping("anilist", anilistId);
    if (mapping) {
      return this.deps.library.getAnime(mapping.animeId);
    }
    return null;
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

  private findExistingFranchise(componentIds: string[]): { id: number } | null {
    for (const id of componentIds) {
      const byAnilist = this.deps.library.findFranchiseByAnilistId(id);
      if (byAnilist) return byAnilist;

      const mapping = this.deps.library.findAnimeSourceMapping("anilist", id);
      if (mapping) {
        const anime = this.deps.library.getAnime(mapping.animeId);
        if (anime?.franchiseId) {
          const franchise = this.deps.library.getFranchiseById(anime.franchiseId);
          if (franchise) return franchise;
        }
      }
    }
    return null;
  }

  private createFranchiseForComponent(
    rootId: string,
    componentIds: string[],
    mediaResults: Map<string, EnrichmentMediaResult>,
    animeByAnilistId: Map<string, number[]>,
  ): { id: number } {
    const title = this.resolveFranchiseTitle(rootId, componentIds, mediaResults, animeByAnilistId);
    return this.deps.library.createFranchise({ title, anilistId: rootId });
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
    mediaResults: Map<string, EnrichmentMediaResult>,
    needsSearchByTitle?: Map<string, number>,
  ): void {
    for (const id of componentIds) {
      for (const animeId of animeByAnilistId.get(id) ?? []) {
        this.ensureMappingAndAssign(animeId, id, franchiseId);
      }

      const existingAnime = this.findAnimeByAnilistId(id);
      if (existingAnime) {
        this.ensureMappingAndAssign(existingAnime.id, id, franchiseId);
      }

      if (needsSearchByTitle) {
        const media = mediaResults.get(id);
        const matchAnimeId = media ? needsSearchByTitle.get(media.title.toLowerCase()) : undefined;
        if (matchAnimeId !== undefined) {
          this.ensureMappingAndAssign(matchAnimeId, id, franchiseId);
        }
      }
    }
  }
}
