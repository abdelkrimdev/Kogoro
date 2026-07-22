import { describe, expect, test } from "bun:test";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { createEventRepository, createLibraryRepository, createMockTracker } from "../fixtures";
import { AnimeAggregate } from "../library/anime-aggregate";
import { WatchTracker } from "../library/watch-tracker";
import type { SyncConflict } from "./sync-engine";
import { SyncEngine } from "./sync-engine";

describe("SyncEngine", () => {
  describe("pull", () => {
    test("applies remote changes when no local events exist", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(1);
        expect(result.conflicts).toHaveLength(0);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("merges alternativeTitles from tracker into library", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          alternativeTitles: ["Shingeki no Kyojin"],
          episodeCount: 25,
          anilistId: "tracker-1",
        });

        aggregate.library.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "tracker-1",
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                alternativeTitles: ["Shingeki no Kyojin", "進撃の巨人"],
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(1);

        const updatedAnime = libraryRepo.findAnime("tracker-1", "anilist");
        expect(updatedAnime?.alternativeTitles).toEqual(["Shingeki no Kyojin", "進撃の巨人"]);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("deduplicates alternativeTitles when merging", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          alternativeTitles: ["Shingeki no Kyojin", "進撃の巨人"],
          episodeCount: 25,
          anilistId: "tracker-1",
        });

        aggregate.library.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "tracker-1",
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                alternativeTitles: ["Shingeki no Kyojin", "AOT"],
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(1);

        const updatedAnime = libraryRepo.findAnime("tracker-1", "anilist");
        expect(updatedAnime?.alternativeTitles).toEqual([
          "Shingeki no Kyojin",
          "進撃の巨人",
          "AOT",
        ]);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("flags conflict when local events exist for entity", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(0);
        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]?.groupId).toBe(group.id);
        expect(result.conflicts[0]?.tracker).toBe("anilist");
        expect(result.conflicts[0]?.localChange).toBeTruthy();
        expect(result.conflicts[0]?.remoteChange).toBeTruthy();

        const unchangedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(unchangedGroup?.watchStatus).toBe("watching");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("pulls only tracked entries for this tracker", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime1 = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group1 = aggregate.library.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group1.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const anime2 = aggregate.library.upsertAnime({
          title: "Death Note",
          episodeCount: 37,
        });

        const group2 = aggregate.library.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group2.id,
          source: "mal",
          externalId: "tl-2",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(1);

        const updatedGroup1 = aggregate.library.getEpisodeGroup(group1.id);
        expect(updatedGroup1?.watchStatus).toBe("completed");

        const unchangedGroup2 = aggregate.library.getEpisodeGroup(group2.id);
        expect(unchangedGroup2?.watchStatus).toBe("plan_to_watch");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("does not flag conflict for already-pushed events", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const event1 = eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        eventRepo.markPushedForSource([event1.id], "anilist");

        const tracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(1);
        expect(result.conflicts).toHaveLength(0);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("handles multiple entries from tracker", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime1 = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group1 = aggregate.library.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group1.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const anime2 = aggregate.library.upsertAnime({
          title: "Death Note",
          episodeCount: 37,
        });

        const group2 = aggregate.library.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group2.id,
          source: "anilist",
          externalId: "tl-2",
        });

        const tracker = createMockTracker({
          async getUserList() {
            return [
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
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.pull();

        expect(result.applied).toBe(2);
        expect(result.conflicts).toHaveLength(0);

        const updatedGroup1 = aggregate.library.getEpisodeGroup(group1.id);
        expect(updatedGroup1?.watchStatus).toBe("completed");

        const updatedGroup2 = aggregate.library.getEpisodeGroup(group2.id);
        expect(updatedGroup2?.watchStatus).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });
  });

  describe("push", () => {
    test("sends unpushed events to tracker and marks them as pushed", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        let updateCalled = false;
        let updateArgs: { trackerId: string; changes: { watchStatus?: string } } = {
          trackerId: "",
          changes: {},
        };

        const tracker = createMockTracker({
          async updateEntry(trackerId: string, changes: { watchStatus?: string }) {
            updateCalled = true;
            updateArgs = { trackerId, changes };
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.push();

        expect(result.pushed).toBe(1);
        expect(updateCalled).toBe(true);
        expect(updateArgs?.trackerId).toBe("tl-1");
        expect(updateArgs?.changes.watchStatus).toBe("completed");

        const unpushedAfter = eventRepo.getUnpushed("anilist");
        expect(unpushedAfter).toHaveLength(0);

        const allEvents = eventRepo.replay();
        expect(allEvents[0]?.pushed).toContain("anilist");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("does not push events already pushed to this tracker", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const event1 = eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        eventRepo.markPushedForSource([event1.id], "anilist");

        let updateCalled = false;

        const tracker = createMockTracker({
          async updateEntry() {
            updateCalled = true;
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.push();

        expect(result.pushed).toBe(0);
        expect(updateCalled).toBe(false);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("pushes to all connected trackers for multi-tracker support", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-anilist-1",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "tl-mal-1",
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        const updateCalls: string[] = [];

        const tracker = createMockTracker({
          async updateEntry(trackerId: string) {
            updateCalls.push(trackerId);
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.push();

        expect(result.pushed).toBe(1);
        expect(updateCalls).toContain("tl-anilist-1");
        expect(updateCalls).toContain("tl-mal-1");

        const unpushedAnilist = eventRepo.getUnpushed("anilist");
        expect(unpushedAnilist).toHaveLength(0);

        const unpushedMal = eventRepo.getUnpushed("mal");
        expect(unpushedMal).toHaveLength(0);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("pushes watched_toggle event with correct episodesWatched", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        libraryRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/ep1.mkv",
          watched: true,
        });
        libraryRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/ep2.mkv",
          watched: true,
        });
        libraryRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 3,
          filePath: "/ep3.mkv",
          watched: false,
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        let capturedChanges: { watchStatus?: string; episodesWatched?: number } = {};

        const tracker = createMockTracker({
          async updateEntry(
            _trackerId: string,
            changes: { watchStatus?: string; episodesWatched?: number },
          ) {
            capturedChanges = changes;
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.push();

        expect(result.pushed).toBe(1);
        expect(capturedChanges.episodesWatched).toBe(2);
        expect(capturedChanges.watchStatus).toBeUndefined();
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("merges status_change and watched_toggle into single update", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        libraryRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/ep1.mkv",
          watched: true,
        });
        libraryRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/ep2.mkv",
          watched: true,
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });
        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "watched_toggle",
          oldValue: "false",
          newValue: "true",
        });

        let capturedChanges: { watchStatus?: string; episodesWatched?: number } = {};

        const tracker = createMockTracker({
          async updateEntry(
            _trackerId: string,
            changes: { watchStatus?: string; episodesWatched?: number },
          ) {
            capturedChanges = changes;
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");
        const result = await syncEngine.push();

        expect(result.pushed).toBe(2);
        expect(capturedChanges.watchStatus).toBe("completed");
        expect(capturedChanges.episodesWatched).toBe(2);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });
  });

  describe("resolveConflict", () => {
    test("keeps local version when resolving with keepLocal", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        const tracker = createMockTracker();
        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");

        const conflict: SyncConflict = {
          groupId: group.id,
          tracker: "anilist",
          localChange: {
            eventType: "status_change",
            oldValue: "watching",
            newValue: "completed",
          },
          remoteChange: {
            watchStatus: "completed",
            episodesWatched: 25,
          },
        };

        const result = await syncEngine.resolveConflict(conflict, "keepLocal");

        expect(result.success).toBe(true);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("watching");

        const unpushedEvents = eventRepo.getUnpushed("anilist");
        expect(unpushedEvents).toHaveLength(1);
        expect(unpushedEvents[0]?.newValue).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("applies remote version when resolving with acceptRemote", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        eventRepo.append({
          entityType: "group",
          entityId: group.id,
          eventType: "status_change",
          oldValue: "watching",
          newValue: "completed",
        });

        const tracker = createMockTracker();
        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");

        const conflict: SyncConflict = {
          groupId: group.id,
          tracker: "anilist",
          localChange: {
            eventType: "status_change",
            oldValue: "watching",
            newValue: "completed",
          },
          remoteChange: {
            watchStatus: "completed",
            episodesWatched: 25,
          },
        };

        const result = await syncEngine.resolveConflict(conflict, "acceptRemote");

        expect(result.success).toBe(true);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const unpushedEvents = eventRepo.getUnpushed("anilist");
        expect(unpushedEvents).toHaveLength(0);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });
  });

  describe("syncAll", () => {
    test("pulls from multiple trackers and pushes pending events", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-anilist-1",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "tl-mal-1",
        });

        const anilistTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-anilist-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const malTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "mal",
                trackerId: "tl-mal-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "watching",
                episodesWatched: 10,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, [
          { source: "anilist", tracker: anilistTracker },
          { source: "mal", tracker: malTracker },
        ]);

        const result = await syncEngine.syncAll();

        expect(result.applied).toBeGreaterThanOrEqual(1);
        expect(result.syncedTrackers).toContain("anilist");
        expect(result.syncedTrackers).toContain("mal");
        expect(result.errors).toHaveLength(0);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("watching");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("detects cross-tracker conflicts when watch statuses differ", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-anilist-1",
        });

        aggregate.library.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "tl-mal-1",
        });

        const anilistTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-anilist-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "completed",
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const malTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "mal",
                trackerId: "tl-mal-1",
                title: "Attack on Titan",
                entryType: "tv",
                watchStatus: "watching",
                episodesWatched: 10,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, [
          { source: "anilist", tracker: anilistTracker },
          { source: "mal", tracker: malTracker },
        ]);

        const result = await syncEngine.syncAll();

        expect(result.crossTrackerConflicts).toHaveLength(1);
        expect(result.crossTrackerConflicts[0]?.groupId).toBe(group.id);
        expect(result.crossTrackerConflicts[0]?.trackerA).toBe("anilist");
        expect(result.crossTrackerConflicts[0]?.trackerB).toBe("mal");
        expect(result.crossTrackerConflicts[0]?.statusA).toBe("completed");
        expect(result.crossTrackerConflicts[0]?.statusB).toBe("watching");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("reports errors when tracker getUserList fails", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const workingTracker = createMockTracker({
          async getUserList() {
            return [];
          },
        });

        const failingTracker = createMockTracker({
          async getUserList() {
            throw new Error("Network error");
          },
        });

        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, [
          { source: "anilist", tracker: workingTracker },
          { source: "mal", tracker: failingTracker },
        ]);

        const result = await syncEngine.syncAll();

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.tracker).toBe("mal");
        expect(result.errors[0]?.error).toContain("Network error");
        expect(result.syncedTrackers).toContain("anilist");
        expect(result.syncedTrackers).not.toContain("mal");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });
  });

  describe("resolveCrossTrackerConflict", () => {
    test("applies status from tracker A when resolving with keepTrackerA", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTracker();
        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");

        const conflict = {
          groupId: group.id,
          trackerA: "anilist",
          trackerB: "mal",
          statusA: "completed" as const,
          statusB: "watching" as const,
        };

        const result = await syncEngine.resolveCrossTrackerConflict(conflict, "keepTrackerA");

        expect(result.success).toBe(true);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("applies status from tracker B when resolving with keepTrackerB", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const anime = aggregate.library.upsertAnime({
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = aggregate.library.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTracker();
        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");

        const conflict = {
          groupId: group.id,
          trackerA: "anilist",
          trackerB: "mal",
          statusA: "completed" as const,
          statusB: "watching" as const,
        };

        const result = await syncEngine.resolveCrossTrackerConflict(conflict, "keepTrackerB");

        expect(result.success).toBe(true);

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("watching");
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });

    test("returns false when group does not exist", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const evtRepo = new EventRepository(evtDb);
        const aggregate = new AnimeAggregate({
          library: libraryRepo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });
        const watchTracker = new WatchTracker({ library: libraryRepo, events: evtRepo });

        const tracker = createMockTracker();
        const syncEngine = new SyncEngine(aggregate, watchTracker, eventRepo, tracker, "anilist");

        const conflict = {
          groupId: 99999,
          trackerA: "anilist",
          trackerB: "mal",
          statusA: "completed" as const,
          statusB: "watching" as const,
        };

        const result = await syncEngine.resolveCrossTrackerConflict(conflict, "keepTrackerA");

        expect(result.success).toBe(false);
      } finally {
        closeLibrary();
        closeEvent();
        evtSqlite.close();
      }
    });
  });
});
