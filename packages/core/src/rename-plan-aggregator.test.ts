import { describe, expect, test } from "bun:test";
import {
  aggregateReviewPlan,
  buildReviewPlan,
  detectSwaps,
  groupByAnime,
} from "./rename-plan-aggregator";
import type { RenamePlan } from "./renamer";
import type { ScanResult } from "./scanner";
import { createLibraryDb, makeMatchResult, makeParsedResult, withTempDir } from "./test-fixtures";
import type { AnimeResult, EpisodeResult } from "./types";

function makeScanResult(
  file: string,
  overrides?: {
    anime?: Partial<AnimeResult>;
    episode?: Partial<EpisodeResult>;
    parsedSeason?: number | null;
    parsedEpisode?: number | null;
    status?: ScanResult["status"];
    plan?: RenamePlan | null;
  },
): ScanResult {
  const matchOverrides: { anime?: AnimeResult; episode?: EpisodeResult } = {};
  if (overrides?.anime) {
    matchOverrides["anime"] = {
      id: "1",
      titleEn: "Test Anime",
      entryType: "tv",
      ...overrides.anime,
    };
  }
  if (overrides?.episode) {
    matchOverrides["episode"] = {
      id: "101",
      animeId: "1",
      season: 1,
      episode: 1,
      titleEn: "Ep 1",
      entryType: "tv",
      ...overrides.episode,
    };
  }

  const match = makeMatchResult(matchOverrides as Parameters<typeof makeMatchResult>[0]);

  return {
    file,
    hash: `hash-${file}`,
    parsed: makeParsedResult(
      match.anime.titleEn,
      overrides?.parsedSeason ?? match.episode?.season ?? null,
      overrides?.parsedEpisode ?? match.episode?.episode ?? null,
    ),
    match,
    plan: overrides?.plan ?? null,
    cached: false,
    skipped: false,
    status: overrides?.status ?? "matched",
  };
}

function makeAggScanResult(file: string, overrides?: Partial<ScanResult>): ScanResult {
  return {
    file,
    hash: `hash-${file}`,
    parsed: {
      title: null,
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    },
    match: null,
    plan: null,
    cached: false,
    skipped: false,
    status: "matched",
    ...overrides,
  };
}

describe("groupByAnime", () => {
  test("groups scan results by anime ID", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1" } }),
      makeScanResult("/a/ep2.mkv", { anime: { id: "1" } }),
      makeScanResult("/b/ep1.mkv", { anime: { id: "2" } }),
    ];

    const groups = groupByAnime(results);

    expect(groups.size).toBe(2);
    expect(groups.get("1")).toHaveLength(2);
    expect(groups.get("2")).toHaveLength(1);
  });

  test("returns empty map for empty input", () => {
    const groups = groupByAnime([]);
    expect(groups.size).toBe(0);
  });

  test("skips failed results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1" } }),
      makeScanResult("/a/ep2.mkv", { status: "failed" }),
    ];

    const groups = groupByAnime(results);

    expect(groups.size).toBe(1);
    expect(groups.get("1")).toHaveLength(1);
  });

  test("skips ambiguous results without match", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1" } }),
      {
        file: "/a/ep2.mkv",
        hash: "h",
        parsed: makeParsedResult("Test"),
        match: null,
        plan: null,
        cached: false,
        skipped: false,
        status: "ambiguous" as const,
      },
    ];

    const groups = groupByAnime(results);

    expect(groups.size).toBe(1);
    expect(groups.get("1")).toHaveLength(1);
  });

  test("includes cached results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1" }, status: "cached" }),
      makeScanResult("/a/ep2.mkv", { anime: { id: "1" } }),
    ];

    const groups = groupByAnime(results);

    expect(groups.get("1")).toHaveLength(2);
  });
});

