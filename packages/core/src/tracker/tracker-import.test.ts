import { describe, expect, it } from "bun:test";
import { createMockEnrichmentProvider, createTrackerImportTestContext } from "../fixtures";
import type { TrackerAnime, TrackerPlugin } from "../types";
import { TrackerImportService } from "./tracker-import";

function createMockTrackerPlugin(
  list: TrackerAnime[] = [],
): TrackerPlugin & { getUserListCallCount: number } {
  let getUserListCallCount = 0;
  const plugin: TrackerPlugin & { getUserListCallCount: number } = {
    async authenticate() {
      return "mock-token";
    },
    async ensureAuthenticated() {},
    async getUserList() {
      getUserListCallCount++;
      return list;
    },
    async getEntry(trackerId: string) {
      return {
        trackerId,
        title: "Test",
        watchStatus: "watching",
        episodesWatched: 0,
        totalEpisodes: 12,
      };
    },
    async updateEntry() {},
    async getAnimeDetails(trackerId: string) {
      return {
        trackerId,
        title: "Test",
        entryType: "tv",
      };
    },
    get getUserListCallCount() {
      return getUserListCallCount;
    },
  };
  return plugin;
}

describe("TrackerImportService", () => {
  describe("getImportPreview", () => {
    it("returns empty preview when tracker list is empty", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.totalEntries).toBe(0);
        expect(preview.matched).toHaveLength(0);
        expect(preview.unmatched).toHaveLength(0);
        expect(preview.conflicts).toHaveLength(0);
        expect(preview.statusCounts).toEqual({
          watching: 0,
          completed: 0,
          "plan-to-watch": 0,
          "on-hold": 0,
          dropped: 0,
        });
      } finally {
        close();
      }
    });

    it("categorizes new entries as unmatched", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-2",
            title: "Death Note",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 37,
            totalEpisodes: 37,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.totalEntries).toBe(2);
        expect(preview.matched).toHaveLength(0);
        expect(preview.unmatched).toHaveLength(2);
        expect(preview.unmatched[0]?.title).toBe("Attack on Titan");
        expect(preview.unmatched[1]?.title).toBe("Death Note");
        expect(preview.statusCounts.watching).toBe(1);
        expect(preview.statusCounts.completed).toBe(1);
      } finally {
        close();
      }
    });

    it("matches tracker entries to existing library anime by title", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-2",
            title: "Death Note",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 37,
            totalEpisodes: 37,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.totalEntries).toBe(2);
        expect(preview.matched).toHaveLength(1);
        expect(preview.matched[0]?.title).toBe("Attack on Titan");
        expect(preview.matched[0]?.existingAnimeId).toBeDefined();
        expect(preview.matched[0]?.matchStatus).toBe("matched");
        expect(preview.unmatched).toHaveLength(1);
        expect(preview.unmatched[0]?.title).toBe("Death Note");
        expect(preview.unmatched[0]?.matchStatus).toBe("unmatched");
        expect(preview.conflicts).toHaveLength(0);
      } finally {
        close();
      }
    });

    it("matches by alternative titles", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Shingeki no Kyojin",
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            alternativeTitles: ["Shingeki no Kyojin"],
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.matched).toHaveLength(1);
        expect(preview.unmatched).toHaveLength(0);
      } finally {
        close();
      }
    });

    it("matches when library alternativeTitles contains tracker main title", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Shingeki no Kyojin",
          alternativeTitles: ["Attack on Titan"],
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.matched).toHaveLength(1);
        expect(preview.unmatched).toHaveLength(0);
      } finally {
        close();
      }
    });

    it("filters out already-imported entries from preview", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        libraryService.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-2",
            title: "Death Note",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 37,
            totalEpisodes: 37,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.totalEntries).toBe(1);
        expect(preview.unmatched).toHaveLength(1);
        expect(preview.unmatched[0]?.title).toBe("Death Note");
      } finally {
        close();
      }
    });
  });

  describe("confirmImport", () => {
    it("creates new anime and episode groups for unmatched entries", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Attack on Titan");

        const groups = libraryService.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("watching");

        const mappings = libraryService.getTrackerMappingsByGroupId(groups[0]?.id ?? 0);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        close();
      }
    });

    it("stores alternativeTitles on newly imported anime", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "進撃の巨人",
            alternativeTitles: ["Attack on Titan", "Shingeki no Kyojin"],
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(1);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("進撃の巨人");
        expect(animeList[0]?.alternativeTitles).toEqual(["Attack on Titan", "Shingeki no Kyojin"]);
      } finally {
        close();
      }
    });

    it("updates watch status for matched entries", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const updatedGroup = libraryService.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const mappings = libraryService.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        close();
      }
    });

    it("skips entries already imported from the same tracker", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        libraryService.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(0);
        expect(result.skipped).toBe(1);
      } finally {
        close();
      }
    });

    it("handles multiple seasons from tracker", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-s1",
            title: "Attack on Titan Season 1",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-s2",
            title: "Attack on Titan Season 2",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 10,
            totalEpisodes: 12,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(2);

        for (const anime of animeList) {
          const groups = libraryService.getEpisodeGroupsByAnimeId(anime.id);
          expect(groups).toHaveLength(1);
        }
      } finally {
        close();
      }
    });

    it("detects conflicts when watch status differs", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();

        expect(preview.totalEntries).toBe(1);
        expect(preview.matched).toHaveLength(0);
        expect(preview.unmatched).toHaveLength(0);
        expect(preview.conflicts).toHaveLength(1);
        expect(preview.conflicts[0]?.title).toBe("Attack on Titan");
        expect(preview.conflicts[0]?.matchStatus).toBe("conflict");
        expect(preview.conflicts[0]?.existingGroupId).toBe(group.id);
        expect(preview.conflicts[0]?.localWatchStatus).toBe("watching");
        expect(preview.conflicts[0]?.watchStatus).toBe("completed");
      } finally {
        close();
      }
    });

    it("resolves conflict by keeping local status", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport([
          { trackerId: "tl-1", resolution: "keepLocal" },
        ]);

        expect(result.imported).toBe(1);

        const updatedGroup = libraryService.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("watching");
      } finally {
        close();
      }
    });

    it("resolves conflict by accepting tracker status", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport([
          { trackerId: "tl-1", resolution: "acceptTracker" },
        ]);

        expect(result.imported).toBe(1);

        const updatedGroup = libraryService.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        close();
      }
    });

    it("links unmatched entry to existing group", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = libraryService.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Shingeki no Kyojin",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport([{ trackerId: "tl-1", groupId: group.id }]);

        expect(result.imported).toBe(1);

        const updatedGroup = libraryService.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const mappings = libraryService.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        close();
      }
    });

    it("caches tracker list so preview and confirm share one getUserList call", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        await service.getImportPreview();
        await service.confirmImport();

        expect(tracker.getUserListCallCount).toBe(1);
      } finally {
        close();
      }
    });

    it("batch imports multiple new anime in one transaction", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-2",
            title: "Death Note",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 37,
            totalEpisodes: 37,
          },
          {
            source: "anilist",
            trackerId: "tl-3",
            title: "One Piece",
            entryType: "tv",
            watchStatus: "plan-to-watch",
            episodesWatched: 0,
            totalEpisodes: 1100,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();

        expect(result.imported).toBe(3);
        expect(result.skipped).toBe(0);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(3);

        for (const anime of animeList) {
          const groups = libraryService.getEpisodeGroupsByAnimeId(anime.id);
          expect(groups).toHaveLength(1);
          const mappings = libraryService.getTrackerMappingsByGroupId(groups[0]?.id ?? 0);
          expect(mappings).toHaveLength(1);
        }
      } finally {
        close();
      }
    });

    it("reuses cached match results from preview in confirm", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const preview = await service.getImportPreview();
        expect(preview.matched).toHaveLength(1);

        const result = await service.confirmImport();
        expect(result.imported).toBe(1);

        const groups = libraryService.getEpisodeGroupsByAnimeId(
          preview.matched[0]?.existingAnimeId ?? 0,
        );
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("watching");
      } finally {
        close();
      }
    });

    it("clearCache resets cached tracker list and match results", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        await service.getImportPreview();
        expect(tracker.getUserListCallCount).toBe(1);

        service.clearCache();

        await service.confirmImport();
        expect(tracker.getUserListCallCount).toBe(2);
      } finally {
        close();
      }
    });

    it("confirmImport without prior preview calls getUserList", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(1);
        expect(tracker.getUserListCallCount).toBe(1);
      } finally {
        close();
      }
    });

    it("batch updates watch status for multiple matched entries", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const anime1 = libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group1 = libraryService.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const anime2 = libraryService.upsertAnime({
          externalId: "tvdb-456",
          sourceDb: "tvdb",
          title: "Death Note",
          episodeCount: 37,
        });

        const group2 = libraryService.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "tl-2",
            title: "Death Note",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 37,
            totalEpisodes: 37,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const updatedGroup1 = libraryService.getEpisodeGroup(group1.id);
        expect(updatedGroup1?.watchStatus).toBe("completed");

        const updatedGroup2 = libraryService.getEpisodeGroup(group2.id);
        expect(updatedGroup2?.watchStatus).toBe("completed");
      } finally {
        close();
      }
    });
  });

  describe("confirmImport - enrichment", () => {
    it("enriches newly imported anime with franchise", async () => {
      const provider = createMockEnrichmentProvider({
        searchByTitle: async (title) => ({
          anilistId: "12345",
          title,
          format: "TV",
          episodes: 24,
        }),
        getMediaDetailsBatch: async (ids) =>
          ids.map((id) => ({
            anilistId: id,
            title: "Attack on Titan",
            format: "TV",
            episodes: 25,
            relations: [],
          })),
      });

      const { repo, libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "12345",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        await service.getImportPreview();
        const result = await service.confirmImport();

        expect(result.imported).toBe(1);

        const anime = repo.listAnime();
        expect(anime).toHaveLength(1);
        expect(anime[0]?.franchiseId).not.toBeNull();

        const franchises = repo.getFranchises();
        expect(franchises).toHaveLength(1);
        expect(franchises[0]?.title).toBe("Attack on Titan");

        const mapping = repo.findAnimeByTrackerMapping("anilist", "12345");
        expect(mapping).not.toBeNull();
        expect(mapping?.animeId).toBe(anime[0]?.id);
      } finally {
        close();
      }
    });

    it("does not enrich anime that already has a franchise", async () => {
      let searchCallCount = 0;
      const provider = createMockEnrichmentProvider({
        searchByTitle: async () => {
          searchCallCount++;
          return { anilistId: "12345", title: "Attack on Titan", format: "TV", episodes: 25 };
        },
      });

      const { repo, libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const franchise = repo.createFranchise({
          title: "Existing Franchise",
          anilistId: "99999",
        });

        const anime = repo.upsertAnime({
          externalId: "anilist-12345",
          sourceDb: "anilist",
          title: "Attack on Titan",
          episodeCount: 25,
        });
        repo.assignAnimeToFranchise(anime.id, franchise.id);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "12345",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        await service.getImportPreview();
        const result = await service.confirmImport();

        expect(result.imported).toBe(1);

        const franchises = repo.getFranchises();
        expect(franchises).toHaveLength(1);
        expect(franchises[0]?.id).toBe(franchise.id);

        const updatedAnime = repo.getAnime(anime.id);
        expect(updatedAnime?.franchiseId).toBe(franchise.id);

        const updatedGroup = libraryService.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        expect(searchCallCount).toBe(0);
      } finally {
        close();
      }
    });
  });

  describe("confirmImport - relation-based grouping", () => {
    it("merges entries with different titles connected by SEQUEL relation", async () => {
      const provider = createMockEnrichmentProvider({
        searchByTitle: async (title) => ({
          anilistId: "1",
          title,
          format: "TV",
          episodes: 24,
        }),
        getMediaDetailsBatch: async (ids) =>
          ids.map((id) => {
            const details: Record<
              string,
              {
                anilistId: string;
                title: string;
                format: string;
                episodes: number;
                relations: Array<{ anilistId: string; title: string; relationType: string }>;
              }
            > = {
              "100": {
                anilistId: "100",
                title: "Shingeki no Kyojin",
                format: "TV",
                episodes: 25,
                relations: [
                  {
                    anilistId: "200",
                    title: "Shingeki no Kyojin: The Final Season",
                    relationType: "SEQUEL",
                  },
                ],
              },
              "200": {
                anilistId: "200",
                title: "Shingeki no Kyojin: The Final Season",
                format: "TV",
                episodes: 16,
                relations: [
                  { anilistId: "100", title: "Shingeki no Kyojin", relationType: "PREQUEL" },
                ],
              },
            };
            return (
              details[id] ?? {
                anilistId: id,
                title: "Unknown",
                format: "TV",
                episodes: 0,
                relations: [],
              }
            );
          }),
      });

      const { libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "100",
            title: "Shingeki no Kyojin",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "200",
            title: "Shingeki no Kyojin: The Final Season",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 16,
            totalEpisodes: 16,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(1);

        const groups = libraryService.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(2);

        const statuses = groups.map((g) => g.watchStatus).sort();
        expect(statuses).toEqual(["completed", "watching"]);
      } finally {
        close();
      }
    });

    it("falls back to title-based grouping when no enrichment provider", async () => {
      const { libraryService, close } = createTrackerImportTestContext();
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "100",
            title: "Shingeki no Kyojin",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "200",
            title: "Shingeki no Kyojin: The Final Season",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 16,
            totalEpisodes: 16,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(2);
      } finally {
        close();
      }
    });

    it("falls back to title-based grouping when enrichment provider returns null", async () => {
      const provider = createMockEnrichmentProvider({
        getMediaDetailsBatch: async () => {
          throw new Error("API error");
        },
      });

      const { libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "100",
            title: "Attack on Titan Season 1",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "200",
            title: "Attack on Titan Season 2",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 12,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(2);

        for (const anime of animeList) {
          const groups = libraryService.getEpisodeGroupsByAnimeId(anime.id);
          expect(groups).toHaveLength(1);
        }
      } finally {
        close();
      }
    });

    it("uses title-based grouping for entries without relations", async () => {
      const provider = createMockEnrichmentProvider({
        searchByTitle: async (title) => ({
          anilistId: "1",
          title,
          format: "TV",
          episodes: 12,
        }),
        getMediaDetailsBatch: async (ids) =>
          ids.map((id) => ({
            anilistId: id,
            title: "Test",
            format: "TV",
            episodes: 12,
            relations: [],
          })),
      });

      const { libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "100",
            title: "One Piece Season 1",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            source: "anilist",
            trackerId: "200",
            title: "One Piece Season 2",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 24,
            totalEpisodes: 24,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(2);

        for (const anime of animeList) {
          const groups = libraryService.getEpisodeGroupsByAnimeId(anime.id);
          expect(groups).toHaveLength(1);
        }
      } finally {
        close();
      }
    });

    it("does not group entries connected only by SPIN_OFF relation", async () => {
      const provider = createMockEnrichmentProvider({
        searchByTitle: async (title) => {
          if (title === "Naruto") return { anilistId: "100", title, format: "TV", episodes: 220 };
          return { anilistId: "200", title, format: "TV", episodes: 50 };
        },
        getMediaDetailsBatch: async (ids) =>
          ids.map((id) => {
            const details: Record<
              string,
              {
                anilistId: string;
                title: string;
                format: string;
                episodes: number;
                relations: Array<{ anilistId: string; title: string; relationType: string }>;
              }
            > = {
              "100": {
                anilistId: "100",
                title: "Naruto",
                format: "TV",
                episodes: 220,
                relations: [
                  { anilistId: "200", title: "Naruto Spin-Off", relationType: "SPIN_OFF" },
                ],
              },
              "200": {
                anilistId: "200",
                title: "Naruto Spin-Off",
                format: "TV",
                episodes: 50,
                relations: [{ anilistId: "100", title: "Naruto", relationType: "ALTERNATIVE" }],
              },
            };
            return (
              details[id] ?? {
                anilistId: id,
                title: "Unknown",
                format: "TV",
                episodes: 0,
                relations: [],
              }
            );
          }),
      });

      const { libraryService, close } = createTrackerImportTestContext(async () => provider);
      try {
        const tracker = createMockTrackerPlugin([
          {
            source: "anilist",
            trackerId: "100",
            title: "Naruto",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 220,
            totalEpisodes: 220,
          },
          {
            source: "anilist",
            trackerId: "200",
            title: "Naruto Spin-Off",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 50,
            totalEpisodes: 50,
          },
        ]);

        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport();
        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(2);
      } finally {
        close();
      }
    });
  });
});
