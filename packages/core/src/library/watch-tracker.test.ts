import { describe, expect, test } from "bun:test";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";
import { WatchTracker } from "./watch-tracker";

describe("WatchTracker", () => {
  describe("setEpisodeWatched", () => {
    test("sets watched status and records event", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
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

        const result = tracker.setEpisodeWatched(ep.id, true);
        expect(result?.watched).toBe(true);

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
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
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
          watched: true,
        });

        const result = tracker.setEpisodeWatched(ep.id, true);
        expect(result?.watched).toBe(true);

        const events = evtRepo.getUnpushed();
        expect(events).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns null for non-existent episode", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const result = tracker.setEpisodeWatched(999, true);
        expect(result).toBeNull();

        const events = evtRepo.getUnpushed();
        expect(events).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("updateEpisodeNotes", () => {
    test("updates notes and records event", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
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

        const result = tracker.updateEpisodeNotes(ep.id, "Great episode!");
        expect(result?.notes).toBe("Great episode!");

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
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
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
          notes: "Existing notes",
        });

        const result = tracker.updateEpisodeNotes(ep.id, "Existing notes");
        expect(result?.notes).toBe("Existing notes");

        const events = evtRepo.getUnpushed();
        expect(events).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getEpisodeWatchStatus", () => {
    test("returns watch status", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
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
          watched: true,
        });

        const status = tracker.getEpisodeWatchStatus(ep.id);
        expect(status).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns null for non-existent episode", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const status = tracker.getEpisodeWatchStatus(999);
        expect(status).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getEpisodeWatchStatusByAnimeId", () => {
    test("returns all episode statuses for anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 2,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const ep1 = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: true,
        });

        const ep2 = repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
          watched: false,
        });

        const statuses = tracker.getEpisodeWatchStatusByAnimeId(anime.id);
        expect(statuses).toHaveLength(2);
        expect(statuses.find((s) => s.episodeId === ep1.id)?.watched).toBe(true);
        expect(statuses.find((s) => s.episodeId === ep2.id)?.watched).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("setGroupWatchStatus", () => {
    test("sets status and records event", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const result = tracker.setGroupWatchStatus(group.id, "completed");
        expect(result?.watchStatus).toBe("completed");

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
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        const result = tracker.setGroupWatchStatus(group.id, "completed");
        expect(result?.watchStatus).toBe("completed");

        const events = evtRepo.getUnpushed();
        expect(events).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupMetadata", () => {
    test("updates synopsis and records event", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const result = tracker.updateEpisodeGroupMetadata(group.id, {
          synopsis: "New synopsis",
        });
        expect(result?.synopsis).toBe("New synopsis");

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

    test("updates rating and records event", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const result = tracker.updateEpisodeGroupMetadata(group.id, {
          rating: 9.5,
        });
        expect(result?.rating).toBe(9.5);

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
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const tracker = new WatchTracker({ library: repo, events: evtRepo });

        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
          synopsis: "Existing synopsis",
        });

        const result = tracker.updateEpisodeGroupMetadata(group.id, {
          synopsis: "Existing synopsis",
        });
        expect(result?.synopsis).toBe("Existing synopsis");

        const events = evtRepo.getUnpushed();
        expect(events).toHaveLength(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
