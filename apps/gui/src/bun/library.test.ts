import { describe, expect, test } from "bun:test";
import { createLibraryDb, withTempDir } from "@kogoro/core";
import { createLibraryHandlers } from "./library";

function seedLibrary(dir: string) {
  const db = createLibraryDb(dir);
  const jjk = db.upsertAnime({
    externalId: "tvdb-12345",
    sourceDb: "tvdb",
    title: "Jujutsu Kaisen",
    titleJapanese: "呪術廻戦",
    entryType: "tv",
    episodeCount: 24,
    coverArtPath: "/covers/jjk.jpg",
  });
  db.addEpisode({
    animeId: jjk.id,
    episodeNumber: 1,
    filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
    title: "Ryomen Sukuna",
    season: 1,
  });
  db.addEpisode({
    animeId: jjk.id,
    episodeNumber: 2,
    filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
    title: "Cursed Womb Must Die",
    season: 1,
  });

  const aot = db.upsertAnime({
    externalId: "tvdb-67890",
    sourceDb: "tvdb",
    title: "Attack on Titan",
    entryType: "tv",
    episodeCount: 25,
    coverArtPath: "/covers/aot.jpg",
  });
  db.addEpisode({
    animeId: aot.id,
    episodeNumber: 1,
    filePath: "/media/Attack on Titan/S01E01.mkv",
    title: "To You, in 2000 Years",
    season: 1,
  });

  db.close();
}

describe("getLibrary handler", () => {
  test("returns formatted anime list from library database", async () => {
    await withTempDir("library-handler", async (dir) => {
      seedLibrary(dir);
      const handlers = createLibraryHandlers(dir);
      const result = await handlers.getLibrary();

      expect(result).toHaveLength(2);
      expect(result[0]?.titleEn).toBe("Attack on Titan");
      expect(result[0]?.entryType).toBe("tv");
      expect(result[0]?.episodeCount).toBe(25);
      expect(result[0]?.coverArt).toBe("/covers/aot.jpg");
      expect(result[1]?.titleEn).toBe("Jujutsu Kaisen");
      expect(result[1]?.episodeCount).toBe(24);
    });
  });

  test("returns empty array when library is empty", async () => {
    await withTempDir("library-handler-empty", async (dir) => {
      const handlers = createLibraryHandlers(dir);
      const result = await handlers.getLibrary();
      expect(result).toHaveLength(0);
    });
  });
});

describe("getAnimeDetail handler", () => {
  test("returns anime with episodes for valid id", async () => {
    await withTempDir("library-handler-detail", async (dir) => {
      seedLibrary(dir);
      const handlers = createLibraryHandlers(dir);
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
    });
  });

  test("returns null for unknown id", async () => {
    await withTempDir("library-handler-detail-miss", async (dir) => {
      seedLibrary(dir);
      const handlers = createLibraryHandlers(dir);
      const result = await handlers.getAnimeDetail({ id: "99999" });
      expect(result).toBeNull();
    });
  });
});
