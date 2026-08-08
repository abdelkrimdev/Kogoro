import { describe, expect, test } from "bun:test";
import { AnidbResolver } from "./anidb-resolver";
import { createLibraryRepos } from "./schema";
import { createLibraryDb } from "./test-utils";

function createTestResolver() {
  const { db, sqlite } = createLibraryDb();
  const { animeRepo } = createLibraryRepos(db);
  const resolver = new AnidbResolver(animeRepo);
  return { resolver, animeRepo, sqlite };
}

describe("AnidbResolver", () => {
  test("resolves by exact title match", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
      animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

      expect(resolver.resolveByTitle("Jujutsu Kaisen")).toBe("al-jjk");
    } finally {
      sqlite.close();
    }
  });

  test("resolves by case-insensitive title match", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
      animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

      expect(resolver.resolveByTitle("jujutsu kaisen")).toBe("al-jjk");
      expect(resolver.resolveByTitle("JUJUTSU KAISEN")).toBe("al-jjk");
    } finally {
      sqlite.close();
    }
  });

  test("resolves by alternative title", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      const anime = animeRepo.upsertAnime({
        title: "Jujutsu Kaisen",
        alternativeTitles: ["呪術廻戦"],
      });
      animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

      expect(resolver.resolveByTitle("呪術廻戦")).toBe("al-jjk");
    } finally {
      sqlite.close();
    }
  });

  test("returns null for unknown title", () => {
    const { resolver, sqlite } = createTestResolver();
    try {
      expect(resolver.resolveByTitle("Unknown Anime")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("returns null when anime has no anidbId", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      animeRepo.upsertAnime({ title: "No ID Anime" });

      expect(resolver.resolveByTitle("No ID Anime")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  test("invalidates cache on invalidate()", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      const anime = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
      animeRepo.updateAnimeAnidbId(anime.id, "al-jjk");

      expect(resolver.resolveByTitle("Jujutsu Kaisen")).toBe("al-jjk");

      resolver.invalidate();

      const anime2 = animeRepo.upsertAnime({ title: "Jujutsu Kaisen" });
      animeRepo.updateAnimeAnidbId(anime2.id, "al-jjk-v2");

      expect(resolver.resolveByTitle("Jujutsu Kaisen")).toBe("al-jjk-v2");
    } finally {
      sqlite.close();
    }
  });

  test("prefers direct title over alternative title", () => {
    const { resolver, animeRepo, sqlite } = createTestResolver();
    try {
      const anime1 = animeRepo.upsertAnime({
        title: "Attack on Titan",
        alternativeTitles: ["Shingeki no Kyojin"],
      });
      animeRepo.updateAnimeAnidbId(anime1.id, "al-aot");

      const anime2 = animeRepo.upsertAnime({
        title: "Shingeki no Kyojin",
      });
      animeRepo.updateAnimeAnidbId(anime2.id, "al-snk");

      expect(resolver.resolveByTitle("Shingeki no Kyojin")).toBe("al-snk");
    } finally {
      sqlite.close();
    }
  });
});
