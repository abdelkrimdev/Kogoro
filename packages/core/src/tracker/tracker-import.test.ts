import { describe, expect, it } from "bun:test";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { createLibraryRepository } from "../fixtures";
import { LibraryService } from "../library/library-service";
import type { TrackerAnime, TrackerPlugin } from "../types";
import { TrackerImportService } from "./tracker-import";

function createMockTrackerPlugin(list: TrackerAnime[] = []): TrackerPlugin {
  return {
    async authenticate() {
      return "mock-token";
    },
    async ensureAuthenticated() {},
    async getUserList() {
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
  };
}

describe("TrackerImportService", () => {
  describe("getImportPreview", () => {
    it("returns empty preview when tracker list is empty", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
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
        evtSqlite.close();
      }
    });

    it("categorizes new entries as unmatched", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
        const tracker = createMockTrackerPlugin([
          {
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
          {
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
        evtSqlite.close();
      }
    });

    it("matches tracker entries to existing library anime by title", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 12,
            totalEpisodes: 25,
          },
          {
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
        evtSqlite.close();
      }
    });

    it("matches by alternative titles", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Shingeki no Kyojin",
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
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
        evtSqlite.close();
      }
    });

    it("matches when library alternativeTitles contains tracker main title", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Shingeki no Kyojin",
          alternativeTitles: ["Attack on Titan"],
          episodeCount: 25,
        });

        const tracker = createMockTrackerPlugin([
          {
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
        evtSqlite.close();
      }
    });

    it("filters out already-imported entries from preview", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
            trackerId: "tl-1",
            title: "Attack on Titan",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
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
        evtSqlite.close();
      }
    });
  });

  describe("confirmImport", () => {
    it("creates new anime and episode groups for unmatched entries", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
        const tracker = createMockTrackerPlugin([
          {
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
        evtSqlite.close();
      }
    });

    it("stores alternativeTitles on newly imported anime", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
        const tracker = createMockTrackerPlugin([
          {
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
        evtSqlite.close();
      }
    });

    it("updates watch status for matched entries", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("skips entries already imported from the same tracker", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("handles multiple seasons from tracker", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
        const tracker = createMockTrackerPlugin([
          {
            trackerId: "tl-s1",
            title: "Attack on Titan Season 1",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
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
        expect(animeList).toHaveLength(1);

        const groups = libraryService.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(2);
      } finally {
        close();
        evtSqlite.close();
      }
    });

    it("detects conflicts when watch status differs", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("resolves conflict by keeping local status", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("resolves conflict by accepting tracker status", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("links unmatched entry to existing group", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);

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
        evtSqlite.close();
      }
    });

    it("uses inferredAnimeTitle from selection when creating new anime", async () => {
      const { repo, close } = createLibraryRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const libraryService = new LibraryService(repo, evtRepo);
        const tracker = createMockTrackerPlugin([
          {
            trackerId: "tl-1",
            title: "Attack on Titan Season 1",
            entryType: "tv",
            watchStatus: "completed",
            episodesWatched: 25,
            totalEpisodes: 25,
          },
          {
            trackerId: "tl-2",
            title: "Attack on Titan Season 2",
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 10,
            totalEpisodes: 12,
          },
        ]);
        const service = new TrackerImportService(libraryService, tracker, "anilist");

        const result = await service.confirmImport([
          { trackerId: "tl-1", inferredAnimeTitle: "Attack on Titan" },
          { trackerId: "tl-2", inferredAnimeTitle: "Attack on Titan" },
        ]);

        expect(result.imported).toBe(2);

        const animeList = libraryService.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Attack on Titan");

        const groups = libraryService.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(2);
      } finally {
        close();
        evtSqlite.close();
      }
    });
  });
});
