import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnimeRepository, EpisodeRepository, GroupRepository } from "@kogoro/core";
import { AnimeAggregate } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepositories,
  createMockIdentityResolver,
  withTempDir,
} from "@kogoro/core/testing";
import { createLibraryHandlers } from "./library";

function seedLibrary(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
  coverDir?: string,
) {
  const jjk = animeRepo.upsertAnime({
    title: "Jujutsu Kaisen",
    alternativeTitles: ["呪術廻戦", "Jujutsu Kaisen"],
    coverArtPath: coverDir ? join(coverDir, "jjk.jpg") : undefined,
  });
  animeRepo.createAnimeSourceMapping({ animeId: jjk.id, source: "tvdb", externalId: "tvdb-12345" });

  const jjkGroup = groupRepo.upsertEpisodeGroup({
    animeId: jjk.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "plan_to_watch",
  });

  episodeRepo.addEpisode({
    groupId: jjkGroup.id,
    episodeNumber: 1,
    filePath: "/media/Jujutsu Kaisen/S01E01.mkv",
    title: "Ryomen Sukuna",
    watched: false,
  });
  episodeRepo.addEpisode({
    groupId: jjkGroup.id,
    episodeNumber: 2,
    filePath: "/media/Jujutsu Kaisen/S01E02.mkv",
    title: "Cursed Womb Must Die",
    watched: false,
  });

  const aot = animeRepo.upsertAnime({
    title: "Attack on Titan",
    coverArtPath: coverDir ? join(coverDir, "aot.jpg") : undefined,
  });
  animeRepo.createAnimeSourceMapping({ animeId: aot.id, source: "tvdb", externalId: "tvdb-67890" });

  const aotGroup = groupRepo.upsertEpisodeGroup({
    animeId: aot.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "plan_to_watch",
  });

  episodeRepo.addEpisode({
    groupId: aotGroup.id,
    episodeNumber: 1,
    filePath: "/media/Attack on Titan/S01E01.mkv",
    title: "To You, in 2000 Years",
    watched: false,
  });
}

