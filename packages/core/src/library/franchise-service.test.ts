import { describe, expect, test } from "bun:test";
import { createLibraryRepositories, createMockFranchiseIndex } from "../fixtures";
import type { FranchiseCollection } from "../fribb/franchise-index";
import { FranchiseService } from "./franchise-service";

describe("FranchiseService", () => {
  describe("assignFranchise", () => {
    test("creates franchise from collection name when anime belongs to a Fribb collection", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "Mobile Suit Gundam", anidbId: "anidb-1" });

        await service.assignFranchise(anime);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Gundam");

        const updatedAnime = animeRepo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("creates singleton franchise with anime canonical title when not in any collection", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "Unique Anime", anidbId: "anidb-unknown" });

        await service.assignFranchise(anime);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Unique Anime");

        const updatedAnime = animeRepo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("joins existing franchise when another anime in same collection already has one", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime1 = animeRepo.upsertAnime({ title: "Gundam Seed", anidbId: "anidb-1" });
        await service.assignFranchise(anime1);

        const anime2 = animeRepo.upsertAnime({ title: "Gundam Seed Destiny", anidbId: "anidb-2" });
        await service.assignFranchise(anime2);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Gundam");

        const updatedAnime1 = animeRepo.getAnime(anime1.id);
        const updatedAnime2 = animeRepo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).toBe(franchises[0]?.id);
        expect(updatedAnime2?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        close();
      }
    });

    test("skips assignment when anime already has a franchise", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const existingFranchise = franchiseRepo.createFranchise({ title: "My Custom Franchise" });
        const anime = animeRepo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        franchiseRepo.assignAnimeToFranchise(anime.id, existingFranchise.id);

        const freshAnime = animeRepo.getAnime(anime.id);
        if (!freshAnime) throw new Error("anime not found");
        await service.assignFranchise(freshAnime);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(existingFranchise.id);
      } finally {
        close();
      }
    });

    test("skips assignment when anime has no anidbId", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "No ID Anime" });

        await service.assignFranchise(anime);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        close();
      }
    });
  });

  describe("repairAll", () => {
    test("merges stale singletons into collection franchises", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1", "anidb-2"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime1 = animeRepo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const anime2 = animeRepo.upsertAnime({ title: "Gundam 00", anidbId: "anidb-2" });

        const singleton1 = franchiseRepo.createFranchise({ title: "Gundam" });
        const singleton2 = franchiseRepo.createFranchise({ title: "Gundam 00" });
        franchiseRepo.assignAnimeToFranchise(anime1.id, singleton1.id);
        franchiseRepo.assignAnimeToFranchise(anime2.id, singleton2.id);

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        const gundamFranchise = franchises.find((f) => f.title === "Gundam");
        expect(gundamFranchise).toBeDefined();

        const updatedAnime1 = animeRepo.getAnime(anime1.id);
        const updatedAnime2 = animeRepo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).toBe(gundamFranchise?.id);
        expect(updatedAnime2?.franchiseId).toBe(gundamFranchise?.id);
      } finally {
        close();
      }
    });

    test("cleans up orphan franchises after merging", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const orphanFranchise = franchiseRepo.createFranchise({ title: "Old Singleton" });
        franchiseRepo.assignAnimeToFranchise(anime.id, orphanFranchise.id);

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.find((f) => f.id === orphanFranchise.id)).toBeUndefined();
        expect(franchises.find((f) => f.title === "Gundam")).toBeDefined();
      } finally {
        close();
      }
    });

    test("does not touch anime already in correct collection franchise", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "anidb-1",
          franchiseTitle: "Gundam",
          members: ["anidb-1"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "Gundam", anidbId: "anidb-1" });
        const correctFranchise = franchiseRepo.createFranchise({ title: "Gundam" });
        franchiseRepo.assignAnimeToFranchise(anime.id, correctFranchise.id);

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(correctFranchise.id);
      } finally {
        close();
      }
    });

    test("leaves anime not in any collection as singleton", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime = animeRepo.upsertAnime({ title: "Standalone", anidbId: "anidb-standalone" });
        const singleton = franchiseRepo.createFranchise({ title: "Standalone" });
        franchiseRepo.assignAnimeToFranchise(anime.id, singleton.id);

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(singleton.id);
      } finally {
        close();
      }
    });

    test("does nothing when no anime exist", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const franchiseIndex = createMockFranchiseIndex([]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        close();
      }
    });

    test("merges incorrectly assigned seasons into correct franchise", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const collection: FranchiseCollection = {
          anidbId: "11395",
          franchiseTitle: "3-gatsu no Lion",
          members: ["11395", "11606", "12994"],
        };
        const franchiseIndex = createMockFranchiseIndex([collection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime1 = animeRepo.upsertAnime({ title: "3-gatsu no Lion", anidbId: "11395" });
        const anime2 = animeRepo.upsertAnime({
          title: "3-gatsu no Lion 2nd Season",
          anidbId: "11606",
        });
        const anime3 = animeRepo.upsertAnime({
          title: "3-gatsu no Lion 2nd Season Part 2",
          anidbId: "12994",
        });

        const wrongFranchise1 = franchiseRepo.createFranchise({ title: "Flanders no Inu (Movie)" });
        const wrongFranchise2 = franchiseRepo.createFranchise({ title: "Wrong Franchise" });
        franchiseRepo.assignAnimeToFranchise(anime1.id, wrongFranchise1.id);
        franchiseRepo.assignAnimeToFranchise(anime2.id, wrongFranchise2.id);

        await service.repairAll();

        const franchises = franchiseRepo.getFranchises();
        const correctFranchise = franchises.find((f) => f.title === "3-gatsu no Lion");
        expect(correctFranchise).toBeDefined();

        expect(animeRepo.getAnime(anime1.id)?.franchiseId).toBe(correctFranchise?.id);
        expect(animeRepo.getAnime(anime2.id)?.franchiseId).toBe(correctFranchise?.id);
        expect(animeRepo.getAnime(anime3.id)?.franchiseId).toBe(correctFranchise?.id);

        const wrongFranchises = franchises.filter(
          (f) => f.title === "Flanders no Inu (Movie)" || f.title === "Wrong Franchise",
        );
        expect(wrongFranchises.length).toBe(0);
      } finally {
        close();
      }
    });

    test("keeps different franchises separate", async () => {
      const { animeRepo, franchiseRepo, close } = createLibraryRepositories();
      try {
        const lionCollection: FranchiseCollection = {
          anidbId: "11395",
          franchiseTitle: "3-gatsu no Lion",
          members: ["11395", "11606"],
        };
        const ajinCollection: FranchiseCollection = {
          anidbId: "11265",
          franchiseTitle: "Ajin",
          members: ["11265", "11577"],
        };
        const franchiseIndex = createMockFranchiseIndex([lionCollection, ajinCollection]);
        const service = new FranchiseService({
          anime: animeRepo,
          franchises: franchiseRepo,
          franchiseIndex,
        });

        const anime1 = animeRepo.upsertAnime({ title: "3-gatsu no Lion", anidbId: "11395" });
        const anime2 = animeRepo.upsertAnime({ title: "Ajin", anidbId: "11265" });

        await service.assignFranchise(anime1);
        await service.assignFranchise(anime2);

        const franchises = franchiseRepo.getFranchises();
        expect(franchises.length).toBe(2);

        const lion = franchises.find((f) => f.title === "3-gatsu no Lion");
        const ajin = franchises.find((f) => f.title === "Ajin");
        expect(lion).toBeDefined();
        expect(ajin).toBeDefined();

        expect(animeRepo.getAnime(anime1.id)?.franchiseId).toBe(lion?.id);
        expect(animeRepo.getAnime(anime2.id)?.franchiseId).toBe(ajin?.id);
      } finally {
        close();
      }
    });
  });
});
