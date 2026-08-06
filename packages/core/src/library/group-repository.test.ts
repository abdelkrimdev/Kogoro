import { describe, expect, test } from "bun:test";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { AnimeRepository } from "./anime-repository";
import { EpisodeRepository } from "./episode-repository";
import { GroupRepository } from "./group-repository";
import { createLibraryDb } from "./test-utils";

describe("GroupRepository", () => {
  function setupAnime(db: ReturnType<typeof createLibraryDb>["db"]) {
    const animeRepo = new AnimeRepository({ db });
    return animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
  }

  describe("upsertEpisodeGroup", () => {
    test("creates episode group and returns it with generated id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        expect(group.id).toBeGreaterThan(0);
        expect(group.animeId).toBe(anime.id);
        expect(group.entryType).toBe("tv");
        expect(group.seasonNumber).toBe(1);
        expect(group.watchStatus).toBe("plan_to_watch");
      } finally {
        sqlite.close();
      }
    });

    test("creates group with optional fields", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
          synopsis: "First season",
          rating: 8.5,
          coverArtPath: "/covers/jjk.jpg",
        });

        expect(group.synopsis).toBe("First season");
        expect(group.rating).toBe(8.5);
        expect(group.coverArtPath).toBe("/covers/jjk.jpg");
      } finally {
        sqlite.close();
      }
    });

    test("updates existing group with same composite key", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const first = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
          rating: 9.0,
        });

        expect(updated.id).toBe(first.id);
        expect(updated.watchStatus).toBe("completed");
        expect(updated.rating).toBe(9.0);
      } finally {
        sqlite.close();
      }
    });

    test("creates separate groups for different entry types", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const tv = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const ova = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        expect(tv.id).not.toBe(ova.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodeGroup", () => {
    test("retrieves group by id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const created = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const retrieved = repo.getEpisodeGroup(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        expect(repo.getEpisodeGroup(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodeGroupsByAnimeId", () => {
    test("returns groups sorted by season number", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });
        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        const groups = repo.getEpisodeGroupsByAnimeId(anime.id);
        expect(groups).toHaveLength(2);
        expect(groups[0]?.seasonNumber).toBe(1);
        expect(groups[1]?.seasonNumber).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("returns empty array for anime with no groups", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);
        expect(repo.getEpisodeGroupsByAnimeId(anime.id)).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAllEpisodeGroups", () => {
    test("returns all groups across anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const animeRepo = new AnimeRepository({ db });
        const anime1 = animeRepo.upsertAnime({ title: "Anime 1" });
        const anime2 = animeRepo.upsertAnime({ title: "Anime 2" });

        repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const all = repo.getAllEpisodeGroups();
        expect(all).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findEpisodeGroup", () => {
    test("finds group by anime, entryType, and season", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const created = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const found = repo.findEpisodeGroup(anime.id, "tv", 1);
        expect(found?.id).toBe(created.id);

        const notFound = repo.findEpisodeGroup(anime.id, "tv", 2);
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("finds group with null season number", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const created = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "movie",
          watchStatus: "plan_to_watch",
        });

        const found = repo.findEpisodeGroup(anime.id, "movie", null);
        expect(found?.id).toBe(created.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteEpisodeGroup", () => {
    test("deletes group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const created = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.deleteEpisodeGroup(created.id);
        expect(repo.getEpisodeGroup(created.id)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteEpisodeGroupsByAnimeId", () => {
    test("deletes all groups for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.deleteEpisodeGroupsByAnimeId(anime.id);
        expect(repo.getEpisodeGroupsByAnimeId(anime.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupStatus", () => {
    test("updates watch status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = repo.updateEpisodeGroupStatus(group.id, "completed");
        expect(updated?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        expect(repo.updateEpisodeGroupStatus(999, "watching")).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupStatusBatch", () => {
    test("updates multiple groups", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const g1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        const g2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.updateEpisodeGroupStatusBatch([
          { groupId: g1.id, watchStatus: "completed" },
          { groupId: g2.id, watchStatus: "watching" },
        ]);

        expect(repo.getEpisodeGroup(g1.id)?.watchStatus).toBe("completed");
        expect(repo.getEpisodeGroup(g2.id)?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
      }
    });

    test("does nothing for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        repo.updateEpisodeGroupStatusBatch([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupMetadata", () => {
    test("updates metadata fields", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const updated = repo.updateEpisodeGroupMetadata(group.id, {
          synopsis: "Updated synopsis",
          rating: 9.5,
          coverArtPath: "/covers/new.jpg",
        });

        expect(updated?.synopsis).toBe("Updated synopsis");
        expect(updated?.rating).toBe(9.5);
        expect(updated?.coverArtPath).toBe("/covers/new.jpg");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        expect(repo.updateEpisodeGroupMetadata(999, { synopsis: "test" })).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupSeasonNumber", () => {
    test("updates season number", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = repo.updateEpisodeGroupSeasonNumber(group.id, 3);
        expect(updated?.seasonNumber).toBe(3);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getFilesOnDiskByGroupId", () => {
    test("returns episode count for group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const epRepo = new EpisodeRepository({ db });
        epRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        epRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        expect(repo.getFilesOnDiskByGroupId(group.id)).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("returns 0 for empty group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        expect(repo.getFilesOnDiskByGroupId(group.id)).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("upsertEpisodeGroupBatch", () => {
    test("creates multiple groups", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const groups = repo.upsertEpisodeGroupBatch([
          {
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "watching",
          },
          {
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 2,
            watchStatus: "plan_to_watch",
          },
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0]?.seasonNumber).toBe(1);
        expect(groups[1]?.seasonNumber).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("updates existing groups on conflict", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const first = repo.upsertEpisodeGroupBatch([
          {
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          },
        ]);

        const second = repo.upsertEpisodeGroupBatch([
          {
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "completed",
          },
        ]);

        expect(second[0]?.id).toBe(first[0]?.id);
        expect(second[0]?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
      }
    });

    test("returns empty array for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        expect(repo.upsertEpisodeGroupBatch([])).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("group tracker mappings", () => {
    test("creates and retrieves tracker mapping", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        const mappings = repo.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("mal");
        expect(mappings[0]?.externalId).toBe("12345");
      } finally {
        sqlite.close();
      }
    });

    test("finds group by tracker external id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        const found = repo.findGroupByTrackerExternalId("mal", "12345");
        expect(found?.groupId).toBe(group.id);

        const notFound = repo.findGroupByTrackerExternalId("anilist", "12345");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("updates mapping on conflict (source, externalId)", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const g1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        const g2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMapping({
          groupId: g1.id,
          source: "mal",
          externalId: "12345",
        });
        repo.upsertGroupTrackerMapping({
          groupId: g2.id,
          source: "mal",
          externalId: "12345",
        });

        const found = repo.findGroupByTrackerExternalId("mal", "12345");
        expect(found?.groupId).toBe(g2.id);
      } finally {
        sqlite.close();
      }
    });

    test("getAllTrackerMappings returns all mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const g1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        const g2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMapping({
          groupId: g1.id,
          source: "mal",
          externalId: "111",
        });
        repo.upsertGroupTrackerMapping({
          groupId: g2.id,
          source: "anilist",
          externalId: "222",
        });

        const all = repo.getAllTrackerMappings();
        expect(all).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    test("deleteTrackerMappingsByGroupId removes all for group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "111",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "222",
        });

        repo.deleteTrackerMappingsByGroupId(group.id);
        expect(repo.getTrackerMappingsByGroupId(group.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });

    test("getTrackerMapping returns single mapping", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "67890",
        });

        const mal = repo.getTrackerMapping(group.id, "mal");
        expect(mal?.externalId).toBe("12345");

        const anilist = repo.getTrackerMapping(group.id, "anilist");
        expect(anilist?.externalId).toBe("67890");

        const kitsu = repo.getTrackerMapping(group.id, "kitsu");
        expect(kitsu).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("removeTrackerMappingsBySource removes all for source", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const g1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        const g2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMapping({
          groupId: g1.id,
          source: "mal",
          externalId: "111",
        });
        repo.upsertGroupTrackerMapping({
          groupId: g2.id,
          source: "mal",
          externalId: "222",
        });
        repo.upsertGroupTrackerMapping({
          groupId: g1.id,
          source: "anilist",
          externalId: "333",
        });

        repo.removeTrackerMappingsBySource("mal");

        expect(repo.getTrackerMappingsByGroupId(g1.id)).toHaveLength(1);
        expect(repo.getTrackerMappingsByGroupId(g1.id)[0]?.source).toBe("anilist");
        expect(repo.getTrackerMappingsByGroupId(g2.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });

    test("removeTrackerMapping removes single mapping", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "67890",
        });

        repo.removeTrackerMapping(group.id, "mal");

        const mappings = repo.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
      } finally {
        sqlite.close();
      }
    });

    test("upsertGroupTrackerMappingBatch creates multiple mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMappingBatch([
          { groupId: group.id, source: "kitsu", externalId: "kitsu-123" },
          { groupId: group.id, source: "mal", externalId: "mal-456" },
        ]);

        const m1 = repo.findGroupByTrackerExternalId("kitsu", "kitsu-123");
        const m2 = repo.findGroupByTrackerExternalId("mal", "mal-456");
        expect(m1?.groupId).toBe(group.id);
        expect(m2?.groupId).toBe(group.id);
      } finally {
        sqlite.close();
      }
    });

    test("upsertGroupTrackerMappingBatch updates on conflict", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const g1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        const g2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMappingBatch([
          { groupId: g1.id, source: "kitsu", externalId: "kitsu-123" },
        ]);
        repo.upsertGroupTrackerMappingBatch([
          { groupId: g2.id, source: "kitsu", externalId: "kitsu-123" },
        ]);

        const mapping = repo.findGroupByTrackerExternalId("kitsu", "kitsu-123");
        expect(mapping?.groupId).toBe(g2.id);
      } finally {
        sqlite.close();
      }
    });

    test("upsertGroupTrackerMappingBatch does nothing for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        repo.upsertGroupTrackerMappingBatch([]);
        expect(repo.getAllTrackerMappings()).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAll", () => {
    test("removes all groups and tracker mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new GroupRepository({ db });
        const anime = setupAnime(db);

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        repo.deleteAll();
        expect(repo.getAllEpisodeGroups()).toHaveLength(0);
        expect(repo.getAllTrackerMappings()).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("event recording", () => {
    function setupWithEvents() {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      const evtRepo = new EventRepository(evtDb);
      const repo = new GroupRepository({ db, events: evtRepo });
      const animeRepo = new AnimeRepository({ db });
      const anime = animeRepo.upsertAnime({ title: "Test" });
      return { db, repo, evtRepo, sqlite, evtSqlite, anime };
    }

    describe("updateEpisodeGroupStatus", () => {
      test("records event when status changes", () => {
        const { repo, evtRepo, sqlite, evtSqlite, anime } = setupWithEvents();
        try {
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          repo.updateEpisodeGroupStatus(group.id, "completed");

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({
            entityType: "group",
            entityId: group.id,
            eventType: "status_change",
            oldValue: "plan_to_watch",
            newValue: "completed",
          });
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("does not record event when status unchanged", () => {
        const { repo, evtRepo, sqlite, evtSqlite, anime } = setupWithEvents();
        try {
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "completed",
          });

          repo.updateEpisodeGroupStatus(group.id, "completed");

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(0);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("does not record event when no events repo injected", () => {
        const { db, sqlite } = createLibraryDb();
        try {
          const repo = new GroupRepository({ db });
          const animeRepo = new AnimeRepository({ db });
          const anime = animeRepo.upsertAnime({ title: "Test" });
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          const result = repo.updateEpisodeGroupStatus(group.id, "completed");
          expect(result?.watchStatus).toBe("completed");
        } finally {
          sqlite.close();
        }
      });
    });

    describe("updateEpisodeGroupMetadata", () => {
      test("records event when synopsis changes", () => {
        const { repo, evtRepo, sqlite, evtSqlite, anime } = setupWithEvents();
        try {
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          repo.updateEpisodeGroupMetadata(group.id, { synopsis: "New synopsis" });

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({
            entityType: "group",
            entityId: group.id,
            eventType: "notes_update",
            oldValue: null,
            newValue: "New synopsis",
          });
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("records event when rating changes", () => {
        const { repo, evtRepo, sqlite, evtSqlite, anime } = setupWithEvents();
        try {
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          repo.updateEpisodeGroupMetadata(group.id, { rating: 9.5 });

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({
            entityType: "group",
            entityId: group.id,
            eventType: "notes_update",
            oldValue: null,
            newValue: "9.5",
          });
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("does not record event when metadata unchanged", () => {
        const { repo, evtRepo, sqlite, evtSqlite, anime } = setupWithEvents();
        try {
          const group = repo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
            synopsis: "Existing synopsis",
          });

          repo.updateEpisodeGroupMetadata(group.id, { synopsis: "Existing synopsis" });

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(0);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });
    });
  });
});
