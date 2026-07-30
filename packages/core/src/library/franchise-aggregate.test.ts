import { describe, expect, test } from "bun:test";
import type { EnrichmentMediaResult } from "./franchise-aggregate";
import { FranchiseAggregate, RELATION_TYPES_TO_WALK } from "./franchise-aggregate";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("FranchiseAggregate", () => {
  describe("findConnectedComponents", () => {
    test("finds single connected component", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "2", title: "Anime B", relationType: "SEQUEL" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Anime B",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Anime A", relationType: "PREQUEL" }],
        });

        const components = aggregate.findConnectedComponents(mediaResults);

        expect(components.size).toBe(1);
        const component = components.get("1");
        expect(component).toContain("1");
        expect(component).toContain("2");
      } finally {
        sqlite.close();
      }
    });

    test("finds multiple disconnected components", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Anime B",
          format: "TV",
          episodes: 12,
          relations: [],
        });

        const components = aggregate.findConnectedComponents(mediaResults);

        expect(components.size).toBe(2);
        expect(components.get("1")).toEqual(["1"]);
        expect(components.get("2")).toEqual(["2"]);
      } finally {
        sqlite.close();
      }
    });

    test("respects relation type filtering", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "2", title: "Anime B", relationType: "ADAPTATION" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Anime B",
          format: "TV",
          episodes: 12,
          relations: [],
        });

        const components = aggregate.findConnectedComponents(mediaResults);

        expect(components.size).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("resolveFranchises", () => {
    test("creates franchise for single anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Jujutsu Kaisen");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates franchise for connected component", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime1 = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const anime2 = repo.upsertAnime({
          title: "Jujutsu Kaisen S2",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [{ anilistId: "2", title: "Jujutsu Kaisen S2", relationType: "SEQUEL" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Jujutsu Kaisen S2",
          format: "TV",
          episodes: 23,
          relations: [{ anilistId: "1", title: "Jujutsu Kaisen", relationType: "PREQUEL" }],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime1.id]);
        animeByAnilistId.set("2", [anime2.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).toBe(franchises[0]?.id);
        expect(updatedAnime2?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates separate franchises for disconnected components", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime1 = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const anime2 = repo.upsertAnime({
          title: "One Piece",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime1.id]);
        animeByAnilistId.set("2", [anime2.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(2);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).not.toBe(updatedAnime2?.franchiseId);
      } finally {
        sqlite.close();
      }
    });

    test("reuses existing franchise when anime already has one", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const existingFranchise = repo.createFranchise({
          title: "Existing Franchise",
        });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });
        repo.assignAnimeToFranchise(anime.id, existingFranchise.id);

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(existingFranchise.id);

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(existingFranchise.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates tracker mappings for assigned anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const mapping = repo.findAnimeSourceMapping("anilist", "1");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("uses anime title as franchise title when available", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "My Custom Title",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "AniList Title",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises[0]?.title).toBe("My Custom Title");
      } finally {
        sqlite.close();
      }
    });

    test("handles empty media results", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        const animeByAnilistId = new Map<string, number[]>();

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("does not mutate caller's animeByAnilistId map", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({ title: "Anime A" });
        repo.createAnimeSourceMapping({ animeId: anime.id, source: "anilist", externalId: "1" });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [],
        });

        const animeByAnilistId = new Map<string, number[]>();
        const originalIds: number[] = [];
        animeByAnilistId.set("1", originalIds);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        expect(originalIds).toEqual([]);
        expect(animeByAnilistId.get("1")).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("RELATION_TYPES_TO_WALK", () => {
    test("includes SEQUEL", () => {
      expect(RELATION_TYPES_TO_WALK.has("SEQUEL")).toBe(true);
    });

    test("includes PREQUEL", () => {
      expect(RELATION_TYPES_TO_WALK.has("PREQUEL")).toBe(true);
    });

    test("includes SIDE_STORY", () => {
      expect(RELATION_TYPES_TO_WALK.has("SIDE_STORY")).toBe(true);
    });

    test("includes SUMMARY", () => {
      expect(RELATION_TYPES_TO_WALK.has("SUMMARY")).toBe(true);
    });

    test("includes PARENT", () => {
      expect(RELATION_TYPES_TO_WALK.has("PARENT")).toBe(true);
    });

    test("does not include ADAPTATION", () => {
      expect(RELATION_TYPES_TO_WALK.has("ADAPTATION")).toBe(false);
    });

    test("does not include CHARACTER", () => {
      expect(RELATION_TYPES_TO_WALK.has("CHARACTER")).toBe(false);
    });
  });
});
