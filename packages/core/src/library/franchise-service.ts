import type { FranchiseIndex } from "../fribb/franchise-index";
import type { Franchise, LibraryAnime, LibraryRepository } from "./library-repository";

export interface FranchiseServiceDeps {
  library: LibraryRepository;
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
      this.deps.library.assignAnimeToFranchise(anime.id, franchise.id);
      return;
    }

    const franchise = await this.findOrCreateFranchiseByTitle(anime.title);
    this.deps.library.assignAnimeToFranchise(anime.id, franchise.id);
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

    const allAnime = this.deps.library.listAnime();
    const franchiseIdsToReassign = new Set<number>();

    for (const anime of allAnime) {
      if (!anime.anidbId) continue;

      const franchiseTitle = collectionByAnidb.get(anime.anidbId);
      if (!franchiseTitle) continue;

      if (!anime.franchiseId) {
        const targetFranchise = await this.findOrCreateFranchiseByTitle(franchiseTitle);
        this.deps.library.assignAnimeToFranchise(anime.id, targetFranchise.id);
        continue;
      }

      const currentFranchise = this.deps.library.getFranchiseById(anime.franchiseId);
      if (!currentFranchise) continue;
      if (currentFranchise.title === franchiseTitle) continue;

      const targetFranchise = await this.findOrCreateFranchiseByTitle(franchiseTitle);
      this.deps.library.assignAnimeToFranchise(anime.id, targetFranchise.id);
      franchiseIdsToReassign.add(anime.franchiseId);
    }

    for (const franchiseId of franchiseIdsToReassign) {
      if (this.deps.library.countAnimeByFranchiseId(franchiseId) === 0) {
        this.deps.library.deleteFranchise(franchiseId);
      }
    }
  }

  private async findOrCreateFranchiseByTitle(title: string): Promise<Franchise> {
    const existing = this.deps.library.findFranchiseByTitle(title);
    if (existing) return existing;
    return this.deps.library.createFranchise({ title });
  }
}
