import { describe, expect, test } from "bun:test";
import { createLibraryRepository, createMockFranchiseIndex } from "../fixtures";
import type { FranchiseCollection } from "../fribb/franchise-index";
import { FranchiseService } from "./franchise-service";

describe("FranchiseService", () => {
  describe("assignFranchise", () => {
    test("creates franchise from collection name when anime belongs to a Fribb collection", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "Mobile Suit Gundam", anidbId: "anidb-1" });

        await service.assignFranchise(anime);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Gundam");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("creates singleton franchise with anime canonical title when not in any collection", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "Unique Anime", anidbId: "anidb-unknown" });

        await service.assignFranchise(anime);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Unique Anime");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("joins existing franchise when another anime in same collection already has one", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime1 = repo.upsertAnime({ title: "Gundam Seed", anidbId: "anidb-1" });
        await service.assignFranchise(anime1);

        const anime2 = repo.upsertAnime({ title: "Gundam Seed Destiny", anidbId: "anidb-2" });
        await service.assignFranchise(anime2);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Gundam");

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).toBe(franchises[0]?.id);
        expect(updatedAnime2?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("skips assignment when anime already has a franchise", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const existingFranchise = repo.createFranchise({ title: "My Custom Franchise" });
        const anime = repo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        repo.assignAnimeToFranchise(anime.id, existingFranchise.id);

        const freshAnime = repo.getAnime(anime.id);
        if (!freshAnime) throw new Error("anime not found");
        await service.assignFranchise(freshAnime);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(existingFranchise.id);
      } finally {
        close();
      }
    });

    test("skips assignment when anime has no anidbId", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "No ID Anime" });

        await service.assignFranchise(anime);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        close();
      }
    });
  });

  describe("repairAll", () => {
    test("merges stale singletons into collection franchises", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime1 = repo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const anime2 = repo.upsertAnime({ title: "Gundam 00", anidbId: "anidb-2" });

        const singleton1 = repo.createFranchise({ title: "Gundam" });
        const singleton2 = repo.createFranchise({ title: "Gundam 00" });
        repo.assignAnimeToFranchise(anime1.id, singleton1.id);
        repo.assignAnimeToFranchise(anime2.id, singleton2.id);

        await service.repairAll();

        const franchises = repo.getFranchises();
        const gundamFranchise = franchises.find((f) => f.title === "Gundam");
        expect(gundamFranchise).toBeDefined();

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).toBe(gundamFranchise?.id);
        expect(updatedAnime2?.franchiseId).toBe(gundamFranchise?.id);
      } finally {
        close();
      }
    });

    test("cleans up orphan franchises after merging", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const orphanFranchise = repo.createFranchise({ title: "Old Singleton" });
        repo.assignAnimeToFranchise(anime.id, orphanFranchise.id);

        await service.repairAll();

        const franchises = repo.getFranchises();
        expect(franchises.find((f) => f.id === orphanFranchise.id)).toBeUndefined();
        expect(franchises.find((f) => f.title === "Gundam")).toBeDefined();
      } finally {
        close();
      }
    });

    test("does not touch anime already in correct collection franchise", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const correctFranchise = repo.createFranchise({ title: "Gundam" });
        repo.assignAnimeToFranchise(anime.id, correctFranchise.id);

        await service.repairAll();

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(correctFranchise.id);
      } finally {
        close();
      }
    });

    test("handles anime not in any collection (leaves as singleton)", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        const anime = repo.upsertAnime({ title: "Standalone", anidbId: "anidb-standalone" });
        const singleton = repo.createFranchise({ title: "Standalone" });
        repo.assignAnimeToFranchise(anime.id, singleton.id);

        await service.repairAll();

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(singleton.id);
      } finally {
        close();
      }
    });

    test("does nothing when no anime exist", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({ library: repo, franchiseIndex });

        await service.repairAll();

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        close();
      }
    });
  });
});
