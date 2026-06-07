import { describe, expect, test } from "bun:test";
import { withTempDir } from "../fixtures";
import { LibraryDb } from "./library-db";

describe("LibraryDb", () => {
  test("creates schema and inserts anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
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
        db.close();
      }
    });
  });

  test("getAnime retrieves anime by id", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const inserted = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const retrieved = db.getAnime(inserted.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Jujutsu Kaisen");
        expect(retrieved?.externalId).toBe("tvdb-12345");
      } finally {
        db.close();
      }
    });
  });

  test("findAnime retrieves anime by external ID and source DB", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const found = db.findAnime("tvdb-12345", "tvdb");
        expect(found).not.toBeNull();
        expect(found?.title).toBe("Jujutsu Kaisen");

        const notFound = db.findAnime("tvdb-99999", "tvdb");
        expect(notFound).toBeNull();
      } finally {
        db.close();
      }
    });
  });

  test("upsertAnime updates existing anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const updated = db.upsertAnime({
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
        db.close();
      }
    });
  });

  test("listAnime returns all anime sorted by title", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        db.upsertAnime({
          externalId: "tvdb-1",
          sourceDb: "tvdb",
          title: "Z anime",
          entryType: "tv",
          episodeCount: 12,
        });
        db.upsertAnime({
          externalId: "tvdb-2",
          sourceDb: "tvdb",
          title: "A anime",
          entryType: "movie",
          episodeCount: 1,
        });

        const list = db.listAnime();
        expect(list).toHaveLength(2);
        expect(list[0]?.title).toBe("A anime");
        expect(list[1]?.title).toBe("Z anime");
      } finally {
        db.close();
      }
    });
  });

  test("listAnime includes filesOnDisk count", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-1",
          sourceDb: "tvdb",
          title: "Steins;Gate",
          entryType: "tv",
          episodeCount: 24,
        });

        db.addEpisode({ animeId: anime.id, episodeNumber: 1, filePath: "/media/S01E01.mkv" });
        db.addEpisode({ animeId: anime.id, episodeNumber: 2, filePath: "/media/S01E02.mkv" });

        const list = db.listAnime();
        expect(list).toHaveLength(1);
        expect(list[0]?.filesOnDisk).toBe(2);
      } finally {
        db.close();
      }
    });
  });

  test("deleteAnime removes anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        db.deleteAnime(anime.id);
        expect(db.getAnime(anime.id)).toBeNull();
      } finally {
        db.close();
      }
    });
  });

  test("addEpisode inserts episode", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const episode = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });

        expect(episode.id).toBeGreaterThan(0);
        expect(episode.animeId).toBe(anime.id);
        expect(episode.episodeNumber).toBe(1);
        expect(episode.filePath).toBe("/media/Jujutsu Kaisen/S01E01.mkv");
        expect(episode.title).toBe("Ryomen Sukuna");
        expect(episode.season).toBe(1);
      } finally {
        db.close();
      }
    });
  });

  test("getEpisode retrieves episode by id", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const inserted = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });

        const retrieved = db.getEpisode(inserted.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Ryomen Sukuna");
        expect(retrieved?.filePath).toBe("/media/Jujutsu Kaisen/S01E01.mkv");
      } finally {
        db.close();
      }
    });
  });

  test("getEpisodesByAnimeId returns episodes for anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const episodes = db.getEpisodesByAnimeId(anime.id);
        expect(episodes).toHaveLength(2);
        expect(episodes[0]?.episodeNumber).toBe(1);
        expect(episodes[1]?.episodeNumber).toBe(2);
      } finally {
        db.close();
      }
    });
  });

  test("addEpisode updates existing episode with same number and season", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const first = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/old-path.mkv",
          title: "Old Title",
          season: 1,
        });

        const updated = db.addEpisode({
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
        db.close();
      }
    });
  });

  test("deleteEpisodesByAnimeId removes all episodes for anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          season: 1,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          season: 1,
        });

        db.deleteEpisodesByAnimeId(anime.id);
        const episodes = db.getEpisodesByAnimeId(anime.id);
        expect(episodes).toHaveLength(0);
      } finally {
        db.close();
      }
    });
  });

  test("mergeAnime adds new episodes to existing anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const existing = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [
            { episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 },
            { episodeNumber: 2, filePath: "/media/S01E02.mkv", season: 1 },
          ],
        );

        expect(existing.merged).toBe(false);
        expect(existing.episodes).toHaveLength(2);

        const merged = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [
            { episodeNumber: 3, filePath: "/media/S01E03.mkv", season: 1 },
            { episodeNumber: 4, filePath: "/media/S01E04.mkv", season: 1 },
          ],
        );

        expect(merged.merged).toBe(true);
        expect(merged.anime.id).toBe(existing.anime.id);
        expect(merged.episodes).toHaveLength(2);

        const allEpisodes = db.getEpisodesByAnimeId(existing.anime.id);
        expect(allEpisodes).toHaveLength(4);
      } finally {
        db.close();
      }
    });
  });

  test("mergeAnime creates new entry when switching databases", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const tvdbAnime = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 24,
          },
          [{ episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 }],
        );

        const anidbAnime = db.mergeAnime(
          {
            externalId: "anidb-67890",
            sourceDb: "anidb",
            title: "呪術廻戦",
            entryType: "tv",
            episodeCount: 24,
          },
          [{ episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 }],
        );

        expect(anidbAnime.merged).toBe(false);
        expect(anidbAnime.anime.id).not.toBe(tvdbAnime.anime.id);

        const list = db.listAnime();
        expect(list).toHaveLength(2);
      } finally {
        db.close();
      }
    });
  });

  test("mergeAnime handles new season", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const season1 = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [{ episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 }],
        );

        const season2 = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [{ episodeNumber: 1, filePath: "/media/S02E01.mkv", season: 2 }],
        );

        expect(season2.merged).toBe(true);
        expect(season2.anime.id).toBe(season1.anime.id);

        const episodes = db.getEpisodesByAnimeId(season1.anime.id);
        expect(episodes).toHaveLength(2);
        expect(episodes[0]?.season).toBe(1);
        expect(episodes[1]?.season).toBe(2);
      } finally {
        db.close();
      }
    });
  });

  test("rebuildFromMatches clears existing data and rebuilds from matches", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        db.upsertAnime({
          externalId: "old-123",
          sourceDb: "tvdb",
          title: "Old Anime",
          entryType: "tv",
          episodeCount: 12,
        });

        const matches = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv" as const,
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
            entryType: "tv" as const,
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
            entryType: "tv" as const,
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/Attack on Titan/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        db.rebuildFromMatches(matches);

        const animeList = db.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = db.findAnime("tvdb-12345", "tvdb");
        expect(jjk).not.toBeNull();
        expect(jjk?.title).toBe("Jujutsu Kaisen");

        const jjkEpisodes = db.getEpisodesByAnimeId(jjk?.id as number);
        expect(jjkEpisodes).toHaveLength(2);

        const aot = db.findAnime("tvdb-67890", "tvdb");
        expect(aot).not.toBeNull();
        expect(aot?.title).toBe("Attack on Titan");

        const aotEpisodes = db.getEpisodesByAnimeId(aot?.id as number);
        expect(aotEpisodes).toHaveLength(1);
      } finally {
        db.close();
      }
    });
  });

  test("setWatchStatus marks episode as watched", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const episode = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        const status = db.setWatchStatus(episode.id, true, "Great episode!");
        expect(status.episodeId).toBe(episode.id);
        expect(status.watched).toBe(true);
        expect(status.notes).toBe("Great episode!");
        expect(status.updatedAt).toBeTruthy();

        const retrieved = db.getWatchStatus(episode.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.watched).toBe(true);
        expect(retrieved?.notes).toBe("Great episode!");
      } finally {
        db.close();
      }
    });
  });

  test("setWatchStatus updates existing status", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const episode = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        db.setWatchStatus(episode.id, true, "First note");
        const updated = db.setWatchStatus(episode.id, false, "Changed mind");

        expect(updated.watched).toBe(false);
        expect(updated.notes).toBe("Changed mind");

        const retrieved = db.getWatchStatus(episode.id);
        expect(retrieved?.watched).toBe(false);
        expect(retrieved?.notes).toBe("Changed mind");
      } finally {
        db.close();
      }
    });
  });

  test("getWatchStatusByAnimeId returns all watch statuses for anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });

        const ep1 = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });
        const ep2 = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          season: 1,
        });

        db.setWatchStatus(ep1.id, true);
        db.setWatchStatus(ep2.id, false);

        const statuses = db.getWatchStatusByAnimeId(anime.id);
        expect(statuses).toHaveLength(2);
        expect(statuses[0]?.watched).toBe(true);
        expect(statuses[1]?.watched).toBe(false);
      } finally {
        db.close();
      }
    });
  });

  test("getStats returns anime and episode counts", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          season: 1,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          season: 1,
        });

        const stats = db.getStats();
        expect(stats.animeCount).toBe(1);
        expect(stats.episodeCount).toBe(2);
      } finally {
        db.close();
      }
    });
  });

  test("getStats returns zero counts for empty library", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const stats = db.getStats();
        expect(stats.animeCount).toBe(0);
        expect(stats.episodeCount).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  test("exportMatches returns empty array for empty library", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const matches = db.exportMatches();
        expect(matches).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  test("exportMatches exports all anime with episodes as MatchEntry array", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const anime2 = db.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          entryType: "tv",
          episodeCount: 25,
        });
        db.addEpisode({
          animeId: anime2.id,
          episodeNumber: 1,
          filePath: "/media/Attack on Titan/S01E01.mkv",
          title: "To You, in 2000 Years",
          season: 1,
        });

        const matches = db.exportMatches();
        expect(matches).toHaveLength(3);

        const jjkMatches = matches.filter((m) => m.animeId === "tvdb-12345");
        expect(jjkMatches).toHaveLength(2);
        expect(jjkMatches[0]?.animeTitle).toBe("Jujutsu Kaisen");
        expect(jjkMatches[0]?.entryType).toBe("tv");
        expect(jjkMatches[0]?.episode).toBe(1);
        expect(jjkMatches[0]?.filePath).toBe("/media/Jujutsu Kaisen/S01E01.mkv");
        expect(jjkMatches[0]?.title).toBe("Ryomen Sukuna");
        expect(jjkMatches[0]?.season).toBe(1);

        const aotMatches = matches.filter((m) => m.animeId === "tvdb-67890");
        expect(aotMatches).toHaveLength(1);
        expect(aotMatches[0]?.animeTitle).toBe("Attack on Titan");
        expect(aotMatches[0]?.episode).toBe(1);
        expect(aotMatches[0]?.filePath).toBe("/media/Attack on Titan/S01E01.mkv");
      } finally {
        db.close();
      }
    });
  });

  test("exportMatches roundtrips through rebuildFromMatches", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const exported = db.exportMatches();
        expect(exported).toHaveLength(2);

        db.rebuildFromMatches(exported);

        const animeList = db.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("Jujutsu Kaisen");
        expect(animeList[0]?.episodeCount).toBe(2);

        const episodes = db.getEpisodesByAnimeId(animeList[0]?.id as number);
        expect(episodes).toHaveLength(2);
      } finally {
        db.close();
      }
    });
  });

  test("watch status persists across database instances", async () => {
    await withTempDir("library-db", async (dir) => {
      const dbPath = `${dir}/library.db`;

      const db1 = new LibraryDb({ dbPath });
      const anime = db1.upsertAnime({
        externalId: "tvdb-12345",
        sourceDb: "tvdb",
        title: "Jujutsu Kaisen",
        entryType: "tv",
        episodeCount: 24,
      });
      const episode = db1.addEpisode({
        animeId: anime.id,
        episodeNumber: 1,
        filePath: "/media/S01E01.mkv",
        season: 1,
      });
      const episodeId = episode.id;
      db1.setWatchStatus(episodeId, true, "Persistent note");
      db1.close();

      const db2 = new LibraryDb({ dbPath });
      const status = db2.getWatchStatus(episodeId);
      expect(status).not.toBeNull();
      expect(status?.watched).toBe(true);
      expect(status?.notes).toBe("Persistent note");
      db2.close();
    });
  });

  test("rebuildFromMatches preserves watch status for matching episodes", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 24,
        });
        const ep1 = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          title: "Ryomen Sukuna",
          season: 1,
        });
        const ep2 = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 2,
          filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
          title: "Cursed Womb Must Die",
          season: 1,
        });
        db.setWatchStatus(ep1.id, true, "Great pilot");
        db.setWatchStatus(ep2.id, false);

        const matches = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv" as const,
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
            entryType: "tv" as const,
            episodeId: "102",
            episode: 2,
            season: 1,
            title: "Cursed Womb Must Die",
            filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
            sourceDb: "tvdb",
          },
        ];

        db.rebuildFromMatches(matches);

        const animeList = db.listAnime();
        expect(animeList).toHaveLength(1);

        const episodes = db.getEpisodesByAnimeId(animeList[0]?.id as number);
        expect(episodes).toHaveLength(2);

        const statuses = db.getWatchStatusByAnimeId(animeList[0]?.id as number);
        expect(statuses).toHaveLength(2);
        const ep1Status = statuses.find((s) => {
          const ep = episodes.find((e) => e.id === s.episodeId);
          return ep?.episodeNumber === 1;
        });
        const ep2Status = statuses.find((s) => {
          const ep = episodes.find((e) => e.id === s.episodeId);
          return ep?.episodeNumber === 2;
        });
        expect(ep1Status?.watched).toBe(true);
        expect(ep1Status?.notes).toBe("Great pilot");
        expect(ep2Status?.watched).toBe(false);
      } finally {
        db.close();
      }
    });
  });

  test("mergeFromMatches merges without deleting existing data", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const anime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 12,
        });
        const ep1 = db.addEpisode({
          animeId: anime.id,
          episodeNumber: 1,
          filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
          season: 1,
        });
        db.setWatchStatus(ep1.id, true, "Watched this");

        const matches = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv" as const,
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
            entryType: "tv" as const,
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
            entryType: "tv" as const,
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/Attack on Titan/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        db.mergeFromMatches(matches);

        const animeList = db.listAnime();
        expect(animeList).toHaveLength(2);

        const jjk = db.findAnime("tvdb-12345", "tvdb");
        expect(jjk?.title).toBe("Jujutsu Kaisen");
        expect(jjk?.episodeCount).toBe(2);

        const jjkEpisodes = db.getEpisodesByAnimeId(jjk?.id as number);
        expect(jjkEpisodes).toHaveLength(2);

        const statuses = db.getWatchStatusByAnimeId(jjk?.id as number);
        expect(statuses).toHaveLength(1);
        expect(statuses[0]?.watched).toBe(true);
        expect(statuses[0]?.notes).toBe("Watched this");

        const aot = db.findAnime("tvdb-67890", "tvdb");
        expect(aot?.title).toBe("Attack on Titan");
      } finally {
        db.close();
      }
    });
  });

  test("mergeAnime does not inflate episodeCount on repeated merges", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const first = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [
            { episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 },
            { episodeNumber: 2, filePath: "/media/S01E02.mkv", season: 1 },
          ],
        );

        expect(first.anime.episodeCount).toBe(2);

        const second = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 2,
          },
          [
            { episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 },
            { episodeNumber: 2, filePath: "/media/S01E02.mkv", season: 1 },
          ],
        );

        expect(second.merged).toBe(true);
        expect(second.anime.episodeCount).toBe(2);

        const third = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 2,
          },
          [
            { episodeNumber: 3, filePath: "/media/S01E03.mkv", season: 1 },
            { episodeNumber: 4, filePath: "/media/S01E04.mkv", season: 1 },
          ],
        );

        expect(third.anime.episodeCount).toBe(4);
      } finally {
        db.close();
      }
    });
  });

  test("rebuildFromMatches sets correct episodeCount per anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const matches = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv" as const,
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
            entryType: "tv" as const,
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
            entryType: "tv" as const,
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/Attack on Titan/S01E01.mkv",
            sourceDb: "tvdb",
          },
        ];

        db.rebuildFromMatches(matches);

        const animeList = db.listAnime();
        const jjk = animeList.find((a) => a.title === "Jujutsu Kaisen");
        expect(jjk?.episodeCount).toBe(2);

        const aot = animeList.find((a) => a.title === "Attack on Titan");
        expect(aot?.episodeCount).toBe(1);
      } finally {
        db.close();
      }
    });
  });

  test("rebuildFromMatches preserves per-anime sourceDb", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const matches = [
          {
            animeId: "tvdb-12345",
            animeTitle: "Jujutsu Kaisen",
            entryType: "tv" as const,
            episodeId: "101",
            episode: 1,
            season: 1,
            title: "Ryomen Sukuna",
            filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
            sourceDb: "tvdb",
          },
          {
            animeId: "anidb-67890",
            animeTitle: "Attack on Titan",
            entryType: "tv" as const,
            episodeId: "201",
            episode: 1,
            season: 1,
            title: "To You, in 2000 Years",
            filePath: "/media/Attack on Titan/S01E01.mkv",
            sourceDb: "anidb",
          },
        ];

        db.rebuildFromMatches(matches);

        const jjk = db.findAnime("tvdb-12345", "tvdb");
        expect(jjk).not.toBeNull();

        const aot = db.findAnime("anidb-67890", "anidb");
        expect(aot).not.toBeNull();

        const wrongAot = db.findAnime("anidb-67890", "tvdb");
        expect(wrongAot).toBeNull();
      } finally {
        db.close();
      }
    });
  });

  test("exportMatches includes sourceDb per anime", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const tvdbAnime = db.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 1,
        });
        db.addEpisode({
          animeId: tvdbAnime.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          season: 1,
        });

        const anidbAnime = db.upsertAnime({
          externalId: "anidb-67890",
          sourceDb: "anidb",
          title: "Attack on Titan",
          entryType: "tv",
          episodeCount: 1,
        });
        db.addEpisode({
          animeId: anidbAnime.id,
          episodeNumber: 1,
          filePath: "/media/AoT/S01E01.mkv",
          season: 1,
        });

        const matches = db.exportMatches();
        expect(matches).toHaveLength(2);

        const tvdbMatch = matches.find((m) => m.animeId === "tvdb-12345");
        expect(tvdbMatch?.sourceDb).toBe("tvdb");

        const anidbMatch = matches.find((m) => m.animeId === "anidb-67890");
        expect(anidbMatch?.sourceDb).toBe("anidb");
      } finally {
        db.close();
      }
    });
  });

  test("mergeAnime handles multi-season episodes correctly", async () => {
    await withTempDir("library-db", async (dir) => {
      const db = new LibraryDb({ dbPath: `${dir}/library.db` });
      try {
        const first = db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [
            { episodeNumber: 1, filePath: "/media/S01E01.mkv", season: 1 },
            { episodeNumber: 2, filePath: "/media/S01E02.mkv", season: 1 },
          ],
        );

        db.mergeAnime(
          {
            externalId: "tvdb-12345",
            sourceDb: "tvdb",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodeCount: 12,
          },
          [
            { episodeNumber: 1, filePath: "/media/S02E01.mkv", season: 2 },
            { episodeNumber: 2, filePath: "/media/S02E02.mkv", season: 2 },
          ],
        );

        const episodes = db.getEpisodesByAnimeId(first.anime.id);
        expect(episodes).toHaveLength(4);
        expect(episodes[0]?.season).toBe(1);
        expect(episodes[1]?.season).toBe(1);
        expect(episodes[2]?.season).toBe(2);
        expect(episodes[3]?.season).toBe(2);

        const anime = db.getAnime(first.anime.id);
        expect(anime?.episodeCount).toBe(4);
      } finally {
        db.close();
      }
    });
  });
});