describe("detectSwaps", () => {
  test("detects episode transposition between two files", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1, titleEn: "First" },
        parsedEpisode: 2,
      }),
      makeScanResult("/a/ep2.mkv", {
        anime: { id: "1" },
        episode: { id: "102", season: 1, episode: 2, titleEn: "Second" },
        parsedEpisode: 1,
      }),
    ];

    const swaps = detectSwaps(results);

    expect(swaps).toHaveLength(1);
    expect(swaps[0]?.files[0]).toBe("/a/ep1.mkv");
    expect(swaps[0]?.files[1]).toBe("/a/ep2.mkv");
    expect(swaps[0]?.episodeA).toBe(1);
    expect(swaps[0]?.episodeB).toBe(2);
  });

  test("returns empty array when no swaps detected", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1 },
        parsedEpisode: 1,
      }),
      makeScanResult("/a/ep2.mkv", {
        anime: { id: "1" },
        episode: { id: "102", season: 1, episode: 2 },
        parsedEpisode: 2,
      }),
    ];

    const swaps = detectSwaps(results);
    expect(swaps).toHaveLength(0);
  });

  test("detects cross-season swaps", () => {
    const results = [
      makeScanResult("/a/s1e1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1 },
        parsedSeason: 2,
        parsedEpisode: 1,
      }),
      makeScanResult("/a/s2e1.mkv", {
        anime: { id: "1" },
        episode: { id: "201", season: 2, episode: 1 },
        parsedSeason: 1,
        parsedEpisode: 1,
      }),
    ];

    const swaps = detectSwaps(results);

    expect(swaps).toHaveLength(1);
    expect(swaps[0]?.seasonA).toBe(1);
    expect(swaps[0]?.seasonB).toBe(2);
  });

  test("ignores results without episodes", () => {
    const results = [
      makeScanResult("/a/movie.mkv", {
        anime: { id: "1", entryType: "movie" },
        episode: undefined,
      }),
    ];

    const swaps = detectSwaps(results);
    expect(swaps).toHaveLength(0);
  });

  test("detects multiple swap pairs", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1 },
        parsedEpisode: 3,
      }),
      makeScanResult("/a/ep2.mkv", {
        anime: { id: "1" },
        episode: { id: "102", season: 1, episode: 2 },
        parsedEpisode: 4,
      }),
      makeScanResult("/a/ep3.mkv", {
        anime: { id: "1" },
        episode: { id: "103", season: 1, episode: 3 },
        parsedEpisode: 1,
      }),
      makeScanResult("/a/ep4.mkv", {
        anime: { id: "1" },
        episode: { id: "104", season: 1, episode: 4 },
        parsedEpisode: 2,
      }),
    ];

    const swaps = detectSwaps(results);

    expect(swaps).toHaveLength(2);
  });
});

describe("buildReviewPlan", () => {
  test("produces grouped review plan from scan results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1", titleEn: "Jujutsu Kaisen" },
        episode: { id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" },
      }),
      makeScanResult("/a/ep2.mkv", {
        anime: { id: "1", titleEn: "Jujutsu Kaisen" },
        episode: { id: "102", season: 1, episode: 2, titleEn: "For Myself" },
      }),
      makeScanResult("/b/ep1.mkv", {
        anime: { id: "2", titleEn: "One Piece" },
        episode: { id: "201", season: 1, episode: 1, titleEn: "Romance Dawn" },
      }),
    ];

    const plan = buildReviewPlan(results);

    expect(plan.groups).toHaveLength(2);
    expect(plan.totalFiles).toBe(3);
    expect(plan.totalAnime).toBe(2);
    expect(plan.totalSwaps).toBe(0);
    expect(plan.totalAmbiguous).toBe(0);
  });

  test("counts summary stats correctly", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1, titleEn: "First" },
        parsedEpisode: 2,
      }),
      makeScanResult("/a/ep2.mkv", {
        anime: { id: "1" },
        episode: { id: "102", season: 1, episode: 2, titleEn: "Second" },
        parsedEpisode: 1,
      }),
    ];

    const plan = buildReviewPlan(results);

    expect(plan.totalSwaps).toBe(1);
    expect(plan.groups[0]?.swapPairs).toHaveLength(1);
  });

  test("marks mergeMode when anime exists in library", async () => {
    await withTempDir("merge", async (dir) => {
      const libraryDb = createLibraryDb(dir);
      libraryDb.upsertAnime({
        externalId: "1",
        sourceDb: "tvdb",
        title: "Jujutsu Kaisen",
        entryType: "tv",
        episodeCount: 24,
      });

      const results = [
        makeScanResult("/a/ep25.mkv", {
          anime: { id: "1", titleEn: "Jujutsu Kaisen" },
          episode: { id: "125", season: 2, episode: 1 },
        }),
      ];

      const plan = buildReviewPlan(results, libraryDb);

      expect(plan.groups).toHaveLength(1);
      expect(plan.groups[0]?.mergeMode).toBe(true);
      libraryDb.close();
    });
  });

  test("sets mergeMode to false when anime not in library", async () => {
    await withTempDir("no-merge", async (dir) => {
      const libraryDb = createLibraryDb(dir);

      const results = [
        makeScanResult("/a/ep1.mkv", {
          anime: { id: "999", titleEn: "New Anime" },
          episode: { id: "99901", season: 1, episode: 1 },
        }),
      ];

      const plan = buildReviewPlan(results, libraryDb);

      expect(plan.groups[0]?.mergeMode).toBe(false);
      libraryDb.close();
    });
  });

  test("handles empty results", () => {
    const plan = buildReviewPlan([]);

    expect(plan.groups).toHaveLength(0);
    expect(plan.totalFiles).toBe(0);
    expect(plan.totalAnime).toBe(0);
    expect(plan.totalSwaps).toBe(0);
    expect(plan.totalAmbiguous).toBe(0);
  });

  test("sorts groups alphabetically by anime title", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "2", titleEn: "Zeta Gundam" },
        episode: { id: "201", season: 1, episode: 1 },
      }),
      makeScanResult("/b/ep1.mkv", {
        anime: { id: "1", titleEn: "Akira" },
        episode: { id: "101", season: 1, episode: 1 },
      }),
    ];

    const plan = buildReviewPlan(results);

    expect(plan.groups[0]?.anime.titleEn).toBe("Akira");
    expect(plan.groups[1]?.anime.titleEn).toBe("Zeta Gundam");
  });

  test("sorts entries within group by parsed episode", () => {
    const results = [
      makeScanResult("/a/ep3.mkv", {
        anime: { id: "1" },
        episode: { id: "103", season: 1, episode: 3 },
        parsedEpisode: 3,
      }),
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1" },
        episode: { id: "101", season: 1, episode: 1 },
        parsedEpisode: 1,
      }),
    ];

    const plan = buildReviewPlan(results);

    expect(plan.groups[0]?.entries[0]?.scanResult.file).toBe("/a/ep1.mkv");
    expect(plan.groups[0]?.entries[1]?.scanResult.file).toBe("/a/ep3.mkv");
  });
});

