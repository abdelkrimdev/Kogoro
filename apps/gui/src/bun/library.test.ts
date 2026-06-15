import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LibraryRepository } from "@kogoro/core";
import { LibraryService } from "@kogoro/core";
import { createLibraryRepository, withTempDir } from "@kogoro/core/testing";
import { createLibraryHandlers } from "./library";

function seedLibrary(repo: LibraryRepository, coverDir?: string) {
  const jjk = repo.upsertAnime({
    externalId: "tvdb-12345",
    sourceDb: "tvdb",
    title: "Jujutsu Kaisen",
    titleJapanese: "呪術廻戦",
    entryType: "tv",
    episodeCount: 24,
    coverArtPath: coverDir ? join(coverDir, "jjk.jpg") : undefined,
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
    coverArtPath: coverDir ? join(coverDir, "aot.jpg") : undefined,
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
      const coverDir = join(dir, "covers");
      mkdirSync(coverDir, { recursive: true });
      writeFileSync(join(coverDir, "aot.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      writeFileSync(join(coverDir, "jjk.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo, coverDir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const result = await handlers.getLibrary();

      expect(result).toHaveLength(2);
      expect(result[0]?.titleEn).toBe("Attack on Titan");
      expect(result[0]?.entryType).toBe("tv");
      expect(result[0]?.episodeCount).toBe(25);
      expect(result[0]?.coverArt).toStartWith("data:image/jpeg;base64,");
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
      const coverDir = join(dir, "covers");
      mkdirSync(coverDir, { recursive: true });
      writeFileSync(join(coverDir, "jjk.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      const { repo, close } = createLibraryRepository(dir);
      seedLibrary(repo, coverDir);
      const libraryService = new LibraryService(repo);
      const handlers = createLibraryHandlers({ libraryService });
      const library = await handlers.getLibrary();
      const jjk = library.find((a) => a.titleEn === "Jujutsu Kaisen");

      const result = await handlers.getAnimeDetail({ id: jjk?.id ?? "" });

      expect(result).not.toBeNull();
      expect(result?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.anime.titleJa).toBe("呪術廻戦");
      expect(result?.anime.entryType).toBe("tv");
      expect(result?.anime.coverArt).toStartWith("data:image/jpeg;base64,");
      expect(result?.episodes).toHaveLength(2);
      expect(result?.episodes[0]?.episode).toBe(1);
      expect(result?.episodes[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(result?.episodes[1]?.episode).toBe(2);
      expect(result?.episodes[1]?.titleEn).toBe("Cursed Womb Must Die");
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

      libraryService.mergeFromMatches([
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
    const tmpDir = mkdtempSync(join(tmpdir(), "library-rebuild-"));
    try {
      const ep1Path = join(tmpDir, "Jujutsu Kaisen", "S01E01.mkv");
      const ep2Path = join(tmpDir, "Jujutsu Kaisen", "S01E02.mkv");
      const ep3Path = join(tmpDir, "Attack on Titan", "S01E01.mkv");
      mkdirSync(join(tmpDir, "Jujutsu Kaisen"), { recursive: true });
      mkdirSync(join(tmpDir, "Attack on Titan"), { recursive: true });
      writeFileSync(ep1Path, "");
      writeFileSync(ep2Path, "");
      writeFileSync(ep3Path, "");

      await withTempDir("library-rebuild", async (dir) => {
        const { repo, close } = createLibraryRepository(dir);
        const jjk = repo.upsertAnime({
          externalId: "tvdb-12345",
          sourceDb: "tvdb",
          title: "Jujutsu Kaisen",
          entryType: "tv",
          episodeCount: 2,
        });
        repo.addEpisode({
          animeId: jjk.id,
          episodeNumber: 1,
          filePath: ep1Path,
          title: "Ryomen Sukuna",
          season: 1,
        });
        repo.addEpisode({
          animeId: jjk.id,
          episodeNumber: 2,
          filePath: ep2Path,
          title: "Cursed Womb Must Die",
          season: 1,
        });

        const aot = repo.upsertAnime({
          externalId: "tvdb-67890",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          entryType: "tv",
          episodeCount: 1,
        });
        repo.addEpisode({
          animeId: aot.id,
          episodeNumber: 1,
          filePath: ep3Path,
          title: "To You, in 2000 Years",
          season: 1,
        });

        const libraryService = new LibraryService(repo);
        const handlers = createLibraryHandlers({ libraryService });

        const result = handlers.rebuild();
        expect(result.success).toBe(true);

        const library = await handlers.getLibrary();
        expect(library.length).toBeGreaterThan(0);
        close();
      });
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
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
