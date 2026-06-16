import { describe, expect, test } from "bun:test";
import {
  createLibraryRepository,
  makeMatchResult,
  makeParsedResult,
  withTempDir,
} from "../fixtures";
import { LibraryService } from "../library/library-service";
import type { RenamePlan } from "../rename/renamer";
import type { AnimeResult, EpisodeResult, ReviewPlan } from "../types";
import {
  aggregateReviewPlan,
  buildCanonicalIdMap,
  buildReviewPlan,
  detectSwaps,
  groupByAnime,
} from "./rename-plan-aggregator";
import type { ScanResult } from "./scanner";

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
  test("groups scan results by anime title", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1", titleEn: "Jujutsu Kaisen" } }),
      makeScanResult("/a/ep2.mkv", { anime: { id: "1", titleEn: "Jujutsu Kaisen" } }),
      makeScanResult("/b/ep1.mkv", { anime: { id: "2", titleEn: "One Piece" } }),
    ];

    const groups = groupByAnime(results);

    expect(groups.size).toBe(2);
    expect(groups.get("Jujutsu Kaisen")).toHaveLength(2);
    expect(groups.get("One Piece")).toHaveLength(1);
  });

  test("returns empty map for empty input", () => {
    const groups = groupByAnime([]);
    expect(groups.size).toBe(0);
  });

  test("skips failed results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1", titleEn: "Jujutsu Kaisen" } }),
      makeScanResult("/a/ep2.mkv", { status: "failed" }),
    ];

    const groups = groupByAnime(results);

    expect(groups.size).toBe(1);
    expect(groups.get("Jujutsu Kaisen")).toHaveLength(1);
  });

  test("skips ambiguous results without match", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { anime: { id: "1", titleEn: "Jujutsu Kaisen" } }),
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
    expect(groups.get("Jujutsu Kaisen")).toHaveLength(1);
  });

  test("includes cached results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
        anime: { id: "1", titleEn: "Jujutsu Kaisen" },
        status: "cached",
      }),
      makeScanResult("/a/ep2.mkv", { anime: { id: "1", titleEn: "Jujutsu Kaisen" } }),
    ];

    const groups = groupByAnime(results);

    expect(groups.get("Jujutsu Kaisen")).toHaveLength(2);
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
    await withTempDir("merge", async (_dir) => {
      const { repo: libraryRepo, close } = createLibraryRepository();
      const libraryService = new LibraryService(libraryRepo);
      libraryRepo.upsertAnime({
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

      const plan = buildReviewPlan(results, libraryService);

      expect(plan.groups).toHaveLength(1);
      expect(plan.groups[0]?.mergeMode).toBe(true);
      close();
    });
  });

  test("sets mergeMode to false when anime not in library", async () => {
    await withTempDir("no-merge", async (dir) => {
      const { repo: libraryRepo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(libraryRepo);

      const results = [
        makeScanResult("/a/ep1.mkv", {
          anime: { id: "999", titleEn: "New Anime" },
          episode: { id: "99901", season: 1, episode: 1 },
        }),
      ];

      const plan = buildReviewPlan(results, libraryService);

      expect(plan.groups[0]?.mergeMode).toBe(false);
      close();
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

  test("groups by title instead of animeId for same-titled results", () => {
    const results = [
      makeScanResult("/a/s2e1.mkv", {
        anime: { id: "222", titleEn: "Oshi no Ko" },
        episode: { id: "201", animeId: "222", season: 2, episode: 1, titleEn: "Tokyo Blade" },
        parsedSeason: 2,
        parsedEpisode: 1,
      }),
      makeScanResult("/a/s1e1.mkv", {
        anime: { id: "111", titleEn: "Oshi no Ko" },
        episode: {
          id: "101",
          animeId: "111",
          season: 1,
          episode: 1,
          titleEn: "Mother and Children",
        },
        parsedSeason: 1,
        parsedEpisode: 1,
      }),
    ];

    const plan = buildReviewPlan(results);

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.animeId).toBe("111");
    expect(plan.groups[0]?.anime.titleEn).toBe("Oshi no Ko");
    expect(plan.groups[0]?.entries).toHaveLength(2);
  });
});

describe("aggregateReviewPlan", () => {
  test("returns empty groups for empty input", async () => {
    const plan = await aggregateReviewPlan([], "session-1");
    expect(plan.groups).toHaveLength(0);
    expect(plan.totalFiles).toBe(0);
    expect(plan.ambiguousCount).toBe(0);
    expect(plan.sessionId).toBe("session-1");
  });

  test("groups files by anime", async () => {
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

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(2);
    expect(plan.groups[0]?.animeId).toBe("100");
    expect(plan.groups[0]?.files).toHaveLength(2);
    expect(plan.groups[1]?.animeId).toBe("200");
    expect(plan.groups[1]?.files).toHaveLength(1);
    expect(plan.totalFiles).toBe(3);
  });

  test("detects episode swap pairs", async () => {
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

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]?.swapPairs).toHaveLength(1);
    expect(plan.groups[0]?.swapPairs[0]).toEqual({
      fileAId: expect.any(String),
      fileBId: expect.any(String),
    });
  });

  test("counts ambiguous files", async () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", { status: "ambiguous" }),
      makeAggScanResult("/a/ep2.mkv", { status: "matched" }),
    ];

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.ambiguousCount).toBe(1);
  });

  test("includes failed files in a separate group", async () => {
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

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups).toHaveLength(2);
    const failedFile = plan.groups.flatMap((g) => g.files).find((f) => f.status === "failed");
    expect(failedFile).toBeDefined();
    expect(failedFile?.failureReason).toBe("No title parsed");
  });

  test("sets proposed path from plan targetPath", async () => {
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

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.files[0]?.proposedPath).toBe("Jujutsu Kaisen/Season 1/S01E01.mkv");
  });

  test("does not detect swaps for non-swap transpositions", async () => {
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

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.swapPairs).toHaveLength(0);
  });

  test("sets mergeMode to true when library has matching anime", async () => {
    await withTempDir("merge", async (dir) => {
      const { repo: libraryRepo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(libraryRepo);
      libraryRepo.upsertAnime({
        externalId: "100",
        sourceDb: "tvdb",
        title: "Jujutsu Kaisen",
        entryType: "tv",
        episodeCount: 24,
      });

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
      ];

      const plan = await aggregateReviewPlan(results, "session-1", libraryService, "tvdb");

      expect(plan.groups).toHaveLength(1);
      expect(plan.groups[0]?.mergeMode).toBe(true);
      close();
    });
  });

  test("sets mergeMode to false when anime not in library", async () => {
    await withTempDir("no-merge", async (dir) => {
      const { repo: libraryRepo, close } = createLibraryRepository(dir);
      const libraryService = new LibraryService(libraryRepo);

      const results = [
        makeAggScanResult("/a/ep1.mkv", {
          match: {
            anime: { id: "999", titleEn: "New Anime", entryType: "tv" },
            episode: {
              id: "99901",
              animeId: "999",
              season: 1,
              episode: 1,
              titleEn: "Ep 1",
              entryType: "tv",
            },
            score: 1,
          },
          status: "matched",
        }),
      ];

      const plan = await aggregateReviewPlan(results, "session-1", libraryService, "tvdb");

      expect(plan.groups[0]?.mergeMode).toBe(false);
      close();
    });
  });

  test("sets mergeMode to false for groups without a match", async () => {
    const results = [
      makeAggScanResult("/a/ep1.mkv", {
        match: null,
        status: "failed",
      }),
    ];

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.mergeMode).toBe(false);
  });

  test("does not set mergeMode when no library service is provided", async () => {
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
    ];

    const plan = await aggregateReviewPlan(results, "session-1");

    expect(plan.groups[0]?.mergeMode).toBe(false);
  });

  test("fills topCandidates for ambiguous files when callback is provided", async () => {
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
        status: "ambiguous",
      }),
    ];

    const plan = await aggregateReviewPlan(results, "session-1", undefined, undefined, async () => [
      { episodeNumber: 4, title: "Blind" },
    ]);

    expect(plan.groups[0]?.files[0]?.topCandidates).toEqual([{ episodeNumber: 4, title: "Blind" }]);
  });
});