describe("getLibrary handler", () => {
  test("returns formatted anime list from library database", async () => {
    await withTempDir("library-handler", async (dir) => {
      const coverDir = join(dir, "covers");
      mkdirSync(coverDir, { recursive: true });
      writeFileSync(join(coverDir, "aot.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      writeFileSync(join(coverDir, "jjk.jpg"), Buffer.from([0xff, 0xd8, 0xff]));
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      seedLibrary(animeRepo, episodeRepo, groupRepo, coverDir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.getLibrary();

      expect(result).toHaveLength(2);
      expect(result[0]?.titleEn).toBe("Attack on Titan");
      expect(result[0]?.episodeCount).toBe(1);
      expect(result[0]?.coverArt).toStartWith("data:image/jpeg;base64,");
      expect(result[1]?.titleEn).toBe("Jujutsu Kaisen");
      expect(result[1]?.episodeCount).toBe(2);
      closeEvt();
      close();
    });
  });

  test("returns empty array when library is empty", async () => {
    await withTempDir("library-handler-empty", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.getLibrary();
      expect(result).toHaveLength(0);
      closeEvt();
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
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      seedLibrary(animeRepo, episodeRepo, groupRepo, coverDir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const library = await handlers.getLibrary();
      const jjk = library.find((a) => a.titleEn === "Jujutsu Kaisen");

      const result = await handlers.getAnimeDetail({ id: jjk?.id ?? "" });

      expect(result).not.toBeNull();
      expect(result?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.anime.alternativeTitles).toContain("呪術廻戦");
      expect(result?.anime.coverArt).toStartWith("data:image/jpeg;base64,");
      expect(result?.groups).toHaveLength(1);
      expect(result?.groups[0]?.episodes).toHaveLength(2);
      expect(result?.groups[0]?.episodes[0]?.episodeNumber).toBe(1);
      expect(result?.groups[0]?.episodes[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(result?.groups[0]?.episodes[1]?.episodeNumber).toBe(2);
      expect(result?.groups[0]?.episodes[1]?.titleEn).toBe("Cursed Womb Must Die");
      expect(result?.filesOnDisk).toBe(2);
      closeEvt();
      close();
    });
  });

  test("returns null for unknown id", async () => {
    await withTempDir("library-handler-detail-miss", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      seedLibrary(animeRepo, episodeRepo, groupRepo);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.getAnimeDetail({ id: "99999" });
      expect(result).toBeNull();
      closeEvt();
      close();
    });
  });
});

describe("getLibraryStats handler", () => {
  test("returns anime and episode counts from seeded library", async () => {
    await withTempDir("library-handler-stats", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      seedLibrary(animeRepo, episodeRepo, groupRepo);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.getLibraryStats();

      expect(result.animeCount).toBe(2);
      expect(result.episodeCount).toBe(3);
      closeEvt();
      close();
    });
  });

  test("returns zero counts when library is empty", async () => {
    await withTempDir("library-handler-stats-empty", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.getLibraryStats();

      expect(result.animeCount).toBe(0);
      expect(result.episodeCount).toBe(0);
      closeEvt();
      close();
    });
  });
});

describe("mergeMatches", () => {
  test("merges match entries into library", async () => {
    await withTempDir("library-merge", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });

      await aggregate.mergeFromMatches([
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
      closeEvt();
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
        const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
        const { close: closeEvt } = createEventRepository(dir);
        const jjk = animeRepo.upsertAnime({
          title: "Jujutsu Kaisen",
        });
        animeRepo.createAnimeSourceMapping({
          animeId: jjk.id,
          source: "tvdb",
          externalId: "tvdb-12345",
        });

        const jjkGroup = groupRepo.upsertEpisodeGroup({
          animeId: jjk.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        episodeRepo.addEpisode({
          groupId: jjkGroup.id,
          episodeNumber: 1,
          filePath: ep1Path,
          title: "Ryomen Sukuna",
          watched: false,
        });
        episodeRepo.addEpisode({
          groupId: jjkGroup.id,
          episodeNumber: 2,
          filePath: ep2Path,
          title: "Cursed Womb Must Die",
          watched: false,
        });

        const aot = animeRepo.upsertAnime({
          title: "Attack on Titan",
        });
        animeRepo.createAnimeSourceMapping({
          animeId: aot.id,
          source: "tvdb",
          externalId: "tvdb-67890",
        });

        const aotGroup = groupRepo.upsertEpisodeGroup({
          animeId: aot.id,
          entryType: "tv",
          seasonNumber: 1,
          watchStatus: "plan_to_watch",
        });

        episodeRepo.addEpisode({
          groupId: aotGroup.id,
          episodeNumber: 1,
          filePath: ep3Path,
          title: "To You, in 2000 Years",
          watched: false,
        });

        const aggregate = new AnimeAggregate({
          anime: animeRepo,
          episodes: episodeRepo,
          groups: groupRepo,
          replayUnpushedEvents: () => {},
          identityResolver: createMockIdentityResolver(),
          resolveTitleToAnidb: async () => null,
        });
        const handlers = createLibraryHandlers({
          animeAggregate: aggregate,
          episodeRepo,
          groupRepo,
        });

        const result = await handlers.rebuild();
        expect(result.success).toBe(true);

        const library = await handlers.getLibrary();
        expect(library.length).toBeGreaterThan(0);
        closeEvt();
        close();
      });
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  test("returns success when library is empty", async () => {
    await withTempDir("library-rebuild-empty", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      const aggregate = new AnimeAggregate({
        anime: animeRepo,
        episodes: episodeRepo,
        groups: groupRepo,
        replayUnpushedEvents: () => {},
        identityResolver: createMockIdentityResolver(),
        resolveTitleToAnidb: async () => null,
      });
      const handlers = createLibraryHandlers({
        animeAggregate: aggregate,
        episodeRepo,
        groupRepo,
      });
      const result = await handlers.rebuild();
      expect(result.success).toBe(true);
      closeEvt();
      close();
    });
  });
});
