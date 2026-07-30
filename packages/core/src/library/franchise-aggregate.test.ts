import { describe, expect, test } from "bun:test";
import type { EnrichmentMediaResult } from "./franchise-aggregate";
import { FranchiseAggregate, RELATION_TYPES_TO_WALK } from "./franchise-aggregate";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("FranchiseAggregate", () => {
  describe("walkFranchiseGraph", () => {
    test("fetches media details from cache for starting IDs", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(1);
        expect(result.get("1")?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("follows SEQUEL and PREQUEL relations", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [{ anilistId: "2", title: "Jujutsu Kaisen S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Jujutsu Kaisen S2",
          format: "TV",
          episodes: 23,
          relations: [{ anilistId: "1", title: "Jujutsu Kaisen", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(2);
        expect(result.has("1")).toBe(true);
        expect(result.has("2")).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("follows SIDE_STORY and PARENT relations", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "2", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "1", title: "One Piece", relationType: "PARENT" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("does not follow ADAPTATION relation", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [
            { anilistId: "2", title: "Jujutsu Kaisen Manga", relationType: "ADAPTATION" },
          ],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(1);
        expect(result.has("2")).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("returns empty map for uncached IDs", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("avoids infinite loops from circular relations", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "2", title: "Anime B", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Anime B",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Anime A", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const result = aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

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

    test("uses existing franchise when AniList ID matches", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const existingFranchise = repo.createFranchise({
          title: "Existing Franchise",
          anilistId: "1",
        });

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

    test("assigns season numbers to episode groups from SEQUEL chain", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Attack on Titan S2",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Attack on Titan", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime1 = repo.upsertAnime({ title: "Attack on Titan" });
        const anime2 = repo.upsertAnime({ title: "Attack on Titan S2" });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        const group2 = repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Attack on Titan S2",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Attack on Titan", relationType: "PREQUEL" }],
        });

        const animeByAnilistId = new Map<string, number[]>();
        animeByAnilistId.set("1", [anime1.id]);
        animeByAnilistId.set("2", [anime2.id]);

        aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const updatedGroup1 = repo.getEpisodeGroup(group1.id);
        const updatedGroup2 = repo.getEpisodeGroup(group2.id);
        expect(updatedGroup1?.seasonNumber).toBe(1);
        expect(updatedGroup2?.seasonNumber).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("does not mutate caller's animeByAnilistId map", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Anime A",
          format: "TV",
          episodes: 12,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

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

  describe("buildFranchiseSets", () => {
    test("returns franchise set for connected entries", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Attack on Titan S2",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Attack on Titan", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const sets = aggregate.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(2);
        expect(sets.get("1")).toEqual(new Set(["1", "2"]));
        expect(sets.get("2")).toEqual(new Set(["1", "2"]));
      } finally {
        sqlite.close();
      }
    });

    test("returns separate sets for disconnected entries", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Death Note",
          format: "TV",
          episodes: 37,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const sets = aggregate.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(2);
        expect(sets.get("1")).toEqual(new Set(["1"]));
        expect(sets.get("2")).toEqual(new Set(["2"]));
      } finally {
        sqlite.close();
      }
    });

    test("skips entries not in cache", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const sets = aggregate.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(1);
        expect(sets.get("1")).toEqual(new Set(["1"]));
        expect(sets.has("2")).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("only follows SEQUEL and PREQUEL relations", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "2", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "1", title: "One Piece", relationType: "PARENT" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const sets = aggregate.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(2);
        expect(sets.get("1")).toEqual(new Set(["1"]));
        expect(sets.get("2")).toEqual(new Set(["2"]));
      } finally {
        sqlite.close();
      }
    });
  });

  describe("assignSeasonNumbers", () => {
    test("assigns sequential season numbers following SEQUEL chain", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Attack on Titan S2",
          format: "TV",
          episodes: 12,
          relations: [
            { anilistId: "1", title: "Attack on Titan", relationType: "PREQUEL" },
            { anilistId: "3", title: "Attack on Titan S3", relationType: "SEQUEL" },
          ],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "3",
          title: "Attack on Titan S3",
          format: "TV",
          episodes: 22,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const seasonNumbers = aggregate.assignSeasonNumbers(["1", "2", "3"]);

        expect(seasonNumbers.get("1")).toBe(1);
        expect(seasonNumbers.get("2")).toBe(2);
        expect(seasonNumbers.get("3")).toBe(3);
      } finally {
        sqlite.close();
      }
    });

    test("finds root from any entry in chain", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Attack on Titan S2",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "1", title: "Attack on Titan", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const seasonNumbers = aggregate.assignSeasonNumbers(["2", "1"]);

        expect(seasonNumbers.get("1")).toBe(1);
        expect(seasonNumbers.get("2")).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("returns undefined for entries not in SEQUEL chain", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const seasonNumbers = aggregate.assignSeasonNumbers(["1"]);

        expect(seasonNumbers.get("1")).toBeUndefined();
      } finally {
        sqlite.close();
      }
    });

    test("handles empty cluster", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const seasonNumbers = aggregate.assignSeasonNumbers([]);
        expect(seasonNumbers.size).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("handles missing cache entries gracefully", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const seasonNumbers = aggregate.assignSeasonNumbers(["1"]);

        expect(seasonNumbers.get("1")).toBeUndefined();
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

  describe("enrichAnime", () => {
    test("creates franchise from known AniList entries", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "16498",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Attack on Titan",
        });

        const knownEntries = [{ anilistId: "16498", title: "Attack on Titan" }];
        aggregate.enrichAnime([anime.id], knownEntries);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();
        expect(franchise?.title).toBe("Attack on Titan");

        const mapping = repo.findAnimeSourceMapping("anilist", "16498");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that already has a franchise", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const franchise = repo.createFranchise({ title: "Existing Franchise" });
        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });
        repo.assignAnimeToFranchise(anime.id, franchise.id);

        aggregate.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Existing Franchise");
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that already has an AniList mapping", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "12345",
        });

        aggregate.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("walks relation graph and assigns related anime to same franchise", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [{ anilistId: "2", title: "Jujutsu Kaisen Season 2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });
        repo.setAnilistCacheEntry({
          anilistId: "2",
          title: "Jujutsu Kaisen Season 2",
          format: "TV",
          episodes: 23,
          relations: [{ anilistId: "1", title: "Jujutsu Kaisen", relationType: "PREQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime1 = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const anime2 = repo.upsertAnime({
          title: "Jujutsu Kaisen Season 2",
        });

        const knownEntries = [
          { anilistId: "1", title: "Jujutsu Kaisen" },
          { anilistId: "2", title: "Jujutsu Kaisen Season 2" },
        ];
        aggregate.enrichAnime([anime1.id, anime2.id], knownEntries);

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

    test("uses known AniList ID from group tracker mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "21",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "One Piece",
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "21",
        });

        aggregate.enrichAnime([anime.id]);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();

        const mapping = repo.findAnimeSourceMapping("anilist", "21");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates franchise for single anime with no relations", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const knownEntries = [{ anilistId: "1", title: "Jujutsu Kaisen" }];
        aggregate.enrichAnime([anime.id], knownEntries);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Jujutsu Kaisen");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime without known AniList ID", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        const anime = repo.upsertAnime({
          title: "Unknown Anime",
        });

        aggregate.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that does not exist", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({ library: repo });

        aggregate.enrichAnime([999]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });
});
