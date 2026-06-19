import { describe, expect, test } from "bun:test";
import type { LibraryRepository } from "@kogoro/core";
import { LibraryService } from "@kogoro/core";
import { createLibraryRepository, withTempDir } from "@kogoro/core/testing";
import { createDashboardHandlers } from "./dashboard";

function seedWatchingAnime(repo: LibraryRepository) {
  const sg = repo.upsertAnime({
    externalId: "tvdb-100",
    sourceDb: "tvdb",
    title: "Steins;Gate",
    episodeCount: 24,
  });

  const sgGroup = repo.upsertEpisodeGroup({
    animeId: sg.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "watching",
  });

  for (let i = 1; i <= 24; i++) {
    repo.addEpisode({
      animeId: sg.id,
      groupId: sgGroup.id,
      episodeNumber: i,
      filePath: `/media/Steins;Gate/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      season: 1,
      watched: i <= 12,
    });
  }

  return { sg, sgGroup };
}

function seedCompletedAnime(repo: LibraryRepository) {
  const aot = repo.upsertAnime({
    externalId: "tvdb-200",
    sourceDb: "tvdb",
    title: "Attack on Titan",
    episodeCount: 25,
  });

  const aotGroup = repo.upsertEpisodeGroup({
    animeId: aot.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "completed",
  });

  for (let i = 1; i <= 25; i++) {
    repo.addEpisode({
      animeId: aot.id,
      groupId: aotGroup.id,
      episodeNumber: i,
      filePath: `/media/Attack on Titan/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      season: 1,
      watched: true,
    });
  }

  return { aot, aotGroup };
}

function seedPlanToWatchAnime(repo: LibraryRepository) {
  const drr = repo.upsertAnime({
    externalId: "tvdb-300",
    sourceDb: "tvdb",
    title: "Darling in the Franxx",
    episodeCount: 24,
  });

  const drrGroup = repo.upsertEpisodeGroup({
    animeId: drr.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "plan_to_watch",
  });

  for (let i = 1; i <= 24; i++) {
    repo.addEpisode({
      animeId: drr.id,
      groupId: drrGroup.id,
      episodeNumber: i,
      filePath: `/media/Darling in the Franxx/S01E${String(i).padStart(2, "0")}.mkv`,
      title: `Episode ${i}`,
      season: 1,
      watched: false,
    });
  }

  return { drr, drrGroup };
}

describe("getDashboardData handler", () => {
  test("returns currently watching anime with progress", async () => {
    await withTempDir("dashboard-watching", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedWatchingAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(1);
      expect(data.currentlyWatching[0]?.title).toBe("Steins;Gate");
      expect(data.currentlyWatching[0]?.groupName).toBe("Season 1");
      expect(data.currentlyWatching[0]?.watchedEpisodes).toBe(12);
      expect(data.currentlyWatching[0]?.totalEpisodes).toBe(24);
      close();
    });
  });

  test("returns empty currently watching when none have watching status", async () => {
    await withTempDir("dashboard-no-watching", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedCompletedAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(0);
      close();
    });
  });

  test("returns library stats with correct counts", async () => {
    await withTempDir("dashboard-stats", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedWatchingAnime(repo);
      seedCompletedAnime(repo);
      seedPlanToWatchAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      expect(data.libraryStats.totalAnime).toBe(3);
      expect(data.libraryStats.totalEpisodes).toBe(73);
      expect(data.libraryStats.onDisk).toBe(0);
      expect(data.libraryStats.partiallyOnDisk).toBe(0);
      expect(data.libraryStats.notOnDisk).toBe(3);
      close();
    });
  });

  test("returns continue watching for anime with watched episodes and unwatched files", async () => {
    await withTempDir("dashboard-continue", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedWatchingAnime(repo);
      seedCompletedAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      const continueItems = data.continueWatching.filter((c) => c.title === "Steins;Gate");
      expect(continueItems).toHaveLength(1);
      expect(continueItems[0]?.watchedEpisodes).toBe(12);
      expect(continueItems[0]?.totalEpisodes).toBe(24);
      close();
    });
  });

  test("returns empty continue watching when no partially watched anime", async () => {
    await withTempDir("dashboard-no-continue", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedCompletedAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      expect(data.continueWatching).toHaveLength(0);
      close();
    });
  });

  test("returns empty dashboard when library is empty", async () => {
    await withTempDir("dashboard-empty", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const data = await handlers.getDashboardData();

      expect(data.currentlyWatching).toHaveLength(0);
      expect(data.libraryStats.totalAnime).toBe(0);
      expect(data.libraryStats.totalEpisodes).toBe(0);
      expect(data.continueWatching).toHaveLength(0);
      close();
    });
  });

  test("getLibraryStats returns correct counts", async () => {
    await withTempDir("dashboard-stats-direct", async (dir) => {
      const { repo, close } = createLibraryRepository(dir);
      seedWatchingAnime(repo);
      const handlers = createDashboardHandlers({ libraryService: new LibraryService(repo) });
      const stats = handlers.getLibraryStats();

      expect(stats.animeCount).toBe(1);
      expect(stats.episodeCount).toBe(24);
      close();
    });
  });
});
