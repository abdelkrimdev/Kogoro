import { describe, expect, test } from "bun:test";
import { AnimeRepository } from "./anime-repository";
import { EpisodeRepository } from "./episode-repository";
import { FranchiseRepository } from "./franchise-repository";
import { GroupRepository } from "./group-repository";
import { createLibraryDb } from "./test-utils";

describe("AnimeRepository", () => {
  describe("upsertAnime", () => {
    test("creates anime and returns it with generated id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          alternativeTitles: ["呪術廻戦"],
        });

        expect(anime.id).toBeGreaterThan(0);
        expect(anime.title).toBe("Jujutsu Kaisen");
        expect(anime.alternativeTitles).toEqual(["呪術廻戦"]);
      } finally {
        sqlite.close();
      }
    });

    test("updates existing anime with same anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({
          title: "Jujutsu Kaisen",
          anidbId: "12345",
        });

        const updated = repo.upsertAnime({
          title: "Jujutsu Kaisen Season 2",
          anidbId: "12345",
        });

        expect(updated.id).toBe(anime.id);
        expect(updated.title).toBe("Jujutsu Kaisen Season 2");
      } finally {
        sqlite.close();
      }
    });

    test("creates separate anime without anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const a1 = repo.upsertAnime({ title: "Anime 1" });
        const a2 = repo.upsertAnime({ title: "Anime 2" });

        expect(a1.id).not.toBe(a2.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getAnime", () => {
    test("retrieves anime by id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const created = repo.upsertAnime({ title: "Jujutsu Kaisen" });

        const retrieved = repo.getAnime(created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.title).toBe("Jujutsu Kaisen");
      } finally {
        sqlite.close();
      }
    });

    test("returns null for nonexistent id", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        expect(repo.getAnime(999)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateAnime", () => {
    test("updates specified fields", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Original" });

        repo.updateAnime(anime.id, { title: "Updated", format: "tv" });

        const updated = repo.getAnime(anime.id);
        expect(updated?.title).toBe("Updated");
        expect(updated?.format).toBe("tv");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findAnime", () => {
    test("finds anime by externalId and source", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Jujutsu Kaisen" });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const found = repo.findAnime("tvdb-12345", "tvdb");
        expect(found?.title).toBe("Jujutsu Kaisen");

        const notFound = repo.findAnime("tvdb-99999", "tvdb");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findAnimeByTitle", () => {
    test("finds anime by exact title", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        repo.upsertAnime({ title: "Jujutsu Kaisen" });

        const found = repo.findAnimeByTitle("Jujutsu Kaisen");
        expect(found).not.toBeNull();

        const notFound = repo.findAnimeByTitle("Nonexistent");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findAnimeByAnidbId", () => {
    test("finds anime by anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        repo.upsertAnime({ title: "Jujutsu Kaisen", anidbId: "12345" });

        const found = repo.findAnimeByAnidbId("12345");
        expect(found?.title).toBe("Jujutsu Kaisen");

        const notFound = repo.findAnimeByAnidbId("99999");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("listAnime", () => {
    test("returns all anime sorted by title", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        repo.upsertAnime({ title: "Z Anime" });
        repo.upsertAnime({ title: "A Anime" });

        const list = repo.listAnime();
        expect(list).toHaveLength(2);
        expect(list[0]?.title).toBe("A Anime");
        expect(list[1]?.title).toBe("Z Anime");
      } finally {
        sqlite.close();
      }
    });

    test("includes filesOnDisk count from episodes", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Test" });

        const groupRepo = new GroupRepository({ db });
        const epRepo = new EpisodeRepository({ db });

        const group = groupRepo.upsertEpisodeGroup({
          animeId: anime.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });
        epRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 1,
          filePath: "/media/S01E01.mkv",
          watched: false,
        });
        epRepo.addEpisode({
          groupId: group.id,
          episodeNumber: 2,
          filePath: "/media/S01E02.mkv",
          watched: false,
        });

        const list = repo.listAnime();
        expect(list[0]?.filesOnDisk).toBe(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAnime", () => {
    test("removes anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Jujutsu Kaisen" });

        repo.deleteAnime(anime.id);
        expect(repo.getAnime(anime.id)).toBeNull();
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAnimeByIds", () => {
    test("removes anime by ids", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const a1 = repo.upsertAnime({ title: "Anime 1" });
        const a2 = repo.upsertAnime({ title: "Anime 2" });

        repo.deleteAnimeByIds([a1.id]);
        expect(repo.getAnime(a1.id)).toBeNull();
        expect(repo.getAnime(a2.id)).not.toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("does nothing for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        repo.deleteAnimeByIds([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("upsertAnimeBatch", () => {
    test("creates multiple anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const results = repo.upsertAnimeBatch([
          { title: "Anime 1", alternativeTitles: ["Alt 1"] },
          { title: "Anime 2" },
        ]);

        expect(results).toHaveLength(2);
        expect(results[0]?.title).toBe("Anime 1");
        expect(results[1]?.title).toBe("Anime 2");
        expect(results[0]?.id).not.toBe(results[1]?.id);
      } finally {
        sqlite.close();
      }
    });

    test("updates existing anime with same anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const first = repo.upsertAnimeBatch([{ title: "Jujutsu Kaisen", anidbId: "anidb-jjk" }]);

        const second = repo.upsertAnimeBatch([
          { title: "Jujutsu Kaisen Season 2", anidbId: "anidb-jjk" },
        ]);

        expect(second[0]?.id).toBe(first[0]?.id);
        expect(second[0]?.title).toBe("Jujutsu Kaisen Season 2");
        expect(repo.listAnime()).toHaveLength(1);
      } finally {
        sqlite.close();
      }
    });

    test("returns empty array for empty input", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        expect(repo.upsertAnimeBatch([])).toEqual([]);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("updateAnimeAnidbId", () => {
    test("updates anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Test" });

        repo.updateAnimeAnidbId(anime.id, "new-anidb-id");
        const updated = repo.getAnime(anime.id);
        expect(updated?.anidbId).toBe("new-anidb-id");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("findPendingAnime", () => {
    test("finds anime with null or temp anidbId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        repo.upsertAnime({ title: "No ID" });
        repo.upsertAnime({ title: "Temp ID", anidbId: "temp:abc" });
        repo.upsertAnime({ title: "Tracker ID", anidbId: "tracker:mal:123" });
        repo.upsertAnime({ title: "Real ID", anidbId: "12345" });

        const pending = repo.findPendingAnime();
        expect(pending).toHaveLength(3);
        expect(pending.map((a) => a.title)).toContain("No ID");
        expect(pending.map((a) => a.title)).toContain("Temp ID");
        expect(pending.map((a) => a.title)).toContain("Tracker ID");
        expect(pending.map((a) => a.title)).not.toContain("Real ID");
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getUnenrichedAnimeIds", () => {
    test("finds anime without franchiseId or source mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const a1 = repo.upsertAnime({ title: "Unenriched" });
        const a2 = repo.upsertAnime({ title: "Has Franchise" });
        repo.upsertAnime({ title: "Has Mapping" });

        const franchiseRepo = new FranchiseRepository({ db });
        const franchise = franchiseRepo.createFranchise({ title: "Test" });
        franchiseRepo.assignAnimeToFranchise(a2.id, franchise.id);

        repo.createAnimeSourceMapping({
          animeId: 3,
          source: "tvdb",
          externalId: "tvdb-123",
        });

        const ids = repo.getUnenrichedAnimeIds();
        expect(ids).toContain(a1.id);
        expect(ids).not.toContain(a2.id);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("deleteAll", () => {
    test("removes all anime and source mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "Test" });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "tvdb",
          externalId: "tvdb-123",
        });

        repo.deleteAll();
        expect(repo.listAnime()).toHaveLength(0);
        expect(repo.getAllAnimeSourceMappings()).toHaveLength(0);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("anime source mappings", () => {
    test("createAnimeSourceMapping upserts on conflict", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "One Piece" });

        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "21",
        });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "99",
        });

        const mapping = repo.getAnimeSourceMapping(anime.id, "anilist");
        expect(mapping?.externalId).toBe("99");
      } finally {
        sqlite.close();
      }
    });

    test("findAnimeSourceMapping finds by source and externalId", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "One Piece" });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "21",
        });

        const found = repo.findAnimeSourceMapping("anilist", "21");
        expect(found?.animeId).toBe(anime.id);

        const notFound = repo.findAnimeSourceMapping("anilist", "999");
        expect(notFound).toBeNull();
      } finally {
        sqlite.close();
      }
    });

    test("getAnimeSourceMappingsByAnimeId returns all for anime", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "One Piece" });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "21",
        });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "mal",
          externalId: "21",
        });

        const mappings = repo.getAnimeSourceMappingsByAnimeId(anime.id);
        expect(mappings).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });

    test("hasAnimeSourceMapping returns boolean", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const anime = repo.upsertAnime({ title: "One Piece" });
        repo.createAnimeSourceMapping({
          animeId: anime.id,
          source: "anilist",
          externalId: "21",
        });

        expect(repo.hasAnimeSourceMapping(anime.id, "anilist")).toBe(true);
        expect(repo.hasAnimeSourceMapping(anime.id, "mal")).toBe(false);
      } finally {
        sqlite.close();
      }
    });

    test("getAllAnimeSourceMappings returns all mappings", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const a1 = repo.upsertAnime({ title: "Anime 1" });
        const a2 = repo.upsertAnime({ title: "Anime 2" });
        repo.createAnimeSourceMapping({
          animeId: a1.id,
          source: "anilist",
          externalId: "1",
        });
        repo.createAnimeSourceMapping({
          animeId: a2.id,
          source: "mal",
          externalId: "2",
        });

        const all = repo.getAllAnimeSourceMappings();
        expect(all).toHaveLength(2);
      } finally {
        sqlite.close();
      }
    });
  });

  describe("getStats", () => {
    test("returns anime and episode counts", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const groupRepo = new GroupRepository({ db });
        const episodeRepo = new EpisodeRepository({ db });
        const anime = repo.upsertAnime({ title: "Jujutsu Kaisen" });
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
          watched: false,
        });

        const stats = repo.getStats();
        expect(stats.animeCount).toBe(1);
        expect(stats.episodeCount).toBe(1);
      } finally {
        sqlite.close();
      }
    });

    test("returns zeros for empty library", () => {
      const { db, sqlite } = createLibraryDb();
      try {
        const repo = new AnimeRepository({ db });
        const stats = repo.getStats();
        expect(stats.animeCount).toBe(0);
        expect(stats.episodeCount).toBe(0);
      } finally {
        sqlite.close();
      }
    });
  });
});
