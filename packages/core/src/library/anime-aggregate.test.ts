import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createEventDb } from "../events/test-utils";
import { createMockEnrichmentProvider, createMockTracker } from "../fixtures";
import type { MatchEntry } from "../types";
import { AnimeAggregate } from "./anime-aggregate";
import { LibraryRepository } from "./library-repository";
import { createLibraryDb } from "./test-utils";

describe("AnimeAggregate", () => {
  describe("rebuildFromMatches", () => {
    test("clears existing data and rebuilds from matches", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        repo.upsertAnime({
          externalId: "old-123",
          sourceDb: "tvdb",
          title: "Old Anime",
          episodeCount: 12,
        });

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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

        aggregate.rebuildFromMatches(matches);

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.title).toBe("Jujutsu Kaisen");
        expect(repo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(2);

        const aot = repo.findAnime("tvdb-67890", "tvdb");
        expect(aot?.title).toBe("Attack on Titan");
        expect(repo.getEpisodesByAnimeId(aot?.id as number)).toHaveLength(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("creates episode groups for each season", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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
            season: 2,
            title: "Episode 1",
            filePath: "/media/Jujutsu Kaisen/S02E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        aggregate.rebuildFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        const groups = repo.getEpisodeGroupsByAnimeId(jjk?.id as number);
        expect(groups).toHaveLength(2);
        expect(groups[0]?.seasonNumber).toBe(1);
        expect(groups[1]?.seasonNumber).toBe(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves watched status for matching episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

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
          watched: true,
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

        aggregate.rebuildFromMatches(matches);

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        const statuses = repo.getEpisodeWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = repo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1Status?.watched).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("sets correct episodeCount per anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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

        aggregate.rebuildFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(2);
        const aot = repo.findAnime("tvdb-67890", "tvdb");
        expect(aot?.episodeCount).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves per-anime sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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

        aggregate.rebuildFromMatches(matches);

        expect(repo.findAnime("tvdb-12345", "tvdb")).not.toBeNull();
        expect(repo.findAnime("anidb-67890", "anidb")).not.toBeNull();
        expect(repo.findAnime("anidb-67890", "tvdb")).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves group watch statuses across rebuild", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 2,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
          synopsis: "Season 1 synopsis",
          rating: 9.5,
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

        aggregate.rebuildFromMatches(matches);

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        const groups = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("completed");
        expect(groups[0]?.synopsis).toBe("Season 1 synopsis");
        expect(groups[0]?.rating).toBe(9.5);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("preserves tracker mappings across rebuild", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 2,
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

        aggregate.rebuildFromMatches(matches);

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        const groups = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(groups).toHaveLength(1);

        const malMapping = repo.getTrackerMapping(groups[0]?.id as number, "mal");
        expect(malMapping?.externalId).toBe("12345");

        const anilistMapping = repo.getTrackerMapping(groups[0]?.id as number, "anilist");
        expect(anilistMapping?.externalId).toBe("67890");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("calls onBeforeWipe with snapshot", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        let capturedSnapshot:
          | {
              groupByCompositeKey: Map<string, number>;
              episodeByCompositeKey: Map<string, number>;
            }
          | undefined;

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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
        ];

        aggregate.rebuildFromMatches(matches, (snapshot) => {
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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 12,
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

        await aggregate.mergeFromMatches(matches);

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(2);

        const statuses = repo.getEpisodeWatchStatusByAnimeId(jjk?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = repo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1Status?.watched).toBe(true);
        const ep2Status = statuses.find((s) => {
          const ep = repo.getEpisode(s.episodeId);
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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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
        ];

        await aggregate.mergeFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk).not.toBeNull();
        expect(jjk?.episodeCount).toBe(2);
        expect(repo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

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

        await aggregate.mergeFromMatches(firstMatches);

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

        await aggregate.mergeFromMatches(secondMatches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(4);
        expect(repo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(4);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not inflate episodeCount on repeated merges", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
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
        ];

        await aggregate.mergeFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(2);

        await aggregate.mergeFromMatches(matches);

        const updated = repo.findAnime("tvdb-12345", "tvdb");
        expect(updated?.episodeCount).toBe(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("groups by title instead of animeId for same-sourceDb matches", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

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

        await aggregate.mergeFromMatches(matches);

        const all = repo.listAnime();
        expect(all).toHaveLength(1);
        expect(all[0]?.title).toBe("Oshi no Ko");
        expect(all[0]?.externalId).toBe("111");
        expect(all[0]?.sourceDb).toBe("anidb");
        expect(all[0]?.episodeCount).toBe(3);

        const episodes = repo.getEpisodesByAnimeId(all[0]?.id as number);
        expect(episodes).toHaveLength(3);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing entry when title and sourceDb match", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        repo.upsertAnime({
          externalId: "111",
          sourceDb: "anidb",
          title: "Oshi no Ko",
          episodeCount: 12,
        });

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
            animeId: "222",
            animeTitle: "Oshi no Ko",
            entryType: "tv",
            episodeId: "202",
            episode: 2,
            season: 2,
            title: "Game of Telephone",
            filePath: "/media/S02E02.mkv",
            sourceDb: "anidb",
          },
        ];

        await aggregate.mergeFromMatches(matches);

        const all = repo.listAnime();
        expect(all).toHaveLength(1);
        expect(all[0]?.title).toBe("Oshi no Ko");
        expect(all[0]?.externalId).toBe("111");
        expect(all[0]?.episodeCount).toBe(2);

        const episodes = repo.getEpisodesByAnimeId(all[0]?.id as number);
        expect(episodes).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("removes anime from other sourceDbs when switching databases", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

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

        await aggregate.mergeFromMatches(anidbMatches);

        expect(repo.listAnime()).toHaveLength(1);
        expect(repo.findAnime("anidb-12345", "anidb")).not.toBeNull();

        const tvdbMatches: MatchEntry[] = [
          {
            animeId: "tvdb-67890",
            animeTitle: "Oshi no Ko (TV)",
            entryType: "tv",
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "Mother and Children",
            filePath: "/media/Oshi no Ko/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "tvdb-67890",
            animeTitle: "Oshi no Ko (TV)",
            entryType: "tv",
            episodeId: "202",
            episode: 2,
            season: 1,
            title: "Third Option",
            filePath: "/media/Oshi no Ko/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        await aggregate.mergeFromMatches(tvdbMatches);

        const all = repo.listAnime();
        expect(all).toHaveLength(1);
        expect(repo.findAnime("anidb-12345", "anidb")).toBeNull();
        const tvdb = repo.findAnime("tvdb-67890", "tvdb");
        expect(tvdb).not.toBeNull();
        expect(tvdb?.title).toBe("Oshi no Ko (TV)");
        expect(repo.getEpisodesByAnimeId(tvdb?.id as number)).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("exportMatches", () => {
    test("converts to MatchEntry format", () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

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

        const matches = aggregate.exportMatches();
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

  describe("rebuild", () => {
    test("rebuilds from filtered matches and replays unpushed events", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-agg-rebuild-"));
      try {
        const repo = new LibraryRepository(db);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Old Title",
          episodeCount: 2,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: join(dir, "S01E01.mkv"),
          title: "Ep 1",
          season: 1,
          watched: true,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: join(dir, "S01E02.mkv"),
          title: "Ep 2",
          season: 1,
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

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: (snapshot) => {
            replayCalled = true;
            capturedSnapshot = snapshot;
          },
          computeAndPersistLibraryState: () => {},
        });

        await aggregate.rebuild();

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        expect(rebuilt).not.toBeNull();
        expect(rebuilt?.episodeCount).toBe(2);

        const rebuiltGroup = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
        expect(rebuiltGroup).toHaveLength(1);
        expect(rebuiltGroup[0]?.watchStatus).toBe("completed");

        const statuses = repo.getEpisodeWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1 = statuses.find((s) => {
          const ep = repo.getEpisode(s.episodeId);
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
      const dir = mkdtempSync(join(tmpdir(), "anime-agg-rebuild-srcdb-"));
      try {
        const repo = new LibraryRepository(db);

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-111",
          sourceDb: "tvdb",
          title: "TVDB Anime",
          episodeCount: 1,
        });
        const group1 = repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        repo.addEpisode({
          animeId: anime1.id,
          groupId: group1.id,
          episodeNumber: 1,
          filePath: join(dir, "tvdb-ep1.mkv"),
          title: "TVDB Ep 1",
          season: 1,
          watched: false,
        });

        const anime2 = repo.upsertAnime({
          externalId: "anidb-222",
          sourceDb: "anidb",
          title: "AniDB Anime",
          episodeCount: 1,
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
          filePath: join(dir, "anidb-ep1.mkv"),
          title: "AniDB Ep 1",
          season: 1,
          watched: false,
        });

        writeFileSync(join(dir, "tvdb-ep1.mkv"), "content");
        writeFileSync(join(dir, "anidb-ep1.mkv"), "content");

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        await aggregate.rebuild("tvdb");

        expect(repo.findAnime("tvdb-111", "tvdb")).not.toBeNull();
        expect(repo.findAnime("anidb-222", "anidb")).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("enriches unenriched anime after rebuild", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      const dir = mkdtempSync(join(tmpdir(), "anime-agg-rebuild-enrich-"));
      try {
        const repo = new LibraryRepository(db);

        writeFileSync(join(dir, "S01E01.mkv"), "content");

        const searchCalls: string[] = [];

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () => ({
            async searchByTitle(title: string) {
              searchCalls.push(title);
              return { anilistId: "1", title, format: "TV", episodes: 12 };
            },
            async getMediaDetailsBatch(ids: string[]) {
              return ids.map((id) => ({
                anilistId: id,
                title: `Anime ${id}`,
                format: "TV",
                episodes: 12,
                relations: [],
              }));
            },
          }),
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
            filePath: join(dir, "S01E01.mkv"),
            sourceDb: "tvdb",
          },
        ];

        aggregate.rebuildFromMatches(matches);

        await aggregate.rebuild();

        expect(searchCalls.length).toBeGreaterThan(0);
        expect(searchCalls[0]).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
        evtSqlite.close();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("importFromTracker", () => {
    test("creates new anime and episode groups for unmatched entries", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Attack on Titan");

        const groups = repo.getEpisodeGroupsByAnimeId(animeList[0]?.id ?? 0);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.watchStatus).toBe("watching");

        const mappings = repo.getTrackerMappingsByGroupId(groups[0]?.id ?? 0);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("updates watch status for matched entries", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(1);
        expect(result.skipped).toBe(0);

        const updatedGroup = repo.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const mappings = repo.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips entries already imported from the same tracker", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "tl-1",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(0);
        expect(result.skipped).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("resolves conflict by keeping local status", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist", [
          { trackerId: "tl-1", resolution: "keepLocal" },
        ]);

        expect(result.imported).toBe(1);

        const groups = repo.getEpisodeGroupsByAnimeId(anime.id);
        expect(groups[0]?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("resolves conflict by accepting tracker status", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist", [
          { trackerId: "tl-1", resolution: "acceptTracker" },
        ]);

        expect(result.imported).toBe(1);

        const groups = repo.getEpisodeGroupsByAnimeId(anime.id);
        expect(groups[0]?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("links unmatched entry to existing group via selection", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Shingeki no Kyojin",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist", [
          { trackerId: "tl-1", groupId: group.id },
        ]);

        expect(result.imported).toBe(1);

        const updatedGroup = repo.getEpisodeGroup(group.id);
        expect(updatedGroup?.watchStatus).toBe("completed");

        const mappings = repo.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.externalId).toBe("tl-1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("enriches newly imported anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const searchCalls: string[] = [];

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => {
                searchCalls.push(title);
                return { anilistId: "12345", title, format: "TV", episodes: 25 };
              },
            }),
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "12345",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed",
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(1);

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.franchiseId).not.toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("batch imports multiple new anime in one transaction", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const tracker = createMockTracker({
          getUserList: async () => [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "watching",
              episodesWatched: 12,
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
            {
              source: "anilist",
              trackerId: "tl-3",
              title: "One Piece",
              entryType: "tv",
              watchStatus: "plan-to-watch",
              episodesWatched: 0,
              totalEpisodes: 1100,
            },
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");

        expect(result.imported).toBe(3);
        expect(result.skipped).toBe(0);

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(3);

        for (const anime of animeList) {
          const groups = repo.getEpisodeGroupsByAnimeId(anime.id);
          expect(groups).toHaveLength(1);
          const mappings = repo.getTrackerMappingsByGroupId(groups[0]?.id ?? 0);
          expect(mappings).toHaveLength(1);
        }
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("batch updates watch status for multiple matched entries", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-456",
          sourceDb: "tvdb",
          title: "Death Note",
          episodeCount: 37,
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const tracker = createMockTracker({
          getUserList: async () => [
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
          ],
        });

        const result = await aggregate.importFromTracker(tracker, "anilist");
        expect(result.imported).toBe(2);

        const updatedGroup1 = repo.getEpisodeGroup(group1.id);
        expect(updatedGroup1?.watchStatus).toBe("completed");

        const updatedGroup2 = repo.getEpisodeGroup(group2.id);
        expect(updatedGroup2?.watchStatus).toBe("completed");
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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 2,
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
          title: "Ryomen Sukuna",
          season: 1,
          watched: true,
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

        const result = aggregate.getAnimeForDisplay();

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.addEpisode({
          animeId: anime1.id,
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 1,
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        repo.addEpisode({
          animeId: anime2.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          season: 1,
          watched: true,
        });

        const result = aggregate.getAnimeForDisplay();

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });

        repo.upsertAnime({
          externalId: "anidb-67890",
          sourceDb: "anidb",
          title: "Attack on Titan",
          episodeCount: 0,
        });

        const result = aggregate.getAnimeForDisplay({ sourceDb: "tvdb" });

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime1 = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 1,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime1.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        repo.addEpisode({
          animeId: anime1.id,
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const anime2 = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 1,
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime2.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        repo.addEpisode({
          animeId: anime2.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          season: 1,
          watched: true,
        });

        const result = aggregate.getAnimeForDisplay({ watchStatus: "completed" });

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });

        const result = aggregate.getAnimeForDisplay({ sourceDb: "anidb" });

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 3,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group1.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: true,
        });

        const group2 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "watching",
        });

        repo.addEpisode({
          animeId: anime.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/S02E01.mkv",
          season: 2,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group2.id,
          episodeNumber: 2,
          filePath: "/media/S02E02.mkv",
          season: 2,
          watched: false,
        });

        const result = aggregate.getAnimeForDisplay();

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
        const repo = new LibraryRepository(db);

        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const result = aggregate.getAnimeForDisplay();

        expect(result).toHaveLength(0);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        const existingAnime = repo.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-456");

        const result = await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-456",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.anilistId).toBe("al-456");

        const groups = repo.getEpisodeGroupsByAnimeId(result.animeIds[0]!);
        expect(groups).toHaveLength(1);
        expect(groups[0]?.entryType).toBe("tv");
        expect(groups[0]?.seasonNumber).toBe(1);

        const episodes = repo.getEpisodesByGroupId(groups[0]!.id);
        expect(episodes).toHaveLength(1);
        expect(episodes[0]?.filePath).toBe("/media/S01E01.mkv");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("resolves AniList ID from anilist_cache when source mapping missing", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        repo.setAnilistCacheEntry({
          anilistId: "al-cached",
          title: "Jujutsu Kaisen",
          format: "TV",
          episodes: 24,
          relations: [],
          externalLinks: null,
          fetchedAt: new Date().toISOString(),
        });

        const result = await aggregate.resolveAndMerge({
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
        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.anilistId).toBe("al-cached");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("resolves AniList ID via searchByTitle API and caches result", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const searchCalls: string[] = [];
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => {
                searchCalls.push(title);
                return { anilistId: "al-789", title, format: "TV", episodes: 12 };
              },
            }),
        });

        const result = await aggregate.resolveAndMerge({
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

        expect(searchCalls.length).toBeGreaterThanOrEqual(1);
        expect(searchCalls[0]).toBe("Jujutsu Kaisen");
        expect(result.animeIds).toHaveLength(1);
        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.anilistId).toBe("al-789");

        const cached = repo.getAnilistCacheEntry("al-789");
        expect(cached).not.toBeNull();
        expect(cached?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("leaves anilist_id NULL when AniList API unavailable and no cache hit", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async () => {
                throw new Error("API unavailable");
              },
            }),
        });

        const result = await aggregate.resolveAndMerge({
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
        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.anilistId).toBeUndefined();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("creates new anime with anilist_id when none exists", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-new",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const result = await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-new",
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
        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.title).toBe("Jujutsu Kaisen");
        expect(anime?.anilistId).toBe("al-new");

        const groups = repo.getEpisodeGroupsByAnimeId(result.animeIds[0]!);
        expect(groups).toHaveLength(1);

        const episodes = repo.getEpisodesByAnimeId(result.animeIds[0]!);
        expect(episodes).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing anime when anilist_id matches", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-shared",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-999",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-shared");

        const result = await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-shared",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        expect(result.animeIds).toHaveLength(1);
        expect(result.animeIds[0]).toBe(existingAnime.id);

        const episodes = repo.getEpisodesByAnimeId(existingAnime.id);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-groups",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const result = await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-groups",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ep 1" }],
            },
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-groups",
              season: 2,
              episodes: [{ episode: 1, filePath: "/media/S02E01.mkv", title: "Ep 1" }],
            },
          ],
          source: "tvdb",
        });

        const groups = repo.getEpisodeGroupsByAnimeId(result.animeIds[0]!);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-tracker",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-888",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-tracker");

        const existingGroup = repo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });
        repo.upsertGroupTrackerMapping({
          groupId: existingGroup.id,
          source: "mal",
          externalId: "mal-entry-1",
        });

        await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-tracker",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const groups = repo.getEpisodeGroupsByAnimeId(existingAnime.id);
        expect(groups).toHaveLength(1);

        const mappings = repo.getTrackerMappingsByGroupId(existingGroup.id);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-status",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-777",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-status");

        const existingGroup = repo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-status",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const updatedGroup = repo.getEpisodeGroup(existingGroup.id);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-cleanup",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-666",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-cleanup");

        const emptyGroup = repo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-cleanup",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const deletedGroup = repo.getEpisodeGroup(emptyGroup.id);
        expect(deletedGroup).toBeNull();

        const remainingGroups = repo.getEpisodeGroupsByAnimeId(existingAnime.id);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-preserve",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-555",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-preserve");

        const trackedGroup = repo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        repo.upsertGroupTrackerMapping({
          groupId: trackedGroup.id,
          source: "mal",
          externalId: "mal-ova-1",
        });

        await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-preserve",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const preservedGroup = repo.getEpisodeGroup(trackedGroup.id);
        expect(preservedGroup).not.toBeNull();

        const mappings = repo.getTrackerMappingsByGroupId(trackedGroup.id);
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
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-nondefault",
                title,
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const existingAnime = repo.upsertAnime({
          externalId: "mal-444",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(existingAnime.id, "al-nondefault");

        const statusGroup = repo.upsertEpisodeGroup({
          animeId: existingAnime.id,
          entryType: "ova",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-nondefault",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const preservedGroup = repo.getEpisodeGroup(statusGroup.id);
        expect(preservedGroup).not.toBeNull();
        expect(preservedGroup?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("triggers franchise enrichment for newly created anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const enrichmentCalls: string[][] = [];
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-enrich",
                title,
                format: "TV",
                episodes: 24,
              }),
              getMediaDetailsBatch: async (ids) => {
                enrichmentCalls.push(ids);
                return ids.map((id) => ({
                  anilistId: id,
                  title: "Jujutsu Kaisen",
                  format: "TV",
                  episodes: 24,
                  relations: [],
                }));
              },
            }),
        });

        const result = await aggregate.resolveAndMerge({
          entries: [
            {
              kind: "scan",
              title: "Jujutsu Kaisen",
              entryType: "tv",
              anilistId: "al-enrich",
              season: 1,
              episodes: [{ episode: 1, filePath: "/media/S01E01.mkv", title: "Ryomen Sukuna" }],
            },
          ],
          source: "tvdb",
        });

        const anime = repo.getAnime(result.animeIds[0]!);
        expect(anime?.franchiseId).not.toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("retryPendingIdentification", () => {
    test("finds anime with anilist_id IS NULL", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async () => null,
            }),
        });

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-1",
          sourceDb: "tvdb",
          title: "Unknown Anime",
          episodeCount: 3,
        });
        const resolvedAnime = repo.upsertAnime({
          externalId: "tvdb-resolved",
          sourceDb: "tvdb",
          title: "Known Anime",
          episodeCount: 12,
        });
        repo.updateAnimeAnilistId(resolvedAnime.id, "al-123");

        const result = await aggregate.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
        expect(result.stillPending[0]?.id).toBe(pendingAnime.id);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("updates anilist_id when resolved ID has no existing match", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => ({
                anilistId: "al-new-id",
                title,
                format: "TV",
                episodes: 12,
              }),
            }),
        });

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-2",
          sourceDb: "tvdb",
          title: "Solo Leveling",
          episodeCount: 12,
        });

        const result = await aggregate.retryPendingIdentification();

        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0]?.id).toBe(pendingAnime.id);

        const updated = repo.getAnime(pendingAnime.id);
        expect(updated?.anilistId).toBe("al-new-id");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges pending anime into canonical when resolved ID matches existing", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async () => ({
                anilistId: "al-canonical",
                title: "Jujutsu Kaisen",
                format: "TV",
                episodes: 24,
              }),
            }),
        });

        const canonicalAnime = repo.upsertAnime({
          externalId: "mal-100",
          sourceDb: "mal",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(canonicalAnime.id, "al-canonical");

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-3",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 0,
        });

        const pendingGroup = repo.upsertEpisodeGroup({
          animeId: pendingAnime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        repo.upsertEpisodeFromMatch({
          animeId: pendingAnime.id,
          groupId: pendingGroup.id,
          episode: 1,
          filePath: "/media/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });

        const result = await aggregate.retryPendingIdentification();

        expect(result.resolved).toHaveLength(1);
        expect(result.resolved[0]?.mergedInto).toBe(canonicalAnime.id);

        const deletedAnime = repo.getAnime(pendingAnime.id);
        expect(deletedAnime).toBeNull();

        const canonicalEpisodes = repo.getEpisodesByAnimeId(canonicalAnime.id);
        expect(canonicalEpisodes).toHaveLength(1);
        expect(canonicalEpisodes[0]?.filePath).toBe("/media/S01E01.mkv");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("leaves anime pending when AniList still unavailable", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async () => null,
            }),
        });

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-4",
          sourceDb: "tvdb",
          title: "Still Unknown",
          episodeCount: 5,
        });

        const result = await aggregate.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
        expect(result.stillPending[0]?.id).toBe(pendingAnime.id);

        const anime = repo.getAnime(pendingAnime.id);
        expect(anime?.anilistId).toBeUndefined();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("triggers franchise enrichment for newly resolved anime", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const searchCalls: string[] = [];
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async (title) => {
                searchCalls.push(title);
                return {
                  anilistId: "al-enrich-pending",
                  title,
                  format: "TV",
                  episodes: 12,
                };
              },
            }),
        });

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-5",
          sourceDb: "tvdb",
          title: "Enrich Me",
          episodeCount: 12,
        });

        await aggregate.retryPendingIdentification();

        expect(searchCalls).toContain("Enrich Me");

        const anime = repo.getAnime(pendingAnime.id);
        expect(anime?.franchiseId).not.toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("skips when no enrichment provider available", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
        });

        repo.upsertAnime({
          externalId: "merge-pending-6",
          sourceDb: "tvdb",
          title: "No Provider",
          episodeCount: 1,
        });

        const result = await aggregate.retryPendingIdentification();

        expect(result.resolved).toHaveLength(0);
        expect(result.stillPending).toHaveLength(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("transfers source mappings during merge", async () => {
      const { db, sqlite } = createLibraryDb();
      const { sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const aggregate = new AnimeAggregate({
          library: repo,
          replayUnpushedEvents: () => {},
          computeAndPersistLibraryState: () => {},
          enrichmentProviderFactory: async () =>
            createMockEnrichmentProvider({
              searchByTitle: async () => ({
                anilistId: "al-source",
                title: "Test",
                format: "TV",
                episodes: 12,
              }),
            }),
        });

        const canonicalAnime = repo.upsertAnime({
          externalId: "mal-200",
          sourceDb: "mal",
          title: "Test",
          episodeCount: 0,
        });
        repo.updateAnimeAnilistId(canonicalAnime.id, "al-source");

        const pendingAnime = repo.upsertAnime({
          externalId: "merge-pending-7",
          sourceDb: "tvdb",
          title: "Test",
          episodeCount: 0,
        });
        repo.createAnimeSourceMapping({
          animeId: pendingAnime.id,
          source: "tvdb",
          externalId: "tvdb-999",
        });

        await aggregate.retryPendingIdentification();

        const deletedAnime = repo.getAnime(pendingAnime.id);
        expect(deletedAnime).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