describe("aggregateReviewPlan", () => {
  test("returns empty groups for empty input", () => {
    const plan = aggregateReviewPlan([], "session-1");
    expect(plan.groups).toHaveLength(0);
    expect(plan.totalFiles).toBe(0);
    expect(plan.ambiguousCount).toBe(0);
    expect(plan.sessionId).toBe("session-1");
  });

  test("groups files by anime", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1001",
            animeId: "100",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
      makeAggScanResult("/a/ep2.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1002",
            animeId: "100",
            season: 1,
            episode: 2,
            titleEn: "Ep 2",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
      makeAggScanResult("/b/ep1.mkv", {
        match: {
          anime: { id: "200", titleEn: "One Piece", entryType: "tv" },
          episode: {
            id: "2001",
            animeId: "200",
            season: 1,
            episode: 1,
            titleEn: "Romance Dawn",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]?.animeId).toBe("100");
    expect(plan.groups[0]?.files).toHaveLength(2);
    expect(plan.groups[1]?.animeId).toBe("200");
    expect(plan.groups[1]?.files).toHaveLength(1);
    expect(plan.totalFiles).toBe(3);
  });

  test("detects episode swap pairs", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1001",
            animeId: "100",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
          score: 1,
        },
        plan: {
          sourcePath: "/a/ep1.mkv",
          targetPath: "Jujutsu Kaisen/Season 1/S01E02.mkv",
          targetDir: "Jujutsu Kaisen/Season 1",
          targetFilename: "S01E02.mkv",
          action: "move",
        },
        status: "matched",
      }),
      makeAggScanResult("/a/ep2.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1002",
            animeId: "100",
            season: 1,
            episode: 2,
            titleEn: "Ep 2",
            entryType: "tv",
          },
          score: 1,
        },
        plan: {
          sourcePath: "/a/ep2.mkv",
          targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
          targetDir: "Jujutsu Kaisen/Season 1",
          targetFilename: "S01E01.mkv",
          action: "move",
        },
        status: "matched",
      }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.swapPairs).toHaveLength(1);
    expect(plan.groups[0]?.swapPairs[0]).toEqual({
      fileAId: expect.any(String),
      fileBId: expect.any(String),
    });
  });

  test("counts ambiguous files", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", { status: "ambiguous" }),
      makeAggScanResult("/a/ep2.mkv", { status: "matched" }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.ambiguousCount).toBe(1);
  });

  test("includes failed files in a separate group", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1001",
            animeId: "100",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
      makeAggScanResult("/a/ep2.mkv", {
        status: "failed",
        failureReason: "No title parsed",
      }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(2);
    const failedFile = plan.groups.flatMap((g) => g.files).find((f) => f.status === "failed");
    expect(failedFile).toBeDefined();
    expect(failedFile?.failureReason).toBe("No title parsed");
  });

  test("sets proposed path from plan targetPath", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1001",
            animeId: "100",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
          score: 1,
        },
        plan: {
          sourcePath: "/a/ep1.mkv",
          targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
          targetDir: "Jujutsu Kaisen/Season 1",
          targetFilename: "S01E01.mkv",
          action: "move",
        },
        status: "matched",
      }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.files[0]?.proposedPath).toBe("Jujutsu Kaisen/Season 1/S01E01.mkv");
  });

  test("does not detect swaps for non-swap transpositions", () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1002",
            animeId: "100",
            season: 1,
            episode: 2,
            titleEn: "Ep 2",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
      makeAggScanResult("/a/ep2.mkv", {
        match: {
          anime: { id: "100", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "1003",
            animeId: "100",
            season: 1,
            episode: 3,
            titleEn: "Ep 3",
            entryType: "tv",
          },
          score: 1,
        },
        status: "matched",
      }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.swapPairs).toHaveLength(0);
  });
});
