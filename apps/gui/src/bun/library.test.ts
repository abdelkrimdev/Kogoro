import { describe, expect, test } from "bun:test";
import type { LibraryRepository } from "@kogoro/core";
import { createLibraryRepository, LibraryService, withTempDir } from "@kogoro/core";
import { createLibraryHandlers } from "./library";

function seedLibrary(repo: LibraryRepository) {
  const jjk = repo.upsertAnime({
    externalId: "tvdb-12345",
    sourceDb: "tvdb",
    title: "Jujutsu Kaisen",
    titleJapanese: "呪術廻戦",
    entryType: "tv",
    episodeCount: 24,
    coverArtPath: "/covers/jjk.jpg",
  });
  repo.addEpisode({
    animeId: jjk.id,
    episodeNumber: 1,
    filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
    title: "Ryomen Sukuna",
    season: 1,
  });
  repo.addEpisode({
    animeId: jjk.id,
    episodeNumber: 2,
    filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
    title: "Cursed Womb Must Die",
    season: 1,
  });

  const aot = repo.upsertAnime({
    externalId: "tvdb-67890",
    sourceDb: "tvdb",
    title: "Attack on Titan",
    entryType: "tv",
    episodeCount: 25,
    coverArtPath: "/covers/aot.jpg",
  });
  repo.addEpisode({
    animeId: aot.id,
    episodeNumber: 1,
    filePath: "/media/Attack on Titan/S01E01.mkv",
    title: "To You, in 2000 Years",
    season: 1,
  });
}

describe("getLibrary handler", () => {
  test("returns formatted anime list from library database", async () => {
    await withTempDir("library-handler", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getLibrary();

      expect(result).toHaveLength(2);
      expect(result[0]?.titleEn).toBe("Attack on Titan");
      expect(result[0]?.entryType).toBe("tv");
      expect(result[0]?.episodeCount).toBe(25);
      expect(result[0]?.coverArt).toBe("/covers/aot.jpg");
      expect(result[1]?.titleEn).toBe("Jujutsu Kaisen");
      expect(result[1]?.episodeCount).toBe(24);
      close();
    });
  });

  test("returns empty array when library is empty", async () => {
    await withTempDir("library-handler-empty", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getLibrary();
      expect(result).toHaveLength(0);
      close();
    });
  });
});

describe("getAnimeDetail handler", () => {
  test("returns anime with episodes for valid id", async () => {
    await withTempDir("library-handler-detail", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const library = await handlers.getLibrary();
      const jjk = library.find((a) => a.titleEn === "Jujutsu Kaisen");

      const result = await handlers.getAnimeDetail({ id: jjk?.id ?? "" });

      expect(result).not.toBeNull();
      expect(result?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.anime.titleJa).toBe("呪術廻戦");
      expect(result?.anime.entryType).toBe("tv");
      expect(result?.anime.coverArt).toBe("/covers/jjk.jpg");
      expect(result?.episodes).toHaveLength(2);
      expect(result?.episodes[0]?.episode).toBe(1);
      expect(result?.episodes[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(result?.episodes[1]?.episode).toBe(2);
      expect(result?.filesOnDisk).toBe(2);
      close();
    });
  });

  test("returns null for unknown id", async () => {
    await withTempDir("library-handler-detail-miss", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getAnimeDetail({ id: "99999" });
      expect(result).toBeNull();
      close();
    });
  });
});

describe("getLibraryStats handler", () => {
  test("returns anime and episode counts from seeded library", async () => {
    await withTempDir("library-handler-stats", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getLibraryStats();

      expect(result.animeCount).toBe(2);
      expect(result.episodeCount).toBe(3);
      close();
    });
  });

  test("returns zero counts when library is empty", async () => {
    await withTempDir("library-handler-stats-empty", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getLibraryStats();

      expect(result.animeCount).toBe(0);
      expect(result.episodeCount).toBe(0);
      close();
    });
  });
});

describe("mergeMatches", () => {
  test("merges match entries into library", async () => {
    await withTempDir("library-merge", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });

      handlers.mergeMatches([
        {
          animeId: "tvdb-12345",
          animeTitle: "My Anime",
          entryType: "tv",
          episodeId: "101",
          episode: 1,
          season: 1,
          title: "Ep 1",
          filePath: "/media/My Anime/S01E01.mkv",
          sourceDb: "tvdb",
        },
      ]);

      const library = await handlers.getLibrary();
      expect(library).toHaveLength(1);
      expect(library[0]?.titleEn).toBe("My Anime");
      close();
    });
  });
});

describe("rebuild", () => {
  test("rebuilds library from existing data", async () => {
    await withTempDir("library-rebuild", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });

      const result = handlers.rebuild();
      expect(result.success).toBe(true);

      const library = await handlers.getLibrary();
      expect(library.length).toBeGreaterThan(0);
      close();
    });
  });

  test("returns success when library is empty", async () => {
    await withTempDir("library-rebuild-empty", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = handlers.rebuild();
      expect(result.success).toBe(true);
      close();
    });
  });
});
