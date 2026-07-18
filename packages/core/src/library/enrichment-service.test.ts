import { describe, expect, test } from "bun:test";
import { createEnrichmentTestContext, createMockEnrichmentProvider } from "../fixtures";
import type { EnrichmentMediaResult } from "../types";
import { EnrichmentService } from "./enrichment-service";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("EnrichmentService", () => {
  describe("enrichAnime", () => {
    test("creates franchise from AniList search result", async () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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
        close();
      }
    });

    test("skips anime that already has a franchise", async () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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
        close();
      }
    });

    test("skips anime that already has an AniList mapping", async () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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
        close();
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

        await service.enrichAnime([anime.id]);

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

    test("uses known AniList entries instead of searching by title", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => {
            searchCalled = true;
            return null;
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Attack on Titan",
              format: "TV",
              episodes: 25,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const knownEntries = [{ anilistId: "16498", title: "Attack on Titan" }];
        await service.enrichAnime([anime.id], knownEntries);

        expect(searchCalled).toBe(false);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();
        expect(franchise?.title).toBe("Attack on Titan");

        const mapping = repo.findAnimeByTrackerMapping("anilist", "16498");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("matches anime to known entries by title case-insensitively", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => {
            searchCalled = true;
            return null;
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Attack on Titan",
              format: "TV",
              episodes: 25,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "ATTACK ON TITAN",
          episodeCount: 25,
        });

        const knownEntries = [{ anilistId: "16498", title: "Attack on Titan" }];
        await service.enrichAnime([anime.id], knownEntries);

        expect(searchCalled).toBe(false);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();

        const mapping = repo.findAnimeByTrackerMapping("anilist", "16498");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("falls back to search when no known entry matches", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            searchCalled = true;
            return { anilistId: "999", title, format: "TV", episodes: 12 };
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Unknown Anime",
              format: "TV",
              episodes: 12,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Unknown Anime",
          episodeCount: 12,
        });

        const knownEntries = [{ anilistId: "16498", title: "Attack on Titan" }];
        await service.enrichAnime([anime.id], knownEntries);

        expect(searchCalled).toBe(true);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();
        expect(franchise?.title).toBe("Unknown Anime");

        const mapping = repo.findAnimeByTrackerMapping("anilist", "999");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("uses known AniList ID from group tracker mappings", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async () => {
            searchCalled = true;
            return null;
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "One Piece",
              format: "TV",
              episodes: 1100,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "One Piece",
          episodeCount: 1100,
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

        await service.enrichAnime([anime.id]);

        expect(searchCalled).toBe(false);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();

        const mapping = repo.findAnimeByTrackerMapping("anilist", "21");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime.id);
      } finally {
        sqlite.close();
      }
    });

    test("continues enrichment when some batch fetches fail", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);

        const mediaResults = new Map<string, EnrichmentMediaResult>();
        mediaResults.set("16498", {
          anilistId: "16498",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [
            { anilistId: "16499", title: "Attack on Titan Season 2", relationType: "SEQUEL" },
          ],
        });
        mediaResults.set("16499", {
          anilistId: "16499",
          title: "Attack on Titan Season 2",
          format: "TV",
          episodes: 12,
          relations: [{ anilistId: "16498", title: "Attack on Titan", relationType: "PREQUEL" }],
        });
        mediaResults.set("11000", {
          anilistId: "11000",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [],
        });

        let fetchCount = 0;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            if (title === "Attack on Titan") {
              return { anilistId: "16498", title, format: "TV", episodes: 25 };
            }
            return { anilistId: "11000", title, format: "TV", episodes: 1100 };
          },
          getMediaDetailsBatch: async (ids) => {
            fetchCount++;
            if (fetchCount === 1) {
              throw new Error("Network error on first batch");
            }
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
        });
        const service = new EnrichmentService(repo, provider);

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-100",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-101",
          sourceDb: "tvdb",
          title: "One Piece",
          episodeCount: 1100,
        });

        await service.enrichAnime([anime1.id, anime2.id]);

        const updatedAnime1 = repo.getAnime(anime1.id);
        expect(updatedAnime1?.franchiseId).toBeFalsy();

        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime2?.franchiseId).toBeTruthy();

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(1);
        expect(franchises[0]?.title).toBe("One Piece");
      } finally {
        sqlite.close();
      }
    });

    test("gracefully handles empty known entries list", async () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        let searchCalled = false;
        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            searchCalled = true;
            return { anilistId: "1", title, format: "TV", episodes: 12 };
          },
          getMediaDetailsBatch: async (ids) =>
            ids.map((id) => ({
              anilistId: id,
              title: "Test Anime",
              format: "TV",
              episodes: 12,
              relations: [],
            })),
        });
        const service = new EnrichmentService(repo, provider);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Test Anime",
          episodeCount: 12,
        });

        await service.enrichAnime([anime.id], []);

        expect(searchCalled).toBe(true);

        const franchise = repo.getFranchiseById(1);
        expect(franchise).not.toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("skips search for anime already franchised by sibling graph walk", async () => {
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

        expect(searchCount).toBe(1);

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

    test("resolves two disconnected franchises separately", async () => {
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
        mediaResults.set("3", {
          anilistId: "3",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "4", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
        });
        mediaResults.set("4", {
          anilistId: "4",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "3", title: "One Piece", relationType: "PARENT" }],
        });

        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            if (title === "Jujutsu Kaisen")
              return { anilistId: "1", title, format: "TV", episodes: 24 };
            if (title === "Jujutsu Kaisen Season 2")
              return { anilistId: "2", title, format: "TV", episodes: 23 };
            if (title === "One Piece")
              return { anilistId: "3", title, format: "TV", episodes: 1100 };
            return { anilistId: "4", title, format: "MOVIE", episodes: 1 };
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
          title: "One Piece",
          episodeCount: 1100,
        });

        await service.enrichAnime([anime1.id, anime2.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(2);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).not.toBe(updatedAnime2?.franchiseId);
      } finally {
        sqlite.close();
      }
    });

    test("resolves two disconnected franchises separately via search", async () => {
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
        mediaResults.set("3", {
          anilistId: "3",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "4", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
        });
        mediaResults.set("4", {
          anilistId: "4",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "3", title: "One Piece", relationType: "PARENT" }],
        });

        const provider = createMockEnrichmentProvider({
          searchByTitle: async (title) => {
            if (title === "Jujutsu Kaisen")
              return { anilistId: "1", title, format: "TV", episodes: 24 };
            if (title === "One Piece")
              return { anilistId: "3", title, format: "TV", episodes: 1100 };
            return null;
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
          title: "One Piece",
          episodeCount: 1100,
        });

        await service.enrichAnime([anime1.id, anime2.id]);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(2);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).not.toBe(updatedAnime2?.franchiseId);
      } finally {
        sqlite.close();
      }
    });

    test("resolves two disconnected franchises separately via known entries", async () => {
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
        mediaResults.set("3", {
          anilistId: "3",
          title: "One Piece",
          format: "TV",
          episodes: 1100,
          relations: [{ anilistId: "4", title: "One Piece Film Red", relationType: "SIDE_STORY" }],
        });
        mediaResults.set("4", {
          anilistId: "4",
          title: "One Piece Film Red",
          format: "MOVIE",
          episodes: 1,
          relations: [{ anilistId: "3", title: "One Piece", relationType: "PARENT" }],
        });

        const provider = createMockEnrichmentProvider({
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
          title: "One Piece",
          episodeCount: 1100,
        });

        const knownEntries = [
          { anilistId: "1", title: "Jujutsu Kaisen" },
          { anilistId: "3", title: "One Piece" },
        ];

        await service.enrichAnime([anime1.id, anime2.id], knownEntries);

        const franchises = repo.getFranchises();
        expect(franchises.length).toBe(2);

        const updatedAnime1 = repo.getAnime(anime1.id);
        const updatedAnime2 = repo.getAnime(anime2.id);
        expect(updatedAnime1?.franchiseId).not.toBe(updatedAnime2?.franchiseId);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("buildFranchiseSets", () => {
    test("returns franchise set for connected entries", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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

        const sets = service.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(2);
        expect(sets.get("1")).toEqual(new Set(["1", "2"]));
        expect(sets.get("2")).toEqual(new Set(["1", "2"]));
      } finally {
        close();
      }
    });

    test("returns separate sets for disconnected entries", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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

        const sets = service.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(2);
        expect(sets.get("1")).toEqual(new Set(["1"]));
        expect(sets.get("2")).toEqual(new Set(["2"]));
      } finally {
        close();
      }
    });

    test("skips entries not in cache", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [{ anilistId: "2", title: "Attack on Titan S2", relationType: "SEQUEL" }],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const sets = service.buildFranchiseSets(["1", "2"]);

        expect(sets.size).toBe(1);
        expect(sets.get("1")).toEqual(new Set(["1"]));
        expect(sets.has("2")).toBe(false);
      } finally {
        close();
      }
    });
  });

  describe("assignSeasonNumbers", () => {
    test("assigns sequential season numbers following SEQUEL chain", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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

        const seasonNumbers = service.assignSeasonNumbers(["1", "2", "3"]);

        expect(seasonNumbers.get("1")).toBe(1);
        expect(seasonNumbers.get("2")).toBe(2);
        expect(seasonNumbers.get("3")).toBe(3);
      } finally {
        close();
      }
    });

    test("finds root from any entry in chain", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
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

        const seasonNumbers = service.assignSeasonNumbers(["2", "1"]);

        expect(seasonNumbers.get("1")).toBe(1);
        expect(seasonNumbers.get("2")).toBe(2);
      } finally {
        close();
      }
    });

    test("returns undefined for entries not in SEQUEL chain", () => {
      const { repo, service, close } = createEnrichmentTestContext();
      try {
        repo.setAnilistCacheEntry({
          anilistId: "1",
          title: "Attack on Titan",
          format: "TV",
          episodes: 25,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const seasonNumbers = service.assignSeasonNumbers(["1"]);

        expect(seasonNumbers.get("1")).toBeUndefined();
      } finally {
        close();
      }
    });

    test("handles empty cluster", () => {
      const { service, close } = createEnrichmentTestContext();
      try {
        const seasonNumbers = service.assignSeasonNumbers([]);
        expect(seasonNumbers.size).toBe(0);
      } finally {
        close();
      }
    });
  });
});
