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
          entryType: "tv",
          episodeCount: 24,
        });

        expect(anime.id).toBeGreaterThan(0);
        expect(anime.externalId).toBe("tvdb-12345");
        expect(anime.sourceDb).toBe("tvdb");
        expect(anime.title).toBe("Jujutsu Kaisen");
        expect(anime.titleJapanese).toBe("呪術廻戦");
        expect(anime.entryType).toBe("tv");
        expect(anime.episodeCount).toBe(24);
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
          entryType: "tv",
          episodeCount: 24,
        });

        const updated = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen Season 2",
          entryType: "tv",
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
          entryType: "tv",
          episodeCount: 24,
          lastSynced: "2026-01-01T00:00:00.000Z",
        });

        expect(anime.lastSynced).toBe("2026-01-01T00:00:00.000Z");
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
          entryType: "tv",
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
          entryType: "tv",
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
          entryType: "tv",
          episodeCount: 12,
        });
        repo.upsertAnime({
          externalId: "tvdb-2",
          sourceDb: "tvdb",
          title: "A anime",
          entryType: "movie",
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
          entryType: "tv",
          episodeCount: 24,
        });

        repo.addEpisode({ animeId: anime.id, episodeNumber: 1, filePath: "/media/S01E01.mkv" });
        repo.addEpisode({ animeId: anime.id, episodeNumber: 2, filePath: "/media/S01E02.mkv" });

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
          entryType: "tv",
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
          entryType: "tv",
          episodeCount: 24,
        });

        const first = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/old-path.mkv",
          title: "Old Title",
          season: 1,
        });

        const updated = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/new-path.mkv",
          title: "New Title",
          season: 1,
        });

        expect(updated.id).toBe(first.id);
        expect(updated.filePath).toBe("/media/new-path.mkv");
        expect(updated.title).toBe("New Title");
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
          entryType: "tv",
          episodeCount: 24,
        });

        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
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
          entryType: "tv",
          episodeCount: 24,
        });

        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
        });

        repo.deleteEpisodesByAnimeId(anime.id);
        expect(repo.getEpisodesByAnimeId(anime.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("watch status", () => {
    test("creates and retrieves watch status for episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        const status = repo.setWatchStatus(ep.id, true, "Great episode!");
        expect(status.episodeId).toBe(ep.id);
        expect(status.watched).toBe(true);
        expect(status.notes).toBe("Great episode!");
        expect(status.updatedAt).toBeTruthy();

        const retrieved = repo.getWatchStatus(ep.id);
        expect(retrieved?.watched).toBe(true);
        expect(retrieved?.notes).toBe("Great episode!");
      } finally {
        sqlite.close();
      }
    });

    test("updates existing status for episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        repo.setWatchStatus(ep.id, true, "First note");
        const updated = repo.setWatchStatus(ep.id, false, "Changed mind");

        expect(updated.watched).toBe(false);
        expect(updated.notes).toBe("Changed mind");
      } finally {
        sqlite.close();
      }
    });

    test("returns all statuses for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep1 = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        const ep2 = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
        });

        repo.setWatchStatus(ep1.id, true);
        repo.setWatchStatus(ep2.id, false);

        const statuses = repo.getWatchStatusByAnimeId(anime.id);
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
    test("removes all anime, episodes, and watch statuses", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        repo.setWatchStatus(ep.id, true);

        repo.deleteAll();

        expect(repo.listAnime()).toHaveLength(0);
        expect(repo.getStats()).toEqual({ animeCount: 0, episodeCount: 0 });
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAllEpisodesWithAnime", () => {
    test("returns episodes with anime metadata and watch status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep1 = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
        });
        repo.setWatchStatus(ep1.id, true, "Great pilot");

        const rows = repo.getAllEpisodesWithAnime();
        expect(rows).toHaveLength(2);
        expect(rows[0]?.animeExternalId).toBe("tvdb-12345");
        expect(rows[0]?.animeSourceDb).toBe("tvdb");
        expect(rows[0]?.watched).toBe(true);
        expect(rows[0]?.notes).toBe("Great pilot");
        expect(rows[1]?.watched).toBeNull();
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
          entryType: "tv",
          episodeCount: 24,
        });

        const first = repo.upsertEpisodeFromMatch({
          animeId: anime.id,
          episode: 1,
          filePath: "/media/old.mkv",
          title: "Old",
          season: 1,
        });

        const updated = repo.upsertEpisodeFromMatch({
          animeId: anime.id,
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

  describe("migrateWatchStatus", () => {
    test("inserts watch status with on-conflict update", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        repo.migrateWatchStatus(ep.id, true, "Migrated", "2026-01-01T00:00:00.000Z");
        const status = repo.getWatchStatus(ep.id);
        expect(status?.watched).toBe(true);
        expect(status?.notes).toBe("Migrated");

        repo.migrateWatchStatus(ep.id, false, "Changed", "2026-01-02T00:00:00.000Z");
        const updated = repo.getWatchStatus(ep.id);
        expect(updated?.watched).toBe(false);
        expect(updated?.notes).toBe("Changed");
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
            entryType: "tv",
            episodeCount: 0,
          });
          tx.upsertAnime({
            externalId: "tvdb-2",
            sourceDb: "tvdb",
            title: "Anime 2",
            entryType: "tv",
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
              entryType: "tv",
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
          entryType: "tv",
          episodeCount: 24,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          entryType: "tv",
          episodeCount: 25,
        });
        repo.addEpisode({
          animeId: anime2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          title: "To You, in 2000 Years",
          season: 1,
        });

        const matches = repo.exportMatches();
        expect(matches).toHaveLength(3);

        const jjkMatches = matches.filter((m) => m.animeId === "tvdb-12345");
        expect(jjkMatches).toHaveLength(2);
        expect(jjkMatches[0]?.animeTitle).toBe("Jujutsu Kaisen");
        expect(jjkMatches[0]?.entryType).toBe("tv");
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
          entryType: "tv",
          episodeCount: 24,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const exported = repo.exportMatches();
        expect(exported).toHaveLength(2);

        repo.deleteAll();

        for (const match of exported) {
          const created = repo.upsertAnime({
            externalId: match.animeId,
            sourceDb: match.sourceDb,
            title: match.animeTitle,
            entryType: match.entryType,
            episodeCount: 0,
          });
          repo.upsertEpisodeFromMatch({
            animeId: created.id,
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
});
