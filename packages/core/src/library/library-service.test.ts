import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventRepository } from "../events/event-repository";
import { createEventDb } from "../events/test-utils";
import { createMockTracker } from "../fixtures";
import type { MatchEntry } from "../types";
import { LibraryRepository } from "./library-repository";
import { LibraryService } from "./library-service";
import { createLibraryDb } from "./test-utils";

describe("LibraryService", () => {
  describe("rebuildFromMatches", () => {
    test("clears existing data and rebuilds from matches", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        repo.upsertAnime({
          externalId: "old-123",
          sourceDb: "tvdb",
          title: "Old Anime",
          episodeCount: 12,
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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

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

    test("computes library state after rebuild", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        expect(rebuilt?.libraryState).toBe("on_disk");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("mergeFromMatches", () => {
    test("merges without deleting existing data", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

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

    test("adds new anime and episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk).not.toBeNull();
        expect(jjk?.episodeCount).toBe(2);
        expect(repo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("merges into existing anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(firstMatches);

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

        service.mergeFromMatches(secondMatches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(4);
        expect(repo.getEpisodesByAnimeId(jjk?.id as number)).toHaveLength(4);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not inflate episodeCount on repeated merges", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

        const jjk = repo.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.episodeCount).toBe(2);

        service.mergeFromMatches(matches);

        const updated = repo.findAnime("tvdb-12345", "tvdb");
        expect(updated?.episodeCount).toBe(2);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("groups by title instead of animeId for same-sourceDb matches", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

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

    test("merges into existing entry when title and sourceDb match", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

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

    test("removes anime from other sourceDbs when switching databases", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(anidbMatches);

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

        service.mergeFromMatches(tvdbMatches);

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

    test("computes library state after merge", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.mergeFromMatches(matches);

        const merged = repo.findAnime("tvdb-12345", "tvdb");
        expect(merged?.libraryState).toBe("on_disk");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("passthrough methods", () => {
    test("delegates to repository", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        expect(service.getAnime(anime.id)).not.toBeNull();
        expect(service.findAnime("tvdb-12345", "tvdb")).not.toBeNull();
        expect(service.listAnime()).toHaveLength(1);
        expect(service.getStats()).toEqual({ animeCount: 1, episodeCount: 0 });
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("exportMatches converts to MatchEntry format", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
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

        const matches = service.exportMatches();
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

  describe("getAnimeDir", () => {
    test("returns common parent directory of episode files", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 2,
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
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          season: 1,
          watched: false,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Jujutsu Kaisen");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns dirname for single episode", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Solo Leveling",
          episodeCount: 1,
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
          filePath: "/media/Solo Leveling/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Solo Leveling");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns null for anime with no episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Empty Anime",
          episodeCount: 0,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("narrows to deepest common parent", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Mixed",
          episodeCount: 2,
        });

        const group1 = repo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
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
          filePath: "/media/Mixed/season1/S01E01.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group2.id,
          episodeNumber: 1,
          filePath: "/media/Mixed/season2/S02E01.mkv",
          season: 2,
          watched: false,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Mixed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("strips type directory suffix from common parent", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 2,
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
          filePath: "/media/Jujutsu Kaisen/TV/S01E01.mkv",
          season: 1,
          watched: false,
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/TV/S01E02.mkv",
          season: 1,
          watched: false,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Jujutsu Kaisen");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not strip non-type directory suffix", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Solo Leveling",
          episodeCount: 1,
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
          filePath: "/media/Solo Leveling/season1/S01E01.mkv",
          season: 1,
          watched: false,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Solo Leveling/season1");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("rebuild", () => {
    test("exports current matches and rebuilds library from them", () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        const ep2Path = join(dir, "S01E02.mkv");
        writeFileSync(ep1Path, "");
        writeFileSync(ep2Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            episodeCount: 2,
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
            filePath: ep1Path,
            title: "Ryomen Sukuna",
            season: 1,
            watched: false,
          });
          repo.addEpisode({
            animeId: anime.id,
            groupId: group.id,
            episodeNumber: 2,
            filePath: ep2Path,
            title: "Cursed Womb Must Die",
            season: 1,
            watched: false,
          });

          service.rebuild();

          const animeList = repo.listAnime();
          expect(animeList).toHaveLength(1);
          expect(animeList[0]?.title).toBe("Jujutsu Kaisen");
          expect(repo.getEpisodesByAnimeId(animeList[0]?.id as number)).toHaveLength(2);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("preserves watched status through rebuild", () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            episodeCount: 1,
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
            filePath: ep1Path,
            title: "Ryomen Sukuna",
            season: 1,
            watched: true,
          });

          service.rebuild();

          const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
          const statuses = repo.getEpisodeWatchStatusByAnimeId(rebuilt?.id as number);
          expect(statuses).toHaveLength(1);
          expect(statuses[0]?.watched).toBe(true);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("replays unpushed group status change events", () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-replay-group-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            episodeCount: 1,
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          evtRepo.append({
            entityType: "group",
            entityId: group.id,
            eventType: "status_change",
            oldValue: "plan_to_watch",
            newValue: "completed",
          });

          service.rebuild();

          const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
          expect(rebuilt).not.toBeNull();

          const groups = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
          expect(groups).toHaveLength(1);
          expect(groups[0]?.watchStatus).toBe("completed");
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("replays unpushed episode watched toggle events", () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-replay-episode-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          evtRepo.append({
            entityType: "episode",
            entityId: ep.id,
            eventType: "watched_toggle",
            oldValue: "false",
            newValue: "true",
          });

          service.rebuild();

          const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
          expect(rebuilt).not.toBeNull();

          const episodes = repo.getEpisodesByAnimeId(rebuilt?.id as number);
          expect(episodes).toHaveLength(1);
          expect(episodes[0]?.watched).toBe(true);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("excludes anime with deleted files from rebuilt library", () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-"));
      try {
        const ep1Path = join(dir, "anime1", "S01E01.mkv");
        const ep2Path = join(dir, "anime2", "S01E01.mkv");
        mkdirSync(join(dir, "anime1"), { recursive: true });
        mkdirSync(join(dir, "anime2"), { recursive: true });
        writeFileSync(ep1Path, "");
        writeFileSync(ep2Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const a1 = service.upsertAnime({
            externalId: "tvdb-100",
            sourceDb: "tvdb",
            title: "Anime Still On Disk",
            episodeCount: 1,
          });

          const group1 = repo.upsertEpisodeGroup({
            animeId: a1.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          repo.addEpisode({
            animeId: a1.id,
            groupId: group1.id,
            episodeNumber: 1,
            filePath: ep1Path,
            season: 1,
            watched: false,
          });

          const a2 = service.upsertAnime({
            externalId: "tvdb-200",
            sourceDb: "tvdb",
            title: "Anime Deleted From Disk",
            episodeCount: 1,
          });

          const group2 = repo.upsertEpisodeGroup({
            animeId: a2.id,
            entryType: "tv",
            seasonNumber: 1,
            watchStatus: "plan_to_watch",
          });

          repo.addEpisode({
            animeId: a2.id,
            groupId: group2.id,
            episodeNumber: 1,
            filePath: ep2Path,
            season: 1,
            watched: false,
          });

          rmSync(join(dir, "anime2"), { recursive: true });

          service.rebuild();

          expect(repo.findAnime("tvdb-100", "tvdb")).not.toBeNull();
          expect(repo.findAnime("tvdb-200", "tvdb")).toBeNull();
          expect(repo.listAnime()).toHaveLength(1);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });
  });

  describe("rebuildWithTrackers", () => {
    test("imports tracker entries as new anime when no local match exists", async () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-trackers-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Existing Anime",
            episodeCount: 1,
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          const trackerAnime = [
            {
              trackerId: "mal-99999",
              title: "Tracker Only Anime",
              entryType: "tv" as const,
              watchStatus: "completed" as const,
              episodesWatched: 12,
              totalEpisodes: 12,
            },
          ];

          const mockTracker = createMockTracker({
            getUserList: () => Promise.resolve(trackerAnime),
          });

          await service.rebuildWithTrackers([{ plugin: mockTracker, source: "mal" }]);

          const allAnime = repo.listAnime();
          expect(allAnime).toHaveLength(2);

          const trackerAnimeEntry = repo.findAnime("tracker-mal-99999", "mal");
          expect(trackerAnimeEntry).not.toBeNull();
          expect(trackerAnimeEntry?.title).toBe("Tracker Only Anime");

          const groups = repo.getEpisodeGroupsByAnimeId(trackerAnimeEntry?.id as number);
          expect(groups).toHaveLength(1);
          expect(groups[0]?.watchStatus).toBe("completed");

          const mappings = repo.getTrackerMappingsByGroupId(groups[0]?.id as number);
          expect(mappings).toHaveLength(1);
          expect(mappings[0]?.source).toBe("mal");
          expect(mappings[0]?.externalId).toBe("mal-99999");
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("updates existing group watch status from tracker data", async () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-trackers-update-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            episodeCount: 1,
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          const trackerAnime = [
            {
              trackerId: "mal-12345",
              title: "Jujutsu Kaisen",
              entryType: "tv" as const,
              watchStatus: "watching" as const,
              episodesWatched: 5,
              totalEpisodes: 24,
            },
          ];

          const mockTracker = createMockTracker({
            getUserList: () => Promise.resolve(trackerAnime),
          });

          await service.rebuildWithTrackers([{ plugin: mockTracker, source: "mal" }]);

          const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
          expect(rebuilt).not.toBeNull();

          const groups = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
          expect(groups).toHaveLength(1);
          expect(groups[0]?.watchStatus).toBe("watching");

          const mappings = repo.getTrackerMappingsByGroupId(groups[0]?.id as number);
          expect(mappings).toHaveLength(1);
          expect(mappings[0]?.source).toBe("mal");
          expect(mappings[0]?.externalId).toBe("mal-12345");
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("replays unpushed events after rebuild", async () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-replay-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          evtRepo.append({
            entityType: "group",
            entityId: group.id,
            eventType: "status_change",
            oldValue: "plan_to_watch",
            newValue: "completed",
          });

          evtRepo.append({
            entityType: "episode",
            entityId: ep.id,
            eventType: "watched_toggle",
            oldValue: "false",
            newValue: "true",
          });

          const mockTracker = createMockTracker({
            getUserList: () => Promise.resolve([]),
          });

          await service.rebuildWithTrackers([{ plugin: mockTracker, source: "mal" }]);

          const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
          expect(rebuilt).not.toBeNull();

          const groups = repo.getEpisodeGroupsByAnimeId(rebuilt?.id as number);
          expect(groups).toHaveLength(1);
          expect(groups[0]?.watchStatus).toBe("completed");

          const episodes = repo.getEpisodesByAnimeId(rebuilt?.id as number);
          expect(episodes).toHaveLength(1);
          expect(episodes[0]?.watched).toBe(true);
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });

    test("skips tracker entries that already have mappings", async () => {
      const dir = mkdtempSync(join(tmpdir(), "library-rebuild-skip-"));
      try {
        const ep1Path = join(dir, "S01E01.mkv");
        writeFileSync(ep1Path, "");

        const { db, sqlite } = createLibraryDb();
        const { db: evtDb, sqlite: evtSqlite } = createEventDb();
        try {
          const repo = new LibraryRepository(db);
          const evtRepo = new EventRepository(evtDb);
          const service = new LibraryService(repo, evtRepo);

          const anime = service.upsertAnime({
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            episodeCount: 1,
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
            filePath: ep1Path,
            title: "Episode 1",
            season: 1,
            watched: false,
          });

          repo.upsertGroupTrackerMapping({
            groupId: group.id,
            source: "mal",
            externalId: "mal-12345",
          });

          const trackerAnime = [
            {
              trackerId: "mal-12345",
              title: "Jujutsu Kaisen",
              entryType: "tv" as const,
              watchStatus: "completed" as const,
              episodesWatched: 24,
              totalEpisodes: 24,
            },
          ];

          const mockTracker = createMockTracker({
            getUserList: () => Promise.resolve(trackerAnime),
          });

          await service.rebuildWithTrackers([{ plugin: mockTracker, source: "mal" }]);

          const allAnime = repo.listAnime();
          expect(allAnime).toHaveLength(1);

          const groups = repo.getEpisodeGroupsByAnimeId(allAnime[0]?.id as number);
          expect(groups).toHaveLength(1);

          const mappings = repo.getTrackerMappingsByGroupId(groups[0]?.id as number);
          expect(mappings).toHaveLength(1);
          expect(mappings[0]?.externalId).toBe("mal-12345");
        } finally {
          sqlite.close();
          evtSqlite.close();
        }
      } finally {
        rmSync(dir, { recursive: true });
      }
    });
  });

  describe("updateCoverArtPath", () => {
    test("updates cover art path for existing anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        service.updateCoverArtPath(anime.id, "/media/Jujutsu Kaisen/cover.jpg");

        const updated = service.getAnime(anime.id);
        expect(updated?.coverArtPath).toBe("/media/Jujutsu Kaisen/cover.jpg");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not affect other anime fields", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        service.updateCoverArtPath(anime.id, "/media/Jujutsu Kaisen/cover.jpg");

        const updated = service.getAnime(anime.id);
        expect(updated?.title).toBe("Jujutsu Kaisen");
        expect(updated?.episodeCount).toBe(24);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("isAnimeInLibrary", () => {
    test("returns true when anime exists with given sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345", "tvdb")).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("returns false when anime does not exist", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        expect(service.isAnimeInLibrary("tvdb-99999", "tvdb")).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("defaults sourceDb to tvdb when not provided", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345")).toBe(true);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("does not match wrong sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345", "anidb")).toBe(false);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("episode groups", () => {
    test("returns episode groups for anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
        });

        service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 2,
          watchStatus: "watching",
        });

        const groups = service.getEpisodeGroupsByAnimeId(anime.id);
        expect(groups).toHaveLength(2);
        expect(groups[0]?.watchStatus).toBe("completed");
        expect(groups[1]?.watchStatus).toBe("watching");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("updates episode group watch status", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "completed",
          rating: 9.0,
        });

        expect(updated.watchStatus).toBe("completed");
        expect(updated.rating).toBe(9.0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("tracker mappings", () => {
    test("creates and retrieves tracker mappings", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        const mappings = service.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("mal");
        expect(mappings[0]?.externalId).toBe("12345");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("finds group by tracker external id", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        const found = service.findGroupByTrackerExternalId("mal", "12345");
        expect(found?.groupId).toBe(group.id);

        const notFound = service.findGroupByTrackerExternalId("anilist", "12345");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("setGroupWatchStatus", () => {
    test("updates episode group watch status", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        const updated = service.setGroupWatchStatus(group.id, "completed");
        expect(updated?.watchStatus).toBe("completed");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("updateEpisodeGroupMetadata", () => {
    test("updates group metadata", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const updated = service.updateEpisodeGroupMetadata(group.id, {
          synopsis: "Updated synopsis",
          rating: 9.0,
        });
        expect(updated?.synopsis).toBe("Updated synopsis");
        expect(updated?.rating).toBe(9.0);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("deleteEpisodesByAnimeId", () => {
    test("recomputes library state after deleting all episodes for anime", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

        const anime = repo.findAnime("tvdb-12345", "tvdb");
        expect(anime).toBeDefined();
        expect(anime?.libraryState).toBe("on_disk");

        service.deleteEpisodesByAnimeId(anime?.id as number);

        expect(repo.findAnime("tvdb-12345", "tvdb")?.libraryState).toBe("not_on_disk");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("deleteEpisodesByIds", () => {
    test("recomputes library state after deleting specific episodes", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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
            episodeId: "201",
            episode: 1,
            season: 2,
            title: "Episode 1",
            filePath: "/media/Jujutsu Kaisen/S02E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        service.rebuildFromMatches(matches);

        const anime = repo.findAnime("tvdb-12345", "tvdb");
        expect(anime).toBeDefined();
        expect(anime?.libraryState).toBe("on_disk");

        const episodes = repo.getEpisodesByAnimeId(anime?.id as number);
        const s1ep1 = episodes.find((e) => e.season === 1 && e.episodeNumber === 1);
        expect(s1ep1).toBeDefined();
        service.deleteEpisodesByIds([s1ep1?.id as number]);

        expect(repo.findAnime("tvdb-12345", "tvdb")?.libraryState).toBe("partially_on_disk");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });

    test("sets not_on_disk when all episodes deleted via ids", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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

        service.rebuildFromMatches(matches);

        const anime = repo.findAnime("tvdb-12345", "tvdb");
        expect(anime).toBeDefined();
        expect(anime?.libraryState).toBe("on_disk");

        const episodes = repo.getEpisodesByAnimeId(anime?.id as number);
        service.deleteEpisodesByIds(episodes.map((e) => e.id));

        expect(repo.findAnime("tvdb-12345", "tvdb")?.libraryState).toBe("not_on_disk");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("deleteEpisodeGroup", () => {
    test("deletes episode group", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.deleteEpisodeGroup(group.id);
        expect(service.getEpisodeGroup(group.id)).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getEpisodesByGroupId", () => {
    test("returns episodes belonging to group", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
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

        const groupEpisodes = service.getEpisodesByGroupId(group.id);
        expect(groupEpisodes).toHaveLength(1);
        expect(groupEpisodes[0]?.episodeNumber).toBe(1);
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("getTrackerMapping", () => {
    test("returns single mapping", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });

        const mapping = service.getTrackerMapping(group.id, "mal");
        expect(mapping?.externalId).toBe("12345");

        const notFound = service.getTrackerMapping(group.id, "anilist");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("removeTrackerMappingsBySource", () => {
    test("removes all mappings for source", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });
        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "67890",
        });

        service.removeTrackerMappingsBySource("mal");

        const mappings = service.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("removeTrackerMapping", () => {
    test("removes single mapping", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "mal",
          externalId: "12345",
        });
        service.upsertGroupTrackerMapping({
          groupId: group.id,
          source: "anilist",
          externalId: "67890",
        });

        service.removeTrackerMapping(group.id, "mal");

        const mappings = service.getTrackerMappingsByGroupId(group.id);
        expect(mappings).toHaveLength(1);
        expect(mappings[0]?.source).toBe("anilist");
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("event logging", () => {
    test("setGroupWatchStatus records status_change event", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        service.setGroupWatchStatus(group.id, "completed");

        const events = evtRepo.replay();
        expect(events).toHaveLength(1);
        expect(events[0]?.entityType).toBe("group");
        expect(events[0]?.entityId).toBe(group.id);
        expect(events[0]?.eventType).toBe("status_change");
        expect(events[0]?.oldValue).toBe("plan_to_watch");
        expect(events[0]?.newValue).toBe("completed");
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("setGroupWatchStatus skips event when status unchanged", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.setGroupWatchStatus(group.id, "watching");

        const events = evtRepo.replay();
        expect(events).toHaveLength(0);
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("setEpisodeWatched records watched_toggle event", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const ep = libRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        service.setEpisodeWatched(ep.id, true);

        const events = evtRepo.replay();
        expect(events).toHaveLength(1);
        expect(events[0]?.entityType).toBe("episode");
        expect(events[0]?.entityId).toBe(ep.id);
        expect(events[0]?.eventType).toBe("watched_toggle");
        expect(events[0]?.oldValue).toBe("false");
        expect(events[0]?.newValue).toBe("true");
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("setEpisodeWatched skips event when watched unchanged", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const ep = libRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        service.setEpisodeWatched(ep.id, false);

        const events = evtRepo.replay();
        expect(events).toHaveLength(0);
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("updateEpisodeGroupMetadata records notes_update for synopsis change", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.updateEpisodeGroupMetadata(group.id, { synopsis: "A great anime" });

        const events = evtRepo.replay();
        expect(events).toHaveLength(1);
        expect(events[0]?.entityType).toBe("group");
        expect(events[0]?.entityId).toBe(group.id);
        expect(events[0]?.eventType).toBe("notes_update");
        expect(events[0]?.oldValue).toBeNull();
        expect(events[0]?.newValue).toBe("A great anime");
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("updateEpisodeGroupMetadata records notes_update for rating change", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        service.updateEpisodeGroupMetadata(group.id, { rating: 8.5 });

        const events = evtRepo.replay();
        expect(events).toHaveLength(1);
        expect(events[0]?.eventType).toBe("notes_update");
        expect(events[0]?.oldValue).toBeNull();
        expect(events[0]?.newValue).toBe("8.5");
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("updateEpisodeGroupMetadata skips event when synopsis unchanged", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
          synopsis: "Same synopsis",
        });

        service.updateEpisodeGroupMetadata(group.id, { synopsis: "Same synopsis" });

        const events = evtRepo.replay();
        expect(events).toHaveLength(0);
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("updateEpisodeNotes records notes_update event", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const ep = libRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
        });

        service.updateEpisodeNotes(ep.id, "Great pilot episode");

        const events = evtRepo.replay();
        expect(events).toHaveLength(1);
        expect(events[0]?.entityType).toBe("episode");
        expect(events[0]?.entityId).toBe(ep.id);
        expect(events[0]?.eventType).toBe("notes_update");
        expect(events[0]?.oldValue).toBeNull();
        expect(events[0]?.newValue).toBe("Great pilot episode");
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });

    test("updateEpisodeNotes skips event when notes unchanged", () => {
      const { db: libDb, sqlite: libSqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const libRepo = new LibraryRepository(libDb);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(libRepo, evtRepo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          episodeCount: 24,
        });

        const group = service.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "watching",
        });

        const ep = libRepo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
          watched: false,
          notes: "Same notes",
        });

        service.updateEpisodeNotes(ep.id, "Same notes");

        const events = evtRepo.replay();
        expect(events).toHaveLength(0);
      } finally {
        libSqlite.close();
        evtSqlite.close();
      }
    });
  });

  describe("rebuildFromMatches - episode notes", () => {
    test("preserves episode notes across rebuild", () => {
      const { db, sqlite } = createLibraryDb();
      const { db: evtDb, sqlite: evtSqlite } = createEventDb();
      try {
        const repo = new LibraryRepository(db);
        const evtRepo = new EventRepository(evtDb);
        const service = new LibraryService(repo, evtRepo);

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
          notes: "Amazing pilot",
        });
        repo.addEpisode({
          animeId: anime.id,
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
          watched: false,
          notes: "",
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

        service.rebuildFromMatches(matches);

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        const episodes = repo.getEpisodesByAnimeId(rebuilt?.id as number);
        expect(episodes).toHaveLength(2);

        const ep1 = episodes.find((e) => e.episodeNumber === 1);
        expect(ep1?.notes).toBe("Amazing pilot");

        const ep2 = episodes.find((e) => e.episodeNumber === 2);
        expect(ep2?.notes).toBeUndefined();
      } finally {
        sqlite.close();
        evtSqlite.close();
      }
    });
  });
});
