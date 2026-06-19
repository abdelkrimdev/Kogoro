import { describe, expect, test } from "bun:test";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("LibraryRepository", () => {
  describe("upsertAnime", () => {
    test("creates anime and returns it with generated id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          titleJapanese: "呪術廻戦",
          episodeCount: 24,
          genres: ["action", "supernatural"],
          libraryState: "on_disk",
        });

        expect(anime.id).toBeGreaterThan(0);
        expect(anime.externalId).toBe("tvdb-12345");
        expect(anime.sourceDb).toBe("tvdb");
        expect(anime.title).toBe("Jujutsu Kaisen");
        expect(anime.titleJapanese).toBe("呪術廻戦");
        expect(anime.episodeCount).toBe(24);
        expect(anime.genres).toEqual(["action", "supernatural"]);
        expect(anime.libraryState).toBe("on_disk");
        expect(anime.lastSynced).toBeTruthy();
      } finally {
        sqlite.close();
      }
    });

    test("updates existing anime with same externalId and sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const updated = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen Season 2",
          episodeCount: 48,
        });

        expect(updated.id).toBe(anime.id);
        expect(updated.title).toBe("Jujutsu Kaisen Season 2");
        expect(updated.episodeCount).toBe(48);
      } finally {
        sqlite.close();
      }
    });

    test("accepts explicit lastSynced timestamp", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
          lastSynced: "2026-01-01T00:00:00.000Z",
        });

        expect(anime.lastSynced).toBe("2026-01-01T00:00:00.000Z");
      } finally {
        sqlite.close();
      }
    });

    test("defaults libraryState to not_on_disk", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        expect(anime.libraryState).toBe("not_on_disk");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAnime", () => {
    test("retrieves anime by id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const inserted = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const retrieved = repo.getAnime(inserted.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        expect(repo.getAnime(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findAnime", () => {
    test("retrieves anime by externalId and sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const found = repo.findAnime("tvdb-12345", "tvdb");
        expect(found).not.toBeNull();
        expect(found?.title).toBe("Jujutsu Kaisen");

        const notFound = repo.findAnime("tvdb-99999", "tvdb");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("listAnime", () => {
    test("returns all anime sorted by title with filesOnDisk count", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        repo.upsertAnime({
          externalId: "tvdb-1",
          sourceDb: "tvdb",
          title: "Z anime",
          episodeCount: 12,
        });
        repo.upsertAnime({
          externalId: "tvdb-2",
          sourceDb: "tvdb",
          title: "A anime",
          episodeCount: 1,
        });

        const list = repo.listAnime();
        expect(list).toHaveLength(2);
        expect(list[0]?.title).toBe("A anime");
        expect(list[1]?.title).toBe("Z anime");
      } finally {
        sqlite.close();
      }
    });

    test("includes filesOnDisk count from episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-1",
          sourceDb: "tvdb",
          title: "Steins;Gate",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const list = repo.listAnime();
        expect(list).toHaveLength(1);
        expect(list[0]?.filesOnDisk).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAnime", () => {
    test("removes anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        repo.deleteAnime(anime.id);
        expect(repo.getAnime(anime.id)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("addEpisode", () => {
    test("inserts episode and upserts on duplicate", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const first = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/old-path.mkv",
          title: "Old Title",
          season: 1,
          watched: false,
        });

        const updated = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/new-path.mkv",
          title: "New Title",
          season: 1,
          watched: true,
        });

        expect(updated.id).toBe(first.id);
        expect(updated.filePath).toBe("/media/new-path.mkv");
        expect(updated.title).toBe("New Title");
        expect(updated.watched).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("returns episodes sorted by season and episode number", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const episodes = repo.getEpisodesByAnimeId(anime.id);
        expect(episodes).toHaveLength(2);
        expect(episodes[0]?.episodeNumber).toBe(1);
        expect(episodes[1]?.episodeNumber).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("removes all episodes for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: false,
        });

        repo.deleteEpisodesByAnimeId(anime.id);
        expect(repo.getEpisodesByAnimeId(anime.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("episode watched status", () => {
    test("sets and retrieves watched status for episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const ep = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const updated = repo.setEpisodeWatched(ep.id, true);
        expect(updated?.watched).toBe(true);

        const watched = repo.getEpisodeWatchStatus(ep.id);
        expect(watched).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("updates existing watched status for episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const ep = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        repo.setEpisodeWatched(ep.id, true);
        const updated = repo.setEpisodeWatched(ep.id, false);

        expect(updated?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("returns all watched statuses for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: true,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: false,
        });

        const statuses = repo.getEpisodeWatchStatusByAnimeId(anime.id);
        expect(statuses).toHaveLength(2);
        expect(statuses[0]?.watched).toBe(true);
        expect(statuses[1]?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getStats", () => {
    test("returns anime and episode counts", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const stats = repo.getStats();
        expect(stats.animeCount).toBe(0);
        expect(stats.episodeCount).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAll", () => {
    test("removes all anime, episodes, and episode groups", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: true,
        });

        repo.deleteAll();

        expect(repo.listAnime()).toHaveLength(0);
        expect(repo.getStats()).toEqual({ animeCount: 0, episodeCount: 0 });
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAllEpisodesWithAnime", () => {
    test("returns episodes with anime metadata and watched status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: true,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: false,
        });

        const rows = repo.getAllEpisodesWithAnime();
        expect(rows).toHaveLength(2);
        expect(rows[0]?.animeExternalId).toBe("tvdb-12345");
        expect(rows[0]?.animeSourceDb).toBe("tvdb");
        expect(rows[0]?.watched).toBe(true);
        expect(rows[1]?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("upsertEpisodeFromMatch", () => {
    test("inserts and updates episode from match data", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const first = repo.upsertEpisodeFromMatch({
          animeId: anime.id,
          groupId: group.id,
          episode: 1,
          filePath: "/media/old.mkv",
          title: "Old",
          season: 1,
        });

        const updated = repo.upsertEpisodeFromMatch({
          animeId: anime.id,
          groupId: group.id,
          episode: 1,
          filePath: "/media/new.mkv",
          title: "New",
          season: 1,
        });

        expect(updated.id).toBe(first.id);
        const ep = repo.getEpisode(updated.id);
        expect(ep?.filePath).toBe("/media/new.mkv");
        expect(ep?.title).toBe("New");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("migrateEpisodeWatched", () => {
    test("updates episode watched status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const ep = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        repo.migrateEpisodeWatched(ep.id, true);
        expect(repo.getEpisodeWatchStatus(ep.id)).toBe(true);

        repo.migrateEpisodeWatched(ep.id, false);
        expect(repo.getEpisodeWatchStatus(ep.id)).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("transaction", () => {
    test("wraps operations in a transaction", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const result = repo.transaction((tx) => {
          tx.upsertAnime({
            externalId: "tvdb-1",
            sourceDb: "tvdb",
            title: "Anime 1",
            episodeCount: 0,
          });
          tx.upsertAnime({
            externalId: "tvdb-2",
            sourceDb: "tvdb",
            title: "Anime 2",
            episodeCount: 0,
          });
          return tx.listAnime();
        });

        expect(result).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    test("rolls back on error", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        try {
          repo.transaction((tx) => {
            tx.upsertAnime({
              externalId: "tvdb-1",
              sourceDb: "tvdb",
              title: "Anime 1",
              episodeCount: 0,
            });
            throw new Error("rollback");
          });
        } catch {
          // expected
        }

        expect(repo.listAnime()).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("exportMatches", () => {
    test("returns empty array for empty library", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        expect(repo.exportMatches()).toEqual([]);
      } finally {
        sqlite.close();
      }
    });

    test("exports all anime with episodes as MatchEntry array", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
          watched: false,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime2.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          title: "To You, in 2000 Years",
          season: 1,
          watched: false,
        });

        const matches = repo.exportMatches();
        expect(matches).toHaveLength(3);

        const jjkMatches = matches.filter((m) => m.animeId === "tvdb-12345");
        expect(jjkMatches).toHaveLength(2);
        expect(jjkMatches[0]?.animeTitle).toBe("Jujutsu Kaisen");
        expect(jjkMatches[0]?.sourceDb).toBe("tvdb");
      } finally {
        sqlite.close();
      }
    });

    test("roundtrips through deleteAll and re-insert", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
          watched: false,
        });

        const exported = repo.exportMatches();
        expect(exported).toHaveLength(2);

        repo.deleteAll();

        for (const match of exported) {
          const created = repo.upsertAnime({
            externalId: match.animeId,
            sourceDb: match.sourceDb,
            title: match.animeTitle,
            episodeCount: 0,
          });
          const newGroup = repo.upsertEpisodeGroup({
            animeId: created.id,
            entryType: match.entryType,
            seasonNumber: match.season ?? 1,
            watchStatus: "plan_to_watch",
          });
          repo.upsertEpisodeFromMatch({
            animeId: created.id,
            groupId: newGroup.id,
            episode: match.episode,
            filePath: match.filePath,
            title: match.episodeTitle,
            season: match.season,
          });
          repo.updateEpisodeCount(created.id);
        }

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Jujutsu Kaisen");
        expect(animeList[0]?.episodeCount).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("episode groups", () => {
    test("creates and retrieves episode group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
          synopsis: "First season",
          rating: 8.5,
        });

        expect(group.id).toBeGreaterThan(0);
        expect(group.animeId).toBe(anime.id);
        expect(group.entryType).toBe("tv");
        expect(group.seasonNumber).toBe(1);
        expect(group.watchStatus).toBe("watching");
        expect(group.synopsis).toBe("First season");
        expect(group.rating).toBe(8.5);

        const retrieved = repo.getEpisodeGroup(group.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
      }
    });

    test("updates existing episode group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
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

        expect(updated.id).toBe(group.id);
        expect(updated.watchStatus).toBe("completed");
        expect(updated.rating).toBe(9.0);
      } finally {
        sqlite.close();
      }
    });

    test("returns all groups for anime sorted by season", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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

    test("finds group by anime, entryType, and season", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const found = repo.findEpisodeGroup(anime.id, "tv", 1);
        expect(found?.id).toBe(group.id);

        const notFound = repo.findEpisodeGroup(anime.id, "tv", 2);
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("group tracker mappings", () => {
    test("creates and retrieves tracker mapping", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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

    test("updates mapping on conflict", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group1.id,
          source: "mal",
          externalId: "12345",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group2.id,
          source: "mal",
          externalId: "12345",
        });

        const found = repo.findGroupByTrackerExternalId("mal", "12345");
        expect(found?.groupId).toBe(group2.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupStatus", () => {
    test("updates watch status of episode group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = repo.updateEpisodeGroupStatus(group.id, "completed");
        expect(updated?.watchStatus).toBe("completed");

        const retrieved = repo.getEpisodeGroup(group.id);
        expect(retrieved?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const result = repo.updateEpisodeGroupStatus(999, "watching");
        expect(result).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupMetadata", () => {
    test("updates metadata fields on episode group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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

        const retrieved = repo.getEpisodeGroup(group.id);
        expect(retrieved?.synopsis).toBe("Updated synopsis");
        expect(retrieved?.rating).toBe(9.5);
        expect(retrieved?.coverArtPath).toBe("/covers/new.jpg");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const result = repo.updateEpisodeGroupMetadata(999, { synopsis: "test" });
        expect(result).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteEpisodeGroup", () => {
    test("deletes episode group and cascades to episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        repo.deleteEpisodeGroup(group.id);

        expect(repo.getEpisodeGroup(group.id)).toBeNull();
        expect(repo.getEpisodesByAnimeId(anime.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getTrackerMapping", () => {
    test("returns single mapping for group and source", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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
  });

  describe("removeTrackerMappingsBySource", () => {
    test("removes all mappings for a given source", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group1.id,
          source: "mal",
          externalId: "111",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group2.id,
          source: "mal",
          externalId: "222",
        });
        repo.upsertGroupTrackerMapping({
          groupId: group1.id,
          source: "anilist",
          externalId: "333",
        });

        repo.removeTrackerMappingsBySource("mal");

        expect(repo.getTrackerMappingsByGroupId(group1.id)).toHaveLength(1);
        expect(repo.getTrackerMappingsByGroupId(group1.id)[0]?.source).toBe("anilist");
        expect(repo.getTrackerMappingsByGroupId(group2.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("removeTrackerMapping", () => {
    test("removes single mapping for group and source", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

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
  });

  describe("getEpisodesByGroupId", () => {
    test("returns episodes for a specific group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group1.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: true,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/S02E01.mkv",
          season: 2,
          watched: false,
        });

        const group1Episodes = repo.getEpisodesByGroupId(group1.id);
        expect(group1Episodes).toHaveLength(2);
        expect(group1Episodes[0]?.episodeNumber).toBe(1);
        expect(group1Episodes[1]?.episodeNumber).toBe(2);

        const group2Episodes = repo.getEpisodesByGroupId(group2.id);
        expect(group2Episodes).toHaveLength(1);
        expect(group2Episodes[0]?.episodeNumber).toBe(1);
      } finally {
        sqlite.close();
      }
    });
  });
});
