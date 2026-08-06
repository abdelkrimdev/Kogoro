import type { FranchiseIndex } from "../fribb/franchise-index";
import type { AnimeRepository, LibraryAnime } from "./anime-repository";
import type { Franchise, FranchiseRepository } from "./franchise-repository";

export interface FranchiseServiceDeps {
  anime: AnimeRepository;
  franchises: FranchiseRepository;
  franchiseIndex: FranchiseIndex;
}

export class FranchiseService {
  constructor(private deps: FranchiseServiceDeps) {}

  async assignFranchise(anime: LibraryAnime): Promise<void> {
    if (anime.franchiseId) return;
    if (!anime.anidbId) return;

    const collection = await this.deps.franchiseIndex.getCollectionForAnidb(anime.anidbId);

    if (collection) {
      const franchise = await this.findOrCreateFranchiseByTitle(collection.franchiseTitle);
      this.deps.franchises.assignAnimeToFranchise(anime.id, franchise.id);
      return;
    }

    const franchise = await this.findOrCreateFranchiseByTitle(anime.title);
    this.deps.franchises.assignAnimeToFranchise(anime.id, franchise.id);
  }

  async repairAll(): Promise<void> {
    const allCollections = await this.deps.franchiseIndex.getAllCollections();
    const collectionByAnidb = new Map<string, string>();
    for (const collection of allCollections) {
      collectionByAnidb.set(collection.anidbId, collection.franchiseTitle);
      for (const member of collection.members) {
        collectionByAnidb.set(member, collection.franchiseTitle);
      }
    }

    const allAnime = this.deps.anime.listAnime();
    const franchiseIdsToReassign = new Set<number>();

    for (const anime of allAnime) {
      if (!anime.anidbId) continue;

      const franchiseTitle = collectionByAnidb.get(anime.anidbId);
      if (!franchiseTitle) continue;

      if (!anime.franchiseId) {
        const targetFranchise = await this.findOrCreateFranchiseByTitle(franchiseTitle);
        this.deps.franchises.assignAnimeToFranchise(anime.id, targetFranchise.id);
        continue;
      }

      const currentFranchise = this.deps.franchises.getFranchiseById(anime.franchiseId);
      if (!currentFranchise) continue;
      if (currentFranchise.title === franchiseTitle) continue;

      const targetFranchise = await this.findOrCreateFranchiseByTitle(franchiseTitle);
      this.deps.franchises.assignAnimeToFranchise(anime.id, targetFranchise.id);
      franchiseIdsToReassign.add(anime.franchiseId);
    }

    for (const franchiseId of franchiseIdsToReassign) {
      if (this.deps.franchises.countAnimeByFranchiseId(franchiseId) === 0) {
        this.deps.franchises.deleteFranchise(franchiseId);
      }
    }
  }

  private async findOrCreateFranchiseByTitle(title: string): Promise<Franchise> {
    const existing = this.deps.franchises.findFranchiseByTitle(title);
    if (existing) return existing;
    return this.deps.franchises.createFranchise({ title });
  }
}