describe("buildCanonicalIdMap", () => {
  test("maps file animeIds that differ from group animeId", () => {
    const plan: ReviewPlan = {
      sessionId: "s1",
      totalFiles: 2,
      ambiguousCount: 0,
      groups: [
        {
          animeId: "100",
          animeTitle: "Anime A",
          entryType: "tv",
          files: [
            {
              fileId: "f1",
              sourcePath: "/a/ep1.mkv",
              proposedPath: null,
              status: "matched",
              animeId: "100",
              episodeId: null,
              episode: null,
              episodeName: null,
            },
            {
              fileId: "f2",
              sourcePath: "/a/ep2.mkv",
              proposedPath: null,
              status: "matched",
              animeId: "200",
              episodeId: null,
              episode: null,
              episodeName: null,
            },
          ],
          swapPairs: [],
        },
      ],
    };

    const map = buildCanonicalIdMap(plan);
    expect(map.get("200")).toBe("100");
    expect(map.has("100")).toBe(false);
  });

  test("returns empty map when all file animeIds match group", () => {
    const plan: ReviewPlan = {
      sessionId: "s1",
      totalFiles: 1,
      ambiguousCount: 0,
      groups: [
        {
          animeId: "100",
          animeTitle: "Anime A",
          entryType: "tv",
          files: [
            {
              fileId: "f1",
              sourcePath: "/a/ep1.mkv",
              proposedPath: null,
              status: "matched",
              animeId: "100",
              episodeId: null,
              episode: null,
              episodeName: null,
            },
          ],
          swapPairs: [],
        },
      ],
    };

    const map = buildCanonicalIdMap(plan);
    expect(map.size).toBe(0);
  });

  test("returns empty map for empty groups", () => {
    const plan: ReviewPlan = {
      sessionId: "s1",
      totalFiles: 0,
      ambiguousCount: 0,
      groups: [],
    };

    const map = buildCanonicalIdMap(plan);
    expect(map.size).toBe(0);
  });

  test("handles multiple groups with different canonical IDs", () => {
    const plan: ReviewPlan = {
      sessionId: "s1",
      totalFiles: 4,
      ambiguousCount: 0,
      groups: [
        {
          animeId: "100",
          animeTitle: "Anime A",
          entryType: "tv",
          files: [
            {
              fileId: "f1",
              sourcePath: "/a/ep1.mkv",
              proposedPath: null,
              status: "matched",
              animeId: "300",
              episodeId: null,
              episode: null,
              episodeName: null,
            },
          ],
          swapPairs: [],
        },
        {
          animeId: "200",
          animeTitle: "Anime B",
          entryType: "tv",
          files: [
            {
              fileId: "f2",
              sourcePath: "/b/ep1.mkv",
              proposedPath: null,
              status: "matched",
              animeId: "400",
              episodeId: null,
              episode: null,
              episodeName: null,
            },
          ],
          swapPairs: [],
        },
      ],
    };

    const map = buildCanonicalIdMap(plan);
    expect(map.get("300")).toBe("100");
    expect(map.get("400")).toBe("200");
  });

  test("skips files with null animeId", () => {
    const plan: ReviewPlan = {
      sessionId: "s1",
      totalFiles: 1,
      ambiguousCount: 0,
      groups: [
        {
          animeId: "100",
          animeTitle: "Anime A",
          entryType: "tv",
          files: [
            {
              fileId: "f1",
              sourcePath: "/a/ep1.mkv",
              proposedPath: null,
              status: "matched",
              animeId: null,
              episodeId: null,
              episode: null,
              episodeName: null,
            },
          ],
          swapPairs: [],
        },
      ],
    };

    const map = buildCanonicalIdMap(plan);
    expect(map.size).toBe(0);
  });
});
