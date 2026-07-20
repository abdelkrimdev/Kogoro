import { describe, expect, test } from "bun:test";
import { createEventRepository, createLibraryRepository, createMockTracker } from "../fixtures";
import { AnimeAggregate } from "../library/anime-aggregate";
import { WatchTracker } from "../library/watch-tracker";
import type { TrackerPlugin, TrackerSource, TrackerWatchStatus } from "../types";
import { SyncOrchestrator } from "./sync-orchestrator";

function createTrackerPair(
  source: TrackerSource,
  tracker: TrackerPlugin,
): { source: TrackerSource; tracker: TrackerPlugin } {
  return { source, tracker };
}

describe("SyncOrchestrator", () => {
  describe("syncAll", () => {
    test("pulls from all trackers before pushing to any", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const anime = aggregate.library.upsertAnime({
          externalId: "anime-1",
          sourceDb: "anilist",
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

        const callOrder: string[] = [];

        const anilistTracker = createMockTracker({
          async getUserList() {
            callOrder.push("pull-anilist");
            return [
              {
                source: "anilist",
                trackerId: "tl-anilist-1",
                title: "Attack on Titan",
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
          async updateEntry() {
            callOrder.push("push");
          },
        });

        const malTracker = createMockTracker({
          async getUserList() {
            callOrder.push("pull-mal");
            return [
              {
                source: "mal",
                trackerId: "tl-mal-1",
                title: "Attack on Titan",
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
          async updateEntry() {
            callOrder.push("push");
          },
        });

        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, [
          createTrackerPair("anilist", anilistTracker),
          createTrackerPair("mal", malTracker),
        ]);

        const result = await orchestrator.syncAll();

        expect(result.errors).toHaveLength(0);
        expect(result.syncedTrackers).toContain("anilist");
        expect(result.syncedTrackers).toContain("mal");

        const pullAnilistIdx = callOrder.indexOf("pull-anilist");
        const pullMalIdx = callOrder.indexOf("pull-mal");
        const firstPushIdx = callOrder.indexOf("push");

        expect(pullAnilistIdx).toBeLessThan(firstPushIdx);
        expect(pullMalIdx).toBeLessThan(firstPushIdx);
      } finally {
        closeLibrary();
        closeEvent();
      }
    });

    test("returns empty result when no trackers provided", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, []);

        const result = await orchestrator.syncAll();

        expect(result.applied).toBe(0);
        expect(result.conflicts).toHaveLength(0);
        expect(result.syncedTrackers).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      } finally {
        closeLibrary();
        closeEvent();
      }
    });

    test("isolates tracker errors without blocking others", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const anime = aggregate.library.upsertAnime({
          externalId: "anime-1",
          sourceDb: "anilist",
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

        const failingTracker = createMockTracker({
          async getUserList() {
            throw new Error("Network timeout");
          },
        });

        const successTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "mal",
                trackerId: "tl-mal-1",
                title: "Attack on Titan",
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, [
          createTrackerPair("anilist", failingTracker),
          createTrackerPair("mal", successTracker),
        ]);

        const result = await orchestrator.syncAll();

        expect(result.applied).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]?.tracker).toBe("anilist");
        expect(result.errors[0]?.error).toContain("Network timeout");
        expect(result.syncedTrackers).toContain("mal");
        expect(result.syncedTrackers).not.toContain("anilist");

        const updatedGroup = aggregate.library.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        closeLibrary();
        closeEvent();
      }
    });

    test("detects cross-tracker conflict when trackers disagree", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const anime = aggregate.library.upsertAnime({
          externalId: "anime-1",
          sourceDb: "anilist",
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

        const anilistTracker = createMockTracker({
          async getUserList() {
            return [
              {
                source: "anilist",
                trackerId: "tl-anilist-1",
                title: "Attack on Titan",
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
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
                entryType: "tv" as const,
                watchStatus: "dropped" as TrackerWatchStatus,
                episodesWatched: 10,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, [
          createTrackerPair("anilist", anilistTracker),
          createTrackerPair("mal", malTracker),
        ]);

        const result = await orchestrator.syncAll();

        expect(result.crossTrackerConflicts).toHaveLength(1);
        expect(result.crossTrackerConflicts[0]?.groupId).toBe(group.id);
        expect(result.crossTrackerConflicts[0]?.trackerA).toBe("anilist");
        expect(result.crossTrackerConflicts[0]?.trackerB).toBe("mal");
        expect(result.crossTrackerConflicts[0]?.statusA).toBe("completed");
        expect(result.crossTrackerConflicts[0]?.statusB).toBe("dropped");
      } finally {
        closeLibrary();
        closeEvent();
      }
    });

    test("does not report cross-tracker conflict when trackers agree", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const anime = aggregate.library.upsertAnime({
          externalId: "anime-1",
          sourceDb: "anilist",
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
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
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
                entryType: "tv" as const,
                watchStatus: "completed" as TrackerWatchStatus,
                episodesWatched: 25,
                totalEpisodes: 25,
              },
            ];
          },
        });

        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, [
          createTrackerPair("anilist", anilistTracker),
          createTrackerPair("mal", malTracker),
        ]);

        const result = await orchestrator.syncAll();

        expect(result.crossTrackerConflicts).toHaveLength(0);
      } finally {
        closeLibrary();
        closeEvent();
      }
    });

    test("pushes local changes to trackers", async () => {
      const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
      const { repo: eventRepo, close: closeEvent } = createEventRepository();
      const aggregate = new AnimeAggregate({
        library: libraryRepo,
        replayUnpushedEvents: () => {},
        computeAndPersistLibraryState: () => {},
      });
      const watchTracker = new WatchTracker({ library: libraryRepo, events: eventRepo });
      try {
        const anime = aggregate.library.upsertAnime({
          externalId: "anime-1",
          sourceDb: "anilist",
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

        const anilistTracker = createMockTracker({
          async getUserList() {
            return [];
          },
          async updateEntry(trackerId: string) {
            updateCalls.push(`anilist:${trackerId}`);
          },
        });

        const malTracker = createMockTracker({
          async getUserList() {
            return [];
          },
          async updateEntry(trackerId: string) {
            updateCalls.push(`mal:${trackerId}`);
          },
        });

        const orchestrator = new SyncOrchestrator(aggregate, watchTracker, eventRepo, [
          createTrackerPair("anilist", anilistTracker),
          createTrackerPair("mal", malTracker),
        ]);

        const result = await orchestrator.syncAll();

        expect(result.pushed).toBeGreaterThanOrEqual(1);
        expect(updateCalls.length).toBeGreaterThan(0);
      } finally {
        closeLibrary();
        closeEvent();
      }
    });
  });
});
