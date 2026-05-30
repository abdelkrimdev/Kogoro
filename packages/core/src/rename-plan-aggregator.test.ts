import { describe, expect, test } from "bun:test";
import { aggregateReviewPlan } from "./rename-plan-aggregator";
import type { ScanResult } from "./scanner";

function makeScanResult(file: string, overrides?: Partial<ScanResult>): ScanResult {
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
      makeScanResult("/a/ep1.mkv", {
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
      makeScanResult("/a/ep2.mkv", {
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
      makeScanResult("/b/ep1.mkv", {
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
      makeScanResult("/a/ep1.mkv", {
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
      makeScanResult("/a/ep2.mkv", {
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
      makeScanResult("/a/ep1.mkv", { status: "ambiguous" }),
      makeScanResult("/a/ep2.mkv", { status: "matched" }),
    ];

    const plan = aggregateReviewPlan(results, "session-1");

    expect(plan.ambiguousCount).toBe(1);
  });

  test("includes failed files in a separate group", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", {
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
      makeScanResult("/a/ep2.mkv", {
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
      makeScanResult("/a/ep1.mkv", {
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
      makeScanResult("/a/ep1.mkv", {
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
      makeScanResult("/a/ep2.mkv", {
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
