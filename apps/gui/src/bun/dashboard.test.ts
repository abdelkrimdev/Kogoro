import { describe, expect, test } from "bun:test";
import type { AnimeRepository, EpisodeRepository, GroupRepository } from "@kogoro/core";
import { AnimeQuery } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepositories,
  withTempDir,
} from "@kogoro/core/testing";
import { createDashboardHandlers } from "./dashboard";

function seedWatchingAnime(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
) {
  const sg = animeRepo.upsertAnime({
    title: "Steins;Gate",
  });
  animeRepo.createAnimeSourceMapping({ animeId: sg.id, source: "tvdb", externalId: "tvdb-100" });

  const sgGroup = groupRepo.upsertEpisodeGroup({
    animeId: sg.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "watching",
  });

  for (let i = 1; i <= 24; i++) {
    episodeRepo.addEpisode({
      groupId: sgGroup.id,
      episodeNumber: i,
      filePath: `/media/Steins;Gate/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      watched: i <= 12,
    });
  }

  return { sg, sgGroup };
}

function seedCompletedAnime(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
) {
  const aot = animeRepo.upsertAnime({
    title: "Attack on Titan",
  });
  animeRepo.createAnimeSourceMapping({ animeId: aot.id, source: "tvdb", externalId: "tvdb-200" });

  const aotGroup = groupRepo.upsertEpisodeGroup({
    animeId: aot.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "completed",
  });

  for (let i = 1; i <= 25; i++) {
    episodeRepo.addEpisode({
      groupId: aotGroup.id,
      episodeNumber: i,
      filePath: `/media/Attack on Titan/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      watched: true,
    });
  }

  return { aot, aotGroup };
}

function seedPlanToWatchAnime(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
) {
  const drr = animeRepo.upsertAnime({
    title: "Darling in the Franxx",
  });
  animeRepo.createAnimeSourceMapping({ animeId: drr.id, source: "tvdb", externalId: "tvdb-300" });

  const drrGroup = groupRepo.upsertEpisodeGroup({
    animeId: drr.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "plan_to_watch",
  });

  for (let i = 1; i <= 24; i++) {
    episodeRepo.addEpisode({
      groupId: drrGroup.id,
      episodeNumber: i,
      filePath: `/media/Darling in the Franxx/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      watched: false,
    });
  }

  return { drr, drrGroup };
}

function createAnimeQuery(
  animeRepo: AnimeRepository,
  episodeRepo: EpisodeRepository,
  groupRepo: GroupRepository,
) {
  return new AnimeQuery({ anime: animeRepo, episodes: episodeRepo, groups: groupRepo });
}

describe("getDashboardData handler", () => {
  test("returns currently watching anime with progress", async () => {
    await withTempDir("dashboard-watching", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedWatchingAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(1);
      expect(data.currentlyWatching[0]?.title).toBe("Steins;Gate");
      expect(data.currentlyWatching[0]?.groupName).toBe("Season 1");
      expect(data.currentlyWatching[0]?.watchedEpisodes).toBe(12);
      expect(data.currentlyWatching[0]?.totalEpisodes).toBe(24);
      closeEvt();
      close();
    });
  });

  test("returns empty currently watching when none have watching status", async () => {
    await withTempDir("dashboard-no-watching", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedCompletedAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(0);
      closeEvt();
      close();
    });
  });

  test("returns library stats with correct counts", async () => {
    await withTempDir("dashboard-stats", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedWatchingAnime(animeRepo, episodeRepo, groupRepo);
      seedCompletedAnime(animeRepo, episodeRepo, groupRepo);
      seedPlanToWatchAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      expect(data.libraryStats.totalAnime).toBe(3);
      expect(data.libraryStats.totalEpisodes).toBe(73);
      expect(data.libraryStats.onDisk).toBe(3);
      expect(data.libraryStats.partiallyOnDisk).toBe(0);
      expect(data.libraryStats.notOnDisk).toBe(0);
      closeEvt();
      close();
    });
  });

  test("returns continue watching for anime with watched episodes and unwatched files", async () => {
    await withTempDir("dashboard-continue", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedWatchingAnime(animeRepo, episodeRepo, groupRepo);
      seedCompletedAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      const continueItems = data.continueWatching.filter((c) => c.title === "Steins;Gate");
      expect(continueItems).toHaveLength(1);
      expect(continueItems[0]?.watchedEpisodes).toBe(12);
      expect(continueItems[0]?.totalEpisodes).toBe(24);
      closeEvt();
      close();
    });
  });

  test("returns empty continue watching when no partially watched anime", async () => {
    await withTempDir("dashboard-no-continue", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedCompletedAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      expect(data.continueWatching).toHaveLength(0);
      closeEvt();
      close();
    });
  });

  test("returns empty dashboard when library is empty", async () => {
    await withTempDir("dashboard-empty", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(0);
      expect(data.libraryStats.totalAnime).toBe(0);
      expect(data.libraryStats.totalEpisodes).toBe(0);
      expect(data.continueWatching).toHaveLength(0);
      closeEvt();
      close();
    });
  });

  test("getLibraryStats returns correct counts", async () => {
    await withTempDir("dashboard-stats-direct", async (dir) => {
      const { animeRepo, episodeRepo, groupRepo, close } = createLibraryRepositories(dir);
      const { close: closeEvt } = createEventRepository(dir);
      seedWatchingAnime(animeRepo, episodeRepo, groupRepo);
      const handlers = createDashboardHandlers({
        animeQuery: createAnimeQuery(animeRepo, episodeRepo, groupRepo),
      });
      const stats = handlers.getLibraryStats();

      expect(stats.animeCount).toBe(1);
      expect(stats.episodeCount).toBe(24);
      closeEvt();
      close();
    });
  });
});
