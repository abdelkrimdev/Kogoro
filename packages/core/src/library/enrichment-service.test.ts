import { describe, expect, test } from "bun:test";
import { createMockEnrichmentProvider } from "../fixtures";
import type { EnrichmentMediaResult } from "../types";
import { EnrichmentService } from "./enrichment-service";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("EnrichmentService", () => {
  describe("enrichAnime", () => {
    test("creates franchise from AniList search result", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider();
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        await service.enrichAnime([anime.id]);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();
        expect(franchise?.title).toBe("Jujutsu Kaisen");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchise?.id);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that already has a franchise", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider();
        const service = new EnrichmentService(repo, provider);

        const franchise = repo.createFranchise({ title: "Existing Franchise" });
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });
        repo.assignAnimeToFranchise(anime.id, franchise.id);

        await service.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Existing Franchise");
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that already has an AniList mapping", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider();
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });
        repo.createAnimeTrackerMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "12345",
        });

        await service.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("walks relation graph and assigns related anime to same franchise", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [{ anilistId: "2", title: "Jujutsu Kaisen Season 2", relationType: "SEQUEL" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Jujutsu Kaisen Season 2",
          format: "TV",
          episodes: 23,
          relations: [{ anilistId: "1", title: "Jujutsu Kaisen", relationType: "PREQUEL" }],
        });

        let searchCount = 0;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            searchCount++;
            if (searchCount === 1) {
              return { anilistId: "1", title, format: "TV", episodes: 24 };
            }
            return { anilistId: "2", title, format: "TV", episodes: 23 };
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map(
              (id) =>
                mediaResults.get(id) ?? {
                  anilistId: id,
                  title: "Unknown",
                  format: "TV",
                  episodes: 0,
                  relations: [],
                },
            ),
        });

        const service = new EnrichmentService(repo, provider);

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-12346",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen Season 2",
          episodeCount: 23,
        });

        await service.enrichAnime([anime1.id, anime2.id]);

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

    test("caches AniList data", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Jujutsu Kaisen",
              format: "TV",
              episodes: 24,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        await service.enrichAnime([anime.id]);

        const cacheEntry = repo.getAnilistCacheEntry("1");
        expect(cacheEntry).not.toBeNull();
        expect(cacheEntry?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("propagates error when provider search fails", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => {
            throw new Error("API rate limit exceeded");
          },
        });
        const service = new EnrichmentService(repo, provider);

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });
        const anime2 = repo.upsertAnime({
          externalId: "tvdb-12346",
          sourceDb: "tvdb",
          title: "One Piece",
          episodeCount: 1000,
        });

        await expect(service.enrichAnime([anime1.id, anime2.id])).rejects.toThrow(
          "API rate limit exceeded",
        );

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("propagates error when batch fetch fails", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          getMediaDetailsBatch: async () => {
            throw new Error("Network error");
          },
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        await expect(service.enrichAnime([anime.id])).rejects.toThrow("Network error");

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime that does not exist", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => {
            searchCalled = true;
            return null;
          },
        });
        const service = new EnrichmentService(repo, provider);

        await service.enrichAnime([999]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
        expect(searchCalled).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("skips anime when AniList search returns null", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => null,
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Unknown Anime",
          episodeCount: 24,
        });

        await service.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(0);
      } finally {
        sqlite.close();
      }
    });

    test("creates franchise for single anime with no relations", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => ({ anilistId: "1", title, format: "TV", episodes: 24 }),
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Jujutsu Kaisen",
              format: "TV",
              episodes: 24,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        await service.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("Jujutsu Kaisen");

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchises[0]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("creates tracker mappings for related anime in franchise", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("1", {
          anilistId: "1",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [{ anilistId: "2", title: "Jujutsu Kaisen Season 2", relationType: "SEQUEL" }],
        });
        mediaResults.set("2", {
          anilistId: "2",
          title: "Jujutsu Kaisen Season 2",
          format: "TV",
          episodes: 23,
          relations: [{ anilistId: "1", title: "Jujutsu Kaisen", relationType: "PREQUEL" }],
        });

        let searchCount = 0;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            searchCount++;
            if (searchCount === 1) {
              return { anilistId: "1", title, format: "TV", episodes: 24 };
            }
            return { anilistId: "2", title, format: "TV", episodes: 23 };
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map(
              (id) =>
                mediaResults.get(id) ?? {
                  anilistId: id,
                  title: "Unknown",
                  format: "TV",
                  episodes: 0,
                  relations: [],
                },
            ),
        });

        const service = new EnrichmentService(repo, provider);

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-12346",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen Season 2",
          episodeCount: 23,
        });

        await service.enrichAnime([anime1.id, anime2.id]);

        const mapping1 = repo.findAnimeByTrackerMapping("anilist", "1");
        expect(mapping1).not.toBeNull();
        expect(mapping1?.animeId).toBe(anime1.id);

        const mapping2 = repo.findAnimeByTrackerMapping("anilist", "2");
        expect(mapping2).not.toBeNull();
        expect(mapping2?.animeId).toBe(anime2.id);
      } finally {
        sqlite.close();
      }
    });

    test("uses existing franchise when AniList ID already has one", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => ({
            anilistId: "12345",
            title,
            format: "TV",
            episodes: 24,
          }),
        });
        const service = new EnrichmentService(repo, provider);

        const franchise = repo.createFranchise({
          title: "Existing Franchise",
          anilistId: "12345",
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        await service.enrichAnime([anime.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.id).toBe(franchise.id);

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchise.id);
      } finally {
        sqlite.close();
      }
    });
  });
});
