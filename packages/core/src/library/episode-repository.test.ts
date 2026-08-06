import { describe, expect, test } from "bun:test";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { AnimeRepository } from "./anime-repository";
import { EpisodeRepository } from "./episode-repository";
import { GroupRepository } from "./group-repository";
import { createLibraryDb } from "./test-utils";

describe("EpisodeRepository", () => {
  function setupGroup(db: ReturnType<typeof createLibraryDb>["db"]) {
    const animeRepo = new AnimeRepository({ db });
    const groupRepo = new GroupRepository({ db });
    const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
    const group = groupRepo.upsertEpisodeGroup({
      animeId: anime.id,
      entryType: "tv",
      seasonNumber: 1,
      watchStatus: "plan_to_watch",
    });
    return { anime, group };
  }

  describe("addEpisode", () => {
    test("inserts episode and returns it with generated id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        expect(ep.id).toBeGreaterThan(0);
        expect(ep.groupId).toBe(group.id);
        expect(ep.episodeNumber).toBe(1);
        expect(ep.filePath).toBe("/media/S01E01.mkv");
        expect(ep.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("upserts on duplicate (groupId, episodeNumber)", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const first = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/old.mkv",
          title: "Old",
          watched: false,
        });

        const updated = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/new.mkv",
          title: "New",
          watched: true,
        });

        expect(updated.id).toBe(first.id);
        expect(updated.filePath).toBe("/media/new.mkv");
        expect(updated.title).toBe("New");
        expect(updated.watched).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("persists notes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
          notes: "Great episode!",
        });

        expect(ep.notes).toBe("Great episode!");
        const retrieved = repo.getEpisode(ep.id);
        expect(retrieved?.notes).toBe("Great episode!");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisode", () => {
    test("retrieves episode by id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const created = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const retrieved = repo.getEpisode(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.filePath).toBe("/media/S01E01.mkv");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        expect(repo.getEpisode(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodesByAnimeId", () => {
    test("returns episodes sorted by episode number", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });
        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const eps = repo.getEpisodesByAnimeId(group.animeId);
        expect(eps).toHaveLength(2);
        expect(eps[0]?.episodeNumber).toBe(1);
        expect(eps[1]?.episodeNumber).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodesByGroupId", () => {
    test("returns episodes for specific group", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const groupRepo = new GroupRepository({ db });
        const animeRepo = new AnimeRepository({ db });
        const anime = animeRepo.upsertAnime({ title: "Test" });

        const g1 = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        const g2 = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "plan_to_watch",
        });

        repo.addEpisode({
          groupId: g1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        repo.addEpisode({
          groupId: g1.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });
        repo.addEpisode({
          groupId: g2.id,
          episodeNumber: 1,
          filePath: "/media/S02E01.mkv",
          watched: false,
        });

        const g1Eps = repo.getEpisodesByGroupId(g1.id);
        expect(g1Eps).toHaveLength(2);

        const g2Eps = repo.getEpisodesByGroupId(g2.id);
        expect(g2Eps).toHaveLength(1);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteEpisodesByAnimeId", () => {
    test("removes all episodes for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { anime, group } = setupGroup(db);

        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        repo.deleteEpisodesByAnimeId(anime.id);
        expect(repo.getEpisodesByAnimeId(anime.id)).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteEpisodesByIds", () => {
    test("removes episodes by ids", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep1 = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        const ep2 = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        repo.deleteEpisodesByIds([ep1.id]);
        expect(repo.getEpisode(ep1.id)).toBeNull();
        expect(repo.getEpisode(ep2.id)).not.toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("does nothing for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        repo.deleteEpisodesByIds([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("setEpisodeWatched", () => {
    test("sets watched status and returns episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const updated = repo.setEpisodeWatched(ep.id, true);
        expect(updated?.watched).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("updates existing watched status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: true,
        });

        const updated = repo.setEpisodeWatched(ep.id, false);
        expect(updated?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("setEpisodeNotes", () => {
    test("sets notes and returns episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        const updated = repo.setEpisodeNotes(ep.id, "Great episode!");
        expect(updated?.notes).toBe("Great episode!");
      } finally {
        sqlite.close();
      }
    });

    test("clears notes with empty string", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
          notes: "Some notes",
        });

        const cleared = repo.setEpisodeNotes(ep.id, "");
        expect(cleared?.notes).toBeUndefined();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodeWatchStatus", () => {
    test("returns watch status", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: true,
        });

        expect(repo.getEpisodeWatchStatus(ep.id)).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        expect(repo.getEpisodeWatchStatus(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodeWatchStatusByAnimeId", () => {
    test("returns all watched statuses for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep1 = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: true,
        });
        const ep2 = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const statuses = repo.getEpisodeWatchStatusByAnimeId(group.animeId);
        expect(statuses).toHaveLength(2);
        expect(statuses.find((s) => s.episodeId === ep1.id)?.watched).toBe(true);
        expect(statuses.find((s) => s.episodeId === ep2.id)?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("upsertEpisodeFromMatch", () => {
    test("inserts episode from match data", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const result = repo.upsertEpisodeFromMatch({
          groupId: group.id,
          episode: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
        });

        expect(result.id).toBeGreaterThan(0);
        const ep = repo.getEpisode(result.id);
        expect(ep?.filePath).toBe("/media/S01E01.mkv");
        expect(ep?.title).toBe("Ryomen Sukuna");
      } finally {
        sqlite.close();
      }
    });

    test("updates existing episode on conflict", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const first = repo.upsertEpisodeFromMatch({
          groupId: group.id,
          episode: 1,
          filePath: "/media/old.mkv",
          title: "Old",
        });

        const updated = repo.upsertEpisodeFromMatch({
          groupId: group.id,
          episode: 1,
          filePath: "/media/new.mkv",
          title: "New",
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
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
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

  describe("migrateEpisodeNotes", () => {
    test("updates episode notes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        const ep = repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        repo.migrateEpisodeNotes(ep.id, "Migrated notes");
        expect(repo.getEpisode(ep.id)?.notes).toBe("Migrated notes");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getEpisodeCountByAnimeId", () => {
    test("returns episode count", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { anime, group } = setupGroup(db);

        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        expect(repo.getEpisodeCountByAnimeId(anime.id)).toBe(2);
      } finally {
        sqlite.close();
      }
    });

    test("returns 0 for anime with no episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { anime } = setupGroup(db);
        expect(repo.getEpisodeCountByAnimeId(anime.id)).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAllEpisodesWithAnime", () => {
    test("returns episodes with anime metadata", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { anime, group } = setupGroup(db);

        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: true,
        });
        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const rows = repo.getAllEpisodesWithAnime();
        expect(rows).toHaveLength(2);
        expect(rows[0]?.animeId).toBe(anime.id);
        expect(rows[0]?.watched).toBe(true);
        expect(rows[1]?.watched).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAll", () => {
    test("removes all episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new EpisodeRepository({ db });
        const { group } = setupGroup(db);

        repo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        repo.deleteAll();
        expect(repo.getEpisodesByGroupId(group.id)).toHaveLength(0);
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
      const repo = new EpisodeRepository({ db, events: evtRepo });
      const animeRepo = new AnimeRepository({ db });
      const groupRepo = new GroupRepository({ db });
      const anime = animeRepo.upsertAnime({ title: "Test" });
      const group = groupRepo.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: "tv",
        seasonNumber: 1,
        watchStatus: "plan_to_watch",
      });
      return { db, repo, evtRepo, sqlite, evtSqlite, group };
    }

    describe("setEpisodeWatched", () => {
      test("records event when status changes", () => {
        const { repo, evtRepo, sqlite, evtSqlite, group } = setupWithEvents();
        try {
          const ep = repo.addEpisode({
            groupId: group.id,
            episodeNumber: 1,
            filePath: "/media/S01E01.mkv",
            watched: false,
          });

          repo.setEpisodeWatched(ep.id, true);

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({
            entityType: "episode",
            entityId: ep.id,
            eventType: "watched_toggle",
            oldValue: "false",
            newValue: "true",
          });
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("does not record event when status unchanged", () => {
        const { repo, evtRepo, sqlite, evtSqlite, group } = setupWithEvents();
        try {
          const ep = repo.addEpisode({
            groupId: group.id,
            episodeNumber: 1,
            filePath: "/media/S01E01.mkv",
            watched: true,
          });

          repo.setEpisodeWatched(ep.id, true);

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
          const repo = new EpisodeRepository({ db });
          const animeRepo = new AnimeRepository({ db });
          const groupRepo = new GroupRepository({ db });
          const anime = animeRepo.upsertAnime({ title: "Test" });
          const group = groupRepo.upsertEpisodeGroup({
            animeId: anime.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });
          const ep = repo.addEpisode({
            groupId: group.id,
            episodeNumber: 1,
            filePath: "/media/S01E01.mkv",
            watched: false,
          });

          const result = repo.setEpisodeWatched(ep.id, true);
          expect(result?.watched).toBe(true);
        } finally {
          sqlite.close();
        }
      });
    });

    describe("setEpisodeNotes", () => {
      test("records event when notes change", () => {
        const { repo, evtRepo, sqlite, evtSqlite, group } = setupWithEvents();
        try {
          const ep = repo.addEpisode({
            groupId: group.id,
            episodeNumber: 1,
            filePath: "/media/S01E01.mkv",
            watched: false,
          });

          repo.setEpisodeNotes(ep.id, "Great episode!");

          const events = evtRepo.getUnpushed();
          expect(events).toHaveLength(1);
          expect(events[0]).toMatchObject({
            entityType: "episode",
            entityId: ep.id,
            eventType: "notes_update",
            oldValue: null,
            newValue: "Great episode!",
          });
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      });

      test("does not record event when notes unchanged", () => {
        const { repo, evtRepo, sqlite, evtSqlite, group } = setupWithEvents();
        try {
          const ep = repo.addEpisode({
            groupId: group.id,
            episodeNumber: 1,
            filePath: "/media/S01E01.mkv",
            watched: false,
            notes: "Existing notes",
          });

          repo.setEpisodeNotes(ep.id, "Existing notes");

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
