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
          },
        ];

        db.rebuildFromMatches(matches, "tvdb");

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
});
