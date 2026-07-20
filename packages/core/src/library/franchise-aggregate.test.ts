import { describe, expect, test } from "bun:test";
import type { EnrichmentMediaResult } from "../types";
import { FranchiseAggregate, RELATION_TYPES_TO_WALK } from "./franchise-aggregate";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

function createMockProvider(mediaResults: Map<string, EnrichmentMediaResult>) {
  return {
    async searchByTitle(title: string) {
      return { anilistId: "1", title, format: "TV", episodes: 12 };
    },
    async getMediaDetailsBatch(ids: string[]) {
      return ids.map(
        (id) =>
          mediaResults.get(id) ?? {
            anilistId: id,
            title: "Unknown",
            format: "TV",
            episodes: 0,
            relations: [],
          },
      );
    },
  };
}

describe("FranchiseAggregate", () => {
  describe("walkFranchiseGraph", () => {
    test("fetches media details for starting IDs", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(1);
        expect(result.get("1")?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("follows SEQUEL and PREQUEL relations", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
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

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(2);
        expect(result.has("1")).toBe(true);
        expect(result.has("2")).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("follows SIDE_STORY and PARENT relations", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "2", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "1", title: "One Piece", relationType: "PARENT" }],
        });

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("does not follow ADAPTATION relation", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [
            { anilistId: "2", title: "Jujutsu Kaisen Manga", relationType: "ADAPTATION" },
          ],
        });

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(1);
        expect(result.has("2")).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("uses cached entries instead of fetching", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Cached Anime",
          format: "TV",
          episodes: 12,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        let fetchCalled = false;
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: {
            async searchByTitle() {
              return null;
            },
            async getMediaDetailsBatch() {
              fetchCalled = true;
              return [];
            },
          },
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(fetchCalled).toBe(false);
        expect(result.size).toBe(1);
        expect(result.get("1")?.title).toBe("Cached Anime");
      } finally {
        sqlite.close();
      }
    });

    test("caches fetched results", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
        });

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        await aggregate.walkFranchiseGraph(["1"]);

        const cached = repo.getAnilistCacheEntry("1");
        expect(cached).not.toBeNull();
        expect(cached?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("handles batch fetch failure gracefully", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: {
            async searchByTitle() {
              return null;
            },
            async getMediaDetailsBatch() {
              throw new Error("Network error");
            },
          },
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

        expect(result.size).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("avoids infinite loops from circular relations", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
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

        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(mediaResults),
        });

        const result = await aggregate.walkFranchiseGraph(["1"]);

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
    test("creates franchise for single anime", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Jujutsu Kaisen");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates franchise for connected component", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-12346",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen S2",
          episodeCount: 23,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

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

    test("creates separate franchises for disconnected components", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "One Piece",
          episodeCount: 1100,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(2);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).not.toBe(updatedAnime2?.franchiseId);
      } finally {
        sqlite.close();
      }
    });

    test("uses existing franchise when AniList ID matches", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const existingFranchise = repo.createFranchise({
          title: "Existing Franchise",
          anilistId: "1",
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(existingFranchise.id);

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(existingFranchise.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates tracker mappings for assigned anime", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const mapping = repo.findAnimeByTrackerMapping("anilist", "1");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("uses anime title as franchise title when available", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "My Custom Title",
          episodeCount: 24,
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

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises[0]?.title).toBe("My Custom Title");
      } finally {
        sqlite.close();
      }
    });

    test("handles empty media results", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        const animeByAnilistId = new Map<string, number[]>();

        await aggregate.resolveFranchises(mediaResults, animeByAnilistId);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
        const aggregate = new FranchiseAggregate({
          library: repo,
          provider: createMockProvider(new Map()),
        });

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
});
