import { describe, expect, test } from "bun:test";
import type { MatchEntry } from "../types";
import { LibraryRepository } from "./library-repository";
import { LibraryService } from "./library-service";
import { createLibraryDb } from "./test-utils";

describe("LibraryService", () => {
  describe("rebuildFromMatches", () => {
    test("clears existing data and rebuilds from matches", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        repo.upsertAnime({
          externalId: "old-123",
          sourceDb: "tvdb",
          title: "Old Anime",
          entryType: "tv",
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
      }
    });

    test("preserves watch status for matching episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
          title: "Ryomen Sukuna",
          season: 1,
        });
        const ep2 = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });
        repo.setWatchStatus(ep1.id, true, "Great pilot");
        repo.setWatchStatus(ep2.id, false);

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
        const statuses = repo.getWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = repo.getEpisode(s.episodeId);
          return ep?.episodeNumber === 1;
        });
        expect(ep1Status?.watched).toBe(true);
        expect(ep1Status?.notes).toBe("Great pilot");
      } finally {
        sqlite.close();
      }
    });

    test("sets correct episodeCount per anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });

    test("preserves per-anime sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });
  });

  describe("mergeFromMatches", () => {
    test("merges without deleting existing data", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 12,
        });
        const ep1 = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        repo.setWatchStatus(ep1.id, true, "Watched this");

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

        const statuses = repo.getWatchStatusByAnimeId(jjk?.id as number);
        expect(statuses).toHaveLength(1);
        expect(statuses[0]?.watched).toBe(true);
        expect(statuses[0]?.notes).toBe("Watched this");
      } finally {
        sqlite.close();
      }
    });

    test("adds new anime and episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });

    test("merges into existing anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });

    test("does not inflate episodeCount on repeated merges", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });

    test("groups by title instead of animeId for same-sourceDb matches", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });

    test("merges into existing entry when title and sourceDb match", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        repo.upsertAnime({
          externalId: "111",
          sourceDb: "anidb",
          title: "Oshi no Ko",
          entryType: "tv",
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
      }
    });

    test("removes anime from other sourceDbs when switching databases", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

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
      }
    });
  });

  describe("passthrough methods", () => {
    test("delegates to repository", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        expect(service.getAnime(anime.id)).not.toBeNull();
        expect(service.findAnime("tvdb-12345", "tvdb")).not.toBeNull();
        expect(service.listAnime()).toHaveLength(1);
        expect(service.getStats()).toEqual({ animeCount: 1, episodeCount: 0 });
      } finally {
        sqlite.close();
      }
    });

    test("exportMatches converts to MatchEntry format", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
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
      }
    });
  });

  describe("getAnimeDir", () => {
    test("returns common parent directory of episode files", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 2,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          season: 1,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("returns dirname for single episode", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Solo Leveling",
          entryType: "tv",
          episodeCount: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Solo Leveling/S01E01.mkv",
          season: 1,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Solo Leveling");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for anime with no episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Empty Anime",
          entryType: "tv",
          episodeCount: 0,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("narrows to deepest common parent", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Mixed",
          entryType: "tv",
          episodeCount: 2,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Mixed/season1/S01E01.mkv",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Mixed/season2/S02E01.mkv",
          season: 2,
        });

        const dir = service.getAnimeDir(anime.id);
        expect(dir).toBe("/media/Mixed");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("rebuild", () => {
    test("exports current matches and rebuilds library from them", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 2,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        service.rebuild();

        const animeList = repo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Jujutsu Kaisen");
        expect(repo.getEpisodesByAnimeId(animeList[0]?.id as number)).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    test("preserves watch status through rebuild", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 1,
        });
        const ep = repo.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        repo.setWatchStatus(ep.id, true, "Great pilot");

        service.rebuild();

        const rebuilt = repo.findAnime("tvdb-12345", "tvdb");
        const statuses = repo.getWatchStatusByAnimeId(rebuilt?.id as number);
        expect(statuses).toHaveLength(1);
        expect(statuses[0]?.watched).toBe(true);
        expect(statuses[0]?.notes).toBe("Great pilot");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateCoverArtPath", () => {
    test("updates cover art path for existing anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        service.updateCoverArtPath(anime.id, "/media/Jujutsu Kaisen/cover.jpg");

        const updated = service.getAnime(anime.id);
        expect(updated?.coverArtPath).toBe("/media/Jujutsu Kaisen/cover.jpg");
      } finally {
        sqlite.close();
      }
    });

    test("does not affect other anime fields", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        const anime = service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        service.updateCoverArtPath(anime.id, "/media/Jujutsu Kaisen/cover.jpg");

        const updated = service.getAnime(anime.id);
        expect(updated?.title).toBe("Jujutsu Kaisen");
        expect(updated?.entryType).toBe("tv");
        expect(updated?.episodeCount).toBe(24);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("isAnimeInLibrary", () => {
    test("returns true when anime exists with given sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345", "tvdb")).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("returns false when anime does not exist", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        expect(service.isAnimeInLibrary("tvdb-99999", "tvdb")).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("defaults sourceDb to tvdb when not provided", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345")).toBe(true);
      } finally {
        sqlite.close();
      }
    });

    test("does not match wrong sourceDb", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new LibraryRepository(db);
        const service = new LibraryService(repo);

        service.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        expect(service.isAnimeInLibrary("tvdb-12345", "anidb")).toBe(false);
      } finally {
        sqlite.close();
      }
    });
  });
});
