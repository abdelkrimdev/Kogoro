import { describe, expect, test } from "bun:test";
import { createEventDb } from "../events/test-utils";
import { AnimeQuery } from "./anime-query";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

describe("AnimeQuery", () => {
  describe("exportMatches", () => {
    test("converts to MatchEntry format", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          watched: false,
        });

        const matches = query.exportMatches();
        expect(matches).toHaveLength(1);
        expect(matches[0]).toEqual({
          animeId: "tvdb-12345",
          animeTitle: "Jujutsu Kaisen",
          entryType: "tv",
          episodeId: null,
          episode: 1,
          season: 1,
          title: "Ryomen Sukuna",
          filePath: "/media/S01E01.mkv",
          sourceDb: "tvdb",
        });
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getAnimeForDisplay", () => {
    test("returns anime with nested groups and episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({
          title: "Jujutsu Kaisen",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          watched: false,
        });

        const result = query.getAnimeForDisplay();

        expect(result).toHaveLength(1);
        expect(result[0]?.anime.title).toBe("Jujutsu Kaisen");
        expect(result[0]?.groups).toHaveLength(1);
        expect(result[0]?.groups[0]?.episodes).toHaveLength(2);
        expect(result[0]?.groups[0]?.watchStatus).toBe("watching");
        expect(result[0]?.groups[0]?.episodes[0]?.watched).toBe(true);
        expect(result[0]?.groups[0]?.episodes[1]?.watched).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns multiple anime with their groups", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime1 = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        const group1 = groupRepo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const anime2 = animeRepo.upsertAnime({ title: "Attack on Titan" });
        const group2 = groupRepo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          watched: true,
        });

        const result = query.getAnimeForDisplay();

        expect(result).toHaveLength(2);
        const titles = result.map((r) => r.anime.title).sort();
        expect(titles).toEqual(["Attack on Titan", "Jujutsu Kaisen"]);
        for (const item of result) {
          expect(item.groups).toHaveLength(1);
        }
        const aot = result.find((r) => r.anime.title === "Attack on Titan");
        expect(aot?.groups[0]?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("filters by sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const jjk = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.createAnimeSourceMapping({
          animeId: jjk.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const aot = animeRepo.upsertAnime({ title: "Attack on Titan" });
        animeRepo.createAnimeSourceMapping({
          animeId: aot.id,
          source: "anilist",
          externalId: "anilist-69",
        });

        const result = query.getAnimeForDisplay({ sourceDb: "tvdb" });

        expect(result).toHaveLength(1);
        expect(result[0]?.anime.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("filters by watchStatus", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime1 = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        const group1 = groupRepo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const anime2 = animeRepo.upsertAnime({ title: "Attack on Titan" });
        const group2 = groupRepo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          watched: true,
        });

        const result = query.getAnimeForDisplay({ watchStatus: "completed" });

        expect(result).toHaveLength(1);
        expect(result[0]?.anime.title).toBe("Attack on Titan");
        expect(result[0]?.groups[0]?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns empty array when no anime match filters", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });

        const result = query.getAnimeForDisplay({ sourceDb: "anidb" });

        expect(result).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns anime with multiple groups", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });

        const group1 = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: true,
        });

        const group2 = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/S02E01.mkv",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 2,
          filePath: "/media/S02E02.mkv",
          watched: false,
        });

        const result = query.getAnimeForDisplay();

        expect(result).toHaveLength(1);
        expect(result[0]?.groups).toHaveLength(2);
        expect(result[0]?.groups[0]?.watchStatus).toBe("completed");
        expect(result[0]?.groups[0]?.episodes).toHaveLength(1);
        expect(result[0]?.groups[1]?.watchStatus).toBe("watching");
        expect(result[0]?.groups[1]?.episodes).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns empty array when library is empty", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const result = query.getAnimeForDisplay();

        expect(result).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getAnimeDir", () => {
    test("returns null when anime has no episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Empty Anime" });

        expect(query.getAnimeDir(anime.id)).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns dirname for single episode", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Solo Anime" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/Anime/Show/S01E01.mkv",
          title: "Ep 1",
          watched: false,
        });

        expect(query.getAnimeDir(anime.id)).toBe("/media/Anime/Show");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns common parent for multiple episodes in same directory", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Multi Ep Anime" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/Anime/Show/S01E01.mkv",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/Anime/Show/S01E02.mkv",
          watched: false,
        });

        expect(query.getAnimeDir(anime.id)).toBe("/media/Anime/Show");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns common parent for episodes in nested directories", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Nested Anime" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/Anime/Show/Season1/S01E01.mkv",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/Anime/Show/Season2/S01E02.mkv",
          watched: false,
        });

        expect(query.getAnimeDir(anime.id)).toBe("/media/Anime/Show");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("animeExists", () => {
    test("returns true when anime exists with external ID", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        expect(query.animeExists("tvdb-12345", "tvdb")).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns false when anime does not exist", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        expect(query.animeExists("tvdb-99999", "tvdb")).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("defaults sourceDb to tvdb", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Attack on Titan" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-67890",
        });

        expect(query.animeExists("tvdb-67890")).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("animeExistsByTitle", () => {
    test("returns true when anime with title exists", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });

        expect(query.animeExistsByTitle("Jujutsu Kaisen")).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns false when title does not exist", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        expect(query.animeExistsByTitle("Nonexistent Anime")).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns false for case-mismatched title", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        animeRepo.upsertAnime({ title: "Attack on Titan" });

        expect(query.animeExistsByTitle("attack on titan")).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getAnimeDir with type directory", () => {
    test("strips trailing TV directory from path", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Organized Anime" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/Anime/Show/TV/S01E01.mkv",
          watched: false,
        });

        expect(query.getAnimeDir(anime.id)).toBe("/media/Anime/Show");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getStats", () => {
    test("returns zero counts for empty library", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const stats = query.getStats();
        expect(stats).toEqual({ animeCount: 0, episodeCount: 0 });
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("counts anime and episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime1 = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        const anime2 = animeRepo.upsertAnime({ title: "Attack on Titan" });

        const group1 = groupRepo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/a/S01E01.mkv",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 2,
          filePath: "/a/S01E02.mkv",
          watched: false,
        });

        const group2 = groupRepo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/b/S01E01.mkv",
          watched: true,
        });

        const stats = query.getStats();
        expect(stats).toEqual({ animeCount: 2, episodeCount: 3 });
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getEpisodesByGroupId", () => {
    test("returns episodes for a group", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/a/S01E01.mkv",
          title: "Ep 1",
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/a/S01E02.mkv",
          title: "Ep 2",
          watched: false,
        });

        const episodes = query.getEpisodesByGroupId(group.id);
        expect(episodes).toHaveLength(2);
        expect(episodes[0]?.episodeNumber).toBe(1);
        expect(episodes[0]?.watched).toBe(true);
        expect(episodes[1]?.episodeNumber).toBe(2);
        expect(episodes[1]?.watched).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns empty array for group with no episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
        const query = new AnimeQuery({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
        });

        const anime = animeRepo.upsertAnime({ title: "Empty Group Anime" });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const episodes = query.getEpisodesByGroupId(group.id);
        expect(episodes).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
