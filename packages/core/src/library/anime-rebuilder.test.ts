import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEventDb } from "../events/test-utils";
import { createMockIdentityResolver, createMockTracker } from "../fixtures";
import type { MatchEntry } from "../types";
import { AnimeRebuilder } from "./anime-rebuilder";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

function createRebuilder(db: ReturnType<typeof createLibraryDb>["db"]) {
  const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);
  return {
    rebuilder: new AnimeRebuilder({
      anime: animeRepo,
      episodes: episodeRepo,
      groups: groupRepo,
      replayUnpushedEvents: () => {},
      identityResolver: createMockIdentityResolver(),
      franchiseService: undefined,
    }),
    animeRepo,
    episodeRepo,
    groupRepo,
  };
}

describe("AnimeRebuilder", () => {
  describe("rebuildFromMatches", () => {
    test("clears existing data and rebuilds from matches", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        animeRepo.upsertAnime({ title: "Old Anime" });

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-67890",
            animeTitle: "Attack on Titan",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/Attack on Titan/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const animeList = animeRepo.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = animeRepo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.title).toBe("Jujutsu Kaisen");
        expect(episodeRepo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(2);

        const aot = animeRepo.findAnime("tvdb-67890", "tvdb");
        expect(aot?.title).toBe("Attack on Titan");
        expect(episodeRepo.getEpisodesByAnimeId(aot?.id as number)).toHaveLength(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("creates episode groups for each season", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 2,
            title: "Episode 1",
            filePath: "/media/Jujutsu Kaisen/S02E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const jjk = animeRepo.findAnime("tvdb-12345", "tvdb");
        const groups = groupRepo.getEpisodeGroupsByAnimeId(jjk?.id as number);
        expect(groups).toHaveLength(2);
        expect(groups[0]?.seasonNumber).toBe(1);
        expect(groups[1]?.seasonNumber).toBe(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves watched status for matching episodes", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
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
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          watched: false,
        });

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const rebuilt = animeRepo.findAnime("tvdb-12345", "tvdb");
        const statuses = episodeRepo.getEpisodeWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = episodeRepo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1Status?.watched).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves per-anime sourceDb", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo } = createRebuilder(db);

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "anidb-67890",
            animeTitle: "Attack on Titan",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/AoT/S01E01.mkv",
            sourceDb: "anidb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        expect(animeRepo.findAnime("tvdb-12345", "tvdb")).not.toBeNull();
        expect(animeRepo.findAnime("anidb-67890", "anidb")).not.toBeNull();
        expect(animeRepo.findAnime("anidb-67890", "tvdb")).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves group watch statuses across rebuild", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
          synopsis: "Season 1 synopsis",
          rating: 9.5,
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

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const rebuilt = animeRepo.findAnime("tvdb-12345", "tvdb");
        const groups = groupRepo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("completed");
        expect(groups[0]?.synopsis).toBe("Season 1 synopsis");
        expect(groups[0]?.rating).toBe(9.5);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves tracker mappings across rebuild", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });
        groupRepo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "67890",
        });

        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const rebuilt = animeRepo.findAnime("tvdb-12345", "tvdb");
        const groups = groupRepo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(groups).toHaveLength(1);

        const malMapping = groupRepo.getTrackerMapping(groups[0]?.id as number, "mal");
        expect(malMapping?.externalId).toBe("12345");

        const anilistMapping = groupRepo.getTrackerMapping(groups[0]?.id as number, "anilist");
        expect(anilistMapping?.externalId).toBe("67890");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("converges matches with the same title on a single anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/JJK-tvdb/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "anidb-67890",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "201",
            episode: 2,
            season: 1,
            title: "AOrdinary Person",
            filePath: "/media/JJK-anidb/S01E02.mkv",
            sourceDb: "anidb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const animeList = animeRepo.listAnime();
        expect(animeList).toHaveLength(1);

        const tvdbMapping = animeRepo.findAnimeSourceMapping("tvdb", "tvdb-12345");
        expect(tvdbMapping).not.toBeNull();
        expect(tvdbMapping?.animeId).toBe(animeList[0]?.id);

        const anidbMapping = animeRepo.findAnimeSourceMapping("anidb", "anidb-67890");
        expect(anidbMapping).not.toBeNull();
        expect(anidbMapping?.animeId).toBe(animeList[0]?.id);

        const episodes = episodeRepo.getEpisodesByAnimeId(animeList[0]?.id as number);
        expect(episodes).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves watched status matched by AniDB ID across rebuild", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

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

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-new-id",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/JJK/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-new-id",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/JJK/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches);

        const rebuilt = animeRepo.listAnime();
        expect(rebuilt).toHaveLength(1);
        expect(rebuilt[0]?.anidbId).toBe("al-jjk");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(rebuilt[0]?.id as number);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("watching");

        const statuses = episodeRepo.getEpisodeWatchStatusByAnimeId(rebuilt[0]?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1 = statuses.find((s) => {
          const ep = episodeRepo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1?.watched).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("calls onBeforeWipe with snapshot", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder } = createRebuilder(db);

        let capturedSnapshot:
          | {
              groupByCompositeKey: Map<string, number>;
              episodeByCompositeKey: Map<string, number>;
            }
          | undefined;

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.rebuildFromMatches(matches, (snapshot) => {
          capturedSnapshot = snapshot;
        });

        expect(capturedSnapshot).toBeDefined();
        expect(capturedSnapshot?.groupByCompositeKey).toBeInstanceOf(Map);
        expect(capturedSnapshot?.episodeByCompositeKey).toBeInstanceOf(Map);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("mergeFromMatches", () => {
    test("merges without deleting existing data", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");
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
          watched: true,
        });

        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(new Map([["tvdb-12345", "al-jjk"]])),
        });

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/S01E02.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-67890",
            animeTitle: "Attack on Titan",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/AoT/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(matches);

        const animeList = animeRepo.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = animeRepo.findAnimeByAnidbId("al-jjk");
        expect(jjk).not.toBeNull();
        const statuses = episodeRepo.getEpisodeWatchStatusByAnimeId(jjk?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = episodeRepo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1Status?.watched).toBe(true);
        const ep2Status = statuses.find((s) => {
          const ep = episodeRepo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 2;
        });
        expect(ep2Status?.watched).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("adds new anime and episodes", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(matches);

        const all = animeRepo.listAnime();
        expect(all).toHaveLength(1);
        expect(all[0]?.title).toBe("Jujutsu Kaisen");
        expect(episodeRepo.getEpisodesByAnimeId(all[0]?.id as number)).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing anime via anilistId", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-jjk");

        const firstMatches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(firstMatches);

        const secondMatches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "103",
            episode: 3,
            season: 1,
            title: "Thunderclap",
            filePath: "/media/S01E03.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "104",
            episode: 4,
            season: 1,
            title: "Imperial Soldier",
            filePath: "/media/S01E04.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(secondMatches);

        expect(animeRepo.listAnime()).toHaveLength(1);
        const jjk = animeRepo.findAnime("tvdb-12345", "tvdb");
        expect(episodeRepo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(4);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not create duplicate episodes on repeated merges", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-jjk");

        const matches: MatchEntry[] = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(matches);
        await rebuilder.mergeFromMatches(matches);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("groups by title and entryType for same-sourceDb matches", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const existing = animeRepo.upsertAnime({ title: "Oshi no Ko" });
        animeRepo.updateAnimeAnidbId(existing.id, "al-oshi");

        const matches: MatchEntry[] = [
          {
            animeId: "222",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 2,
            title: "Tokyo Blade",
            filePath: "/media/S02E01.mkv",
            sourceDb: "anidb",
          },
          {
            animeId: "111",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Mother and Children",
            filePath: "/media/S01E01.mkv",
            sourceDb: "anidb",
          },
          {
            animeId: "111",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Third Option",
            filePath: "/media/S01E02.mkv",
            sourceDb: "anidb",
          },
        ];

        await rebuilder.mergeFromMatches(matches);

        const all = animeRepo.listAnime();
        expect(all).toHaveLength(1);
        expect(all[0]?.title).toBe("Oshi no Ko");
        const episodes = episodeRepo.getEpisodesByAnimeId(all[0]?.id as number);
        expect(episodes).toHaveLength(3);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges episodes from different sourceDbs into same anime by anilistId", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Oshi no Ko" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-oshi");

        const anidbMatches: MatchEntry[] = [
          {
            animeId: "anidb-12345",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Mother and Children",
            filePath: "/media/Oshi no Ko/S01E01.mkv",
            sourceDb: "anidb",
          },
          {
            animeId: "anidb-12345",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Third Option",
            filePath: "/media/Oshi no Ko/S01E02.mkv",
            sourceDb: "anidb",
          },
        ];

        await rebuilder.mergeFromMatches(anidbMatches);

        expect(animeRepo.listAnime()).toHaveLength(1);

        const tvdbMatches: MatchEntry[] = [
          {
            animeId: "tvdb-67890",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 2,
            title: "Mother and Children",
            filePath: "/media/Oshi no Ko/S02E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-67890",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "202",
            episode: 2,
            season: 2,
            title: "Third Option",
            filePath: "/media/Oshi no Ko/S02E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await rebuilder.mergeFromMatches(tvdbMatches);

        const all = animeRepo.listAnime();
        expect(all).toHaveLength(1);
        expect(all[0]?.title).toBe("Oshi no Ko");
        expect(all[0]?.anidbId).toBe("al-oshi");
        expect(episodeRepo.getEpisodesByAnimeId(all[0]?.id as number)).toHaveLength(4);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("resolveAndMerge", () => {
    test("finds existing anime by anilistId from entry", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-456");

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-456",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = animeRepo.getAnime(result.animeIds[0] as number);
        expect(anime?.anidbId).toBe("al-456");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(result.animeIds[0] as number);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.entryType).toBe("tv");
        expect(groups[0]?.seasonNumber).toBe(1);

        const episodes = episodeRepo.getEpisodesByGroupId(groups[0]?.id as number);
        expect(episodes).toHaveLength(1);
        expect(episodes[0]?.filePath).toBe("/media/S01E01.mkv");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("assigns synthetic ID when no library or cache match", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo } = createRebuilder(db);

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = animeRepo.getAnime(result.animeIds[0] as number);
        expect(anime?.anidbId).toMatch(/^temp:/);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("creates new anime with resolved AniDB ID when none exists", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-new",
              season: 1,
              episodes: [
                { episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" },
                { episode: 2, filePath: "/media/S01E02.mkv", title: "Cursed Womb Must Die" },
              ],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = animeRepo.getAnime(result.animeIds[0] as number);
        expect(anime?.title).toBe("Jujutsu Kaisen");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(result.animeIds[0] as number);
        expect(groups).toHaveLength(1);

        const episodes = episodeRepo.getEpisodesByAnimeId(result.animeIds[0] as number);
        expect(episodes).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing anime when AniDB ID matches", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-shared");

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-shared",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        expect(result.animeIds[0]).toBe(existingAnime.id);

        const episodes = episodeRepo.getEpisodesByAnimeId(existingAnime.id);
        expect(episodes).toHaveLength(1);
        expect(episodes[0]?.filePath).toBe("/media/S01E01.mkv");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("creates episode groups by (entryType, seasonNumber)", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, groupRepo } = createRebuilder(db);

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-groups",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ep 1" }],
            },
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-groups",
              season: 2,
              episodes: [{ episode: 1, filePath: "/media/S02E01.mkv", title: "Ep 1" }],
            },
          ],
          source: "tvdb",
        });

        const groups = groupRepo.getEpisodeGroupsByAnimeId(result.animeIds[0] as number);
        expect(groups).toHaveLength(2);
        const seasons = groups.map((g) => g.seasonNumber).sort();
        expect(seasons).toEqual([1, 2]);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves existing tracker mappings on groups during merge", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-tracker");

        const existingGroup = groupRepo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        groupRepo.upsertGroupTrackerMapping({
          groupId: existingGroup.id,
          source: "mal",
          externalId: "mal-entry-1",
        });

        await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-tracker",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const groups = groupRepo.getEpisodeGroupsByAnimeId(existingAnime.id);
        expect(groups).toHaveLength(1);

        const mappings = groupRepo.getTrackerMappingsByGroupId(existingGroup.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("mal");
        expect(mappings[0]?.externalId).toBe("mal-entry-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves existing watch status on groups during merge", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-status");

        const existingGroup = groupRepo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-status",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const updatedGroup = groupRepo.getEpisodeGroup(existingGroup.id);
        expect(updatedGroup?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("deletes empty groups with no tracker mappings and default watch status", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-cleanup");

        const emptyGroup = groupRepo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-cleanup",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const deletedGroup = groupRepo.getEpisodeGroup(emptyGroup.id);
        expect(deletedGroup).toBeNull();

        const remainingGroups = groupRepo.getEpisodeGroupsByAnimeId(existingAnime.id);
        expect(remainingGroups).toHaveLength(1);
        expect(remainingGroups[0]?.entryType).toBe("tv");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves empty groups with tracker mappings", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-preserve");

        const trackedGroup = groupRepo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        groupRepo.upsertGroupTrackerMapping({
          groupId: trackedGroup.id,
          source: "mal",
          externalId: "mal-ova-1",
        });

        await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-preserve",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const preservedGroup = groupRepo.getEpisodeGroup(trackedGroup.id);
        expect(preservedGroup).not.toBeNull();

        const mappings = groupRepo.getTrackerMappingsByGroupId(trackedGroup.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.externalId).toBe("mal-ova-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves empty groups with non-default watch status", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-nondefault");

        const statusGroup = groupRepo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-nondefault",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const preservedGroup = groupRepo.getEpisodeGroup(statusGroup.id);
        expect(preservedGroup).not.toBeNull();
        expect(preservedGroup?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("handles import entries and upserts tracker mappings", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-import");

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "import",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              sourceId: "tracker-123",
              watchStatus: "completed",
            },
          ],
          source: "anilist",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = animeRepo.getAnime(result.animeIds[0] as number);
        expect(anime?.anidbId).toBe("al-import");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(result.animeIds[0] as number);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("completed");

        const mappings = groupRepo.getTrackerMappingsByGroupId(groups[0]?.id as number);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tracker-123");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges scan and import entries for the same anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { rebuilder, animeRepo, episodeRepo, groupRepo } = createRebuilder(db);

        const existingAnime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
        animeRepo.updateAnimeAnidbId(existingAnime.id, "al-shared-entry");

        const result = await rebuilder.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              externalId: "al-shared-entry",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
            {
              kind: "import",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              source: "anilist",
              sourceId: "tracker-456",
              watchStatus: "watching",
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = animeRepo.getAnime(result.animeIds[0] as number);
        expect(anime?.anidbId).toBe("al-shared-entry");

        const groups = groupRepo.getEpisodeGroupsByAnimeId(result.animeIds[0] as number);
        expect(groups).toHaveLength(1);

        const episodes = episodeRepo.getEpisodesByGroupId(groups[0]?.id as number);
        expect(episodes).toHaveLength(1);
        expect(episodes[0]?.filePath).toBe("/media/S01E01.mkv");

        const mappings = groupRepo.getTrackerMappingsByGroupId(groups[0]?.id as number);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.externalId).toBe("tracker-456");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("rebuild", () => {
    test("rebuilds from filtered matches and replays unpushed events", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-rebuilder-rebuild-"));
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Old Title" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: join(dir, "S01E01.mkv"),
          title: "Ep 1",
          watched: true,
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: join(dir, "S01E02.mkv"),
          title: "Ep 2",
          watched: false,
        });

        writeFileSync(join(dir, "S01E01.mkv"), "content");
        writeFileSync(join(dir, "S01E02.mkv"), "content");

        let replayCalled = false;
        let capturedSnapshot:
          | {
              groupByCompositeKey: Map<string, number>;
              episodeByCompositeKey: Map<string, number>;
            }
          | undefined;

        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: (snapshot) => {
            replayCalled = true;
            capturedSnapshot = snapshot;
          },
          identityResolver: createMockIdentityResolver(),
        });

        await rebuilder.rebuild();

        const rebuilt = animeRepo.findAnime("tvdb-12345", "tvdb");
        expect(rebuilt).not.toBeNull();
        const rebuiltGroup = groupRepo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(rebuiltGroup).toHaveLength(1);
        expect(rebuiltGroup[0]?.watchStatus).toBe("completed");

        const statuses = episodeRepo.getEpisodeWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1 = statuses.find((s) => {
          const ep = episodeRepo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1?.watched).toBe(true);

        expect(replayCalled).toBe(true);
        expect(capturedSnapshot).toBeDefined();
        expect(capturedSnapshot?.groupByCompositeKey).toBeInstanceOf(Map);
        expect(capturedSnapshot?.episodeByCompositeKey).toBeInstanceOf(Map);
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("filters by sourceDb when provided", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-rebuilder-rebuild-srcdb-"));
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime1 = animeRepo.upsertAnime({ title: "TVDB Anime" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime1.id,
          source: "tvdb",
          externalId: "tvdb-111",
        });
        const group1 = groupRepo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group1.id,
          episodeNumber: 1,
          filePath: join(dir, "tvdb-ep1.mkv"),
          title: "TVDB Ep 1",
          watched: false,
        });

        const anime2 = animeRepo.upsertAnime({ title: "AniDB Anime" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime2.id,
          source: "anidb",
          externalId: "anidb-222",
        });
        const group2 = groupRepo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        episodeRepo.addEpisode({
          groupId: group2.id,
          episodeNumber: 1,
          filePath: join(dir, "anidb-ep1.mkv"),
          title: "AniDB Ep 1",
          watched: false,
        });

        writeFileSync(join(dir, "tvdb-ep1.mkv"), "content");
        writeFileSync(join(dir, "anidb-ep1.mkv"), "content");

        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(),
        });

        await rebuilder.rebuild("tvdb");

        expect(animeRepo.findAnime("tvdb-111", "tvdb")).not.toBeNull();
        expect(animeRepo.findAnime("anidb-222", "anidb")).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("rebuildWithTrackers", () => {
    test("throws when importFromTracker dependency is not provided", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(),
        });

        await expect(
          rebuilder.rebuildWithTrackers([{ plugin: createMockTracker(), source: "anilist" }]),
        ).rejects.toThrow("importFromTracker dependency required for rebuildWithTrackers");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("rebuilds then calls importFromTracker for each tracker", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-rebuilder-rebuild-trackers-"));
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Existing Anime" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });
        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: join(dir, "S01E01.mkv"),
          title: "Ep 1",
          watched: true,
        });
        writeFileSync(join(dir, "S01E01.mkv"), "content");

        const importCalls: Array<{ source: string }> = [];
        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(),
          importFromTracker: async (_plugin, source) => {
            importCalls.push({ source });
            return { imported: 0, skipped: 0 };
          },
        });

        const tracker = createMockTracker({
          getUserList: async () => [],
        });

        await rebuilder.rebuildWithTrackers([
          { plugin: tracker, source: "anilist" },
          { plugin: tracker, source: "mal" },
        ]);

        expect(importCalls).toHaveLength(2);
        expect(importCalls[0]?.source).toBe("anilist");
        expect(importCalls[1]?.source).toBe("mal");

        const rebuilt = animeRepo.findAnime("tvdb-12345", "tvdb");
        expect(rebuilt).not.toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("preserves watch statuses after rebuild", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-rebuilder-rebuild-trackers-status-"));
      try {
        const { animeRepo, episodeRepo, groupRepo } = createLibraryRepos(db);

        const anime = animeRepo.upsertAnime({ title: "Watch Status Anime" });
        animeRepo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-55555",
        });
        animeRepo.updateAnimeAnidbId(anime.id, "anidb-aaa");

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        episodeRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: join(dir, "S01E01.mkv"),
          title: "Ep 1",
          watched: true,
        });
        writeFileSync(join(dir, "S01E01.mkv"), "content");

        let importCalled = false;
        const rebuilder = new AnimeRebuilder({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(),
          importFromTracker: async () => {
            importCalled = true;
            return { imported: 0, skipped: 0 };
          },
        });

        const tracker = createMockTracker({
          getUserList: async () => [],
        });

        await rebuilder.rebuildWithTrackers([{ plugin: tracker, source: "anilist" }]);

        expect(importCalled).toBe(true);

        const rebuilt = animeRepo.findAnime("tvdb-55555", "tvdb");
        expect(rebuilt).not.toBeNull();
        const rebuiltGroups = groupRepo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(rebuiltGroups).toHaveLength(1);
        expect(rebuiltGroups[0]?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
