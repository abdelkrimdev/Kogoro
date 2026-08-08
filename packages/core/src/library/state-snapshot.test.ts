import { describe, expect, test } from "bun:test";
import { createEventDb } from "../events/test-utils";
import type { LocalWatchStatus } from "../tracker/credential-utils";
import { createLibraryRepos } from "./schema";
import {
  captureState,
  captureTrackerState,
  restoreEpisodeWatched,
  restoreTrackerData,
  type TrackerDataEntry,
} from "./state-snapshot";
import { createLibraryDb } from "./test-utils";

function createTestRepos() {
  const { db, sqlite } = createLibraryDb();
  const { sqlite: evtSqlite } = createEventDb();
  const repos = createLibraryRepos(db);
  return { ...repos, db, sqlite, evtSqlite };
}

describe("StateSnapshot", () => {
  describe("captureState", () => {
    test("captures episode watched status", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

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
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        expect(snapshot.episodeSnapshot.watched.size).toBe(2);
        expect(snapshot.episodeSnapshot.watched.get(1)).toBe(true);
        expect(snapshot.episodeSnapshot.watched.get(2)).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("captures group watch status", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
          synopsis: "Season 1",
          rating: 9.5,
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        const key = "al-jjk:tv:1";
        const groupState = snapshot.groupSnapshot.stateByKey.get(key);
        expect(groupState).toBeDefined();
        expect(groupState?.watchStatus).toBe("completed");
        expect(groupState?.synopsis).toBe("Season 1");
        expect(groupState?.rating).toBe(9.5);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("captures tracker mappings", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "mal-12345",
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        const key = "al-jjk:tv:1";
        const mappings = snapshot.groupSnapshot.mappingsByKey.get(key);
        expect(mappings).toBeDefined();
        expect(mappings).toHaveLength(1);
        expect(mappings?.[0]?.source).toBe("mal");
        expect(mappings?.[0]?.externalId).toBe("mal-12345");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("captures source mappings", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        const mappings = snapshot.sourceMappingByAnimeId.get(anime.id);
        expect(mappings).toBeDefined();
        expect(mappings).toHaveLength(1);
        expect(mappings?.[0]?.source).toBe("tvdb");
        expect(mappings?.[0]?.externalId).toBe("tvdb-12345");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("restoreEpisodeWatched", () => {
    test("restores watched status", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

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
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        episodeRepo.deleteAll();

        const newGroup = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const newEp1 = episodeRepo.addEpisode({
          groupId: newGroup.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        const newEp2 = episodeRepo.addEpisode({
          groupId: newGroup.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        restoreEpisodeWatched(episodeRepo, newEp1.id, 1, snapshot.episodeSnapshot);
        restoreEpisodeWatched(episodeRepo, newEp2.id, 2, snapshot.episodeSnapshot);

        const ep1 = episodeRepo.getEpisode(newEp1.id);
        const ep2 = episodeRepo.getEpisode(newEp2.id);

        expect(ep1?.watched).toBe(true);
        expect(ep2?.watched).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("restores notes", () => {
      const { animeRepo, episodeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

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
          watched: true,
          notes: "Great episode!",
        });

        const snapshot = captureState(animeRepo, episodeRepo, groupRepo);

        episodeRepo.deleteAll();

        const newGroup = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const newEp = episodeRepo.addEpisode({
          groupId: newGroup.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });

        restoreEpisodeWatched(episodeRepo, newEp.id, 1, snapshot.episodeSnapshot);

        const ep = episodeRepo.getEpisode(newEp.id);
        expect(ep?.notes).toBe("Great episode!");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("captureTrackerState", () => {
    test("captures local watch statuses", () => {
      const { animeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const { oldLocalStatuses } = captureTrackerState(animeRepo, groupRepo);

        expect(oldLocalStatuses.size).toBe(1);
        expect(oldLocalStatuses.get("al-jjk:tv:1")).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("captures tracker data", () => {
      const { animeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "mal-12345",
        });

        const { oldTrackerData } = captureTrackerState(animeRepo, groupRepo);

        expect(oldTrackerData.size).toBe(1);
        const entries = oldTrackerData.get("mal:mal-12345");
        expect(entries).toBeDefined();
        expect(entries?.[0]?.entryType).toBe("tv");
        expect(entries?.[0]?.seasonNumber).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips plan_to_watch status", () => {
      const { animeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const { oldLocalStatuses } = captureTrackerState(animeRepo, groupRepo);

        expect(oldLocalStatuses.size).toBe(0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("restoreTrackerData", () => {
    test("restores local watch statuses", () => {
      const { animeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const oldLocalStatuses = new Map<string, LocalWatchStatus>([["al-jjk:tv:1", "completed"]]);
        const oldTrackerData = new Map();

        restoreTrackerData(animeRepo, groupRepo, oldLocalStatuses, oldTrackerData);

        const updatedGroup = groupRepo.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("restores tracker mappings", () => {
      const { animeRepo, groupRepo, sqlite, evtSqlite } = createTestRepos();
      try {
        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "mal",
          externalId: "mal-12345",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const oldLocalStatuses = new Map();
        const oldTrackerData = new Map<string, TrackerDataEntry[]>([
          [
            "mal:mal-12345",
            [
              {
                source: "mal",
                externalId: "mal-12345",
                entryType: "tv",
                seasonNumber: 1,
              },
            ],
          ],
        ]);

        restoreTrackerData(animeRepo, groupRepo, oldLocalStatuses, oldTrackerData);

        const mapping = groupRepo.getTrackerMapping(group.id, "mal");
        expect(mapping).toBeDefined();
        expect(mapping?.externalId).toBe("mal-12345");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
