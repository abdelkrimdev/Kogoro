import { describe, expect, test } from "bun:test";
import { AnimeRepository } from "./anime-repository";
import { FranchiseRepository } from "./franchise-repository";
import { createLibraryDb } from "./test-utils";

describe("FranchiseRepository", () => {
  describe("createFranchise", () => {
    test("creates franchise and returns it with generated id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const franchise = repo.createFranchise({ title: "Gundam" });

        expect(franchise.id).toBeGreaterThan(0);
        expect(franchise.title).toBe("Gundam");
        expect(franchise.coverArtPath).toBeNull();
        expect(franchise.synopsis).toBeNull();
        expect(franchise.createdAt).toBeTruthy();
        expect(franchise.updatedAt).toBeTruthy();
      } finally {
        sqlite.close();
      }
    });

    test("creates franchise with optional fields", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const franchise = repo.createFranchise({
          title: "Evangelion",
          coverArtPath: "/covers/eva.jpg",
          synopsis: "Neon Genesis Evangelion franchise",
        });

        expect(franchise.title).toBe("Evangelion");
        expect(franchise.coverArtPath).toBe("/covers/eva.jpg");
        expect(franchise.synopsis).toBe("Neon Genesis Evangelion franchise");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getFranchiseById", () => {
    test("retrieves franchise by id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const created = repo.createFranchise({ title: "Gundam" });

        const retrieved = repo.getFranchiseById(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Gundam");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        expect(repo.getFranchiseById(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getFranchises", () => {
    test("returns all franchises sorted by title", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        repo.createFranchise({ title: "Z Franchise" });
        repo.createFranchise({ title: "A Franchise" });

        const list = repo.getFranchises();
        expect(list).toHaveLength(2);
        expect(list[0]?.title).toBe("A Franchise");
        expect(list[1]?.title).toBe("Z Franchise");
      } finally {
        sqlite.close();
      }
    });

    test("returns empty array when no franchises exist", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        expect(repo.getFranchises()).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findFranchiseByTitle", () => {
    test("finds franchise by exact title", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const created = repo.createFranchise({ title: "Gundam" });

        const found = repo.findFranchiseByTitle("Gundam");
        expect(found?.id).toBe(created.id);

        const notFound = repo.findFranchiseByTitle("Evangelion");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteFranchise", () => {
    test("removes franchise", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const created = repo.createFranchise({ title: "Gundam" });

        repo.deleteFranchise(created.id);
        expect(repo.getFranchiseById(created.id)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("assignAnimeToFranchise", () => {
    test("assigns anime to franchise", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const franchise = repo.createFranchise({ title: "Gundam" });

        const animeRepo = new AnimeRepository({ db });
        const anime = animeRepo.upsertAnime({ title: "Gundam Seed" });

        repo.assignAnimeToFranchise(anime.id, franchise.id);

        const updated = animeRepo.getAnime(anime.id);
        expect(updated?.franchiseId).toBe(franchise.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("countAnimeByFranchiseId", () => {
    test("counts anime in franchise", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const franchise = repo.createFranchise({ title: "Gundam" });

        const animeRepo = new AnimeRepository({ db });
        const anime1 = animeRepo.upsertAnime({ title: "Gundam Seed" });
        const anime2 = animeRepo.upsertAnime({ title: "Gundam Wing" });

        repo.assignAnimeToFranchise(anime1.id, franchise.id);
        repo.assignAnimeToFranchise(anime2.id, franchise.id);

        expect(repo.countAnimeByFranchiseId(franchise.id)).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("returns 0 for franchise with no anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new FranchiseRepository({ db });
        const franchise = repo.createFranchise({ title: "Empty" });
        expect(repo.countAnimeByFranchiseId(franchise.id)).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });
});
