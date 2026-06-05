import { describe, expect, it } from "bun:test";
import { makeEnrichedFolder, makeFile, makeGroup, makePlan } from "../../fixtures";
import {
  deriveFolderStatus,
  deriveScanFolders,
  deriveScanSummaries,
  deriveScanToolbar,
  mergeReviewPlans,
  relativeTimestamp,
  toggleAll,
  toggleFolder,
} from "./scan-state";

describe("deriveFolderStatus", () => {
  it("returns 'new' when folder has never been scanned", () => {
    expect(deriveFolderStatus(undefined, true)).toBe("new");
  });

  it("returns 'indexed' when folder has been scanned", () => {
    expect(deriveFolderStatus("2026-06-01T00:00:00.000Z", true)).toBe("indexed");
  });

  it("returns 'missing' when folder no longer exists on disk", () => {
    expect(deriveFolderStatus("2026-06-01T00:00:00.000Z", false)).toBe("missing");
  });

  it("returns 'missing' regardless of lastScannedAt when exists is false", () => {
    expect(deriveFolderStatus(undefined, false)).toBe("missing");
    expect(deriveFolderStatus("2026-06-01T00:00:00.000Z", false)).toBe("missing");
  });
});

describe("deriveScanFolders", () => {
  const base = "2026-01-01T00:00:00.000Z";
  const scanned = "2026-06-01T00:00:00.000Z";

  it("enriches folders with display name (basename)", () => {
    const result = deriveScanFolders([
      { path: "/media/anime/Naruto", addedAt: base, exists: true },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.basename).toBe("Naruto");
  });

  it("enriches folders with correct status based on existence and lastScannedAt", () => {
    const result = deriveScanFolders([
      { path: "/media/anime/NewShow", addedAt: base, exists: true },
      { path: "/media/anime/IndexedShow", addedAt: base, lastScannedAt: scanned, exists: true },
      { path: "/media/anime/MissingShow", addedAt: base, lastScannedAt: scanned, exists: false },
    ]);
    expect(result).toHaveLength(3);
    const byPath = Object.fromEntries(result.map((r) => [r.path, r]));
    expect(byPath["/media/anime/NewShow"]?.status).toBe("new");
    expect(byPath["/media/anime/IndexedShow"]?.status).toBe("indexed");
    expect(byPath["/media/anime/MissingShow"]?.status).toBe("missing");
  });

  it("includes relative timestamp for indexed folders", () => {
    const result = deriveScanFolders([
      { path: "/media/anime/Show", addedAt: base, lastScannedAt: scanned, exists: true },
    ]);
    expect(result[0]?.relativeTimestamp).toBeString();
    expect(result[0]?.relativeTimestamp?.length).toBeGreaterThan(0);
  });

  it("does not include relative timestamp for new folders", () => {
    const result = deriveScanFolders([{ path: "/media/anime/New", addedAt: base, exists: true }]);
    expect(result[0]?.relativeTimestamp).toBeUndefined();
  });

  it("returns empty array for empty input", () => {
    expect(deriveScanFolders([])).toEqual([]);
  });

  it("handles path without a basename (root-like)", () => {
    const result = deriveScanFolders([{ path: "/", addedAt: base, exists: true }]);
    expect(result[0]?.basename).toBe("/");
  });

  it("preserves original path and timestamps", () => {
    const result = deriveScanFolders([
      { path: "/media/anime/Show", addedAt: base, lastScannedAt: scanned, exists: true },
    ]);
    expect(result[0]?.path).toBe("/media/anime/Show");
    expect(result[0]?.addedAt).toBe(base);
    expect(result[0]?.lastScannedAt).toBe(scanned);
  });

  it("defaults selected to false for all folders", () => {
    const result = deriveScanFolders([
      { path: "/media/anime/Naruto", addedAt: base, exists: true },
      { path: "/media/anime/Bleach", addedAt: base, exists: false },
    ]);
    expect(result[0]?.selected).toBe(false);
    expect(result[1]?.selected).toBe(false);
  });
});

describe("relativeTimestamp", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(relativeTimestamp(now)).toBe("just now");
  });

  it("returns seconds ago format", () => {
    const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(relativeTimestamp(thirtySecAgo)).toBe("30s ago");
  });

  it("returns minutes ago format", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(relativeTimestamp(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago format", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(relativeTimestamp(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days ago format", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativeTimestamp(threeDaysAgo)).toBe("3d ago");
  });
});

describe("toggleFolder", () => {
  it("toggles selected from false to true for an existing folder", () => {
    const folders = [makeEnrichedFolder({ path: "/anime/Naruto" })];
    const result = toggleFolder(folders, "/anime/Naruto");
    expect(result[0]?.selected).toBe(true);
  });

  it("toggles selected from true to false for an existing folder", () => {
    const folders = [makeEnrichedFolder({ path: "/anime/Naruto", selected: true })];
    const result = toggleFolder(folders, "/anime/Naruto");
    expect(result[0]?.selected).toBe(false);
  });

  it("does not toggle selected for a missing folder", () => {
    const folders = [makeEnrichedFolder({ path: "/anime/Deleted", exists: false })];
    const result = toggleFolder(folders, "/anime/Deleted");
    expect(result[0]?.selected).toBe(false);
  });

  it("returns unchanged array when path does not match any folder", () => {
    const folders = [makeEnrichedFolder({ path: "/anime/Naruto" })];
    const result = toggleFolder(folders, "/anime/Bleach");
    expect(result).toEqual(folders);
  });

  it("returns a new array and does not mutate the original", () => {
    const folders = [makeEnrichedFolder({ path: "/anime/Naruto", selected: true })];
    const result = toggleFolder(folders, "/anime/Naruto");
    expect(result).not.toBe(folders);
    expect(result[0]).not.toBe(folders[0]);
    expect(folders[0]?.selected).toBe(true);
  });

  it("toggles only the matching folder when multiple folders exist", () => {
    const folders = [
      makeEnrichedFolder({ path: "/anime/Naruto", selected: true }),
      makeEnrichedFolder({ path: "/anime/Bleach", selected: false }),
      makeEnrichedFolder({ path: "/anime/OnePiece", selected: false, exists: false }),
    ];
    const result = toggleFolder(folders, "/anime/Bleach");
    expect(result[0]?.selected).toBe(true);
    expect(result[1]?.selected).toBe(true);
    expect(result[2]?.selected).toBe(false);
  });
});

describe("toggleAll", () => {
  it("selects all non-missing folders when none are selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/Show1", selected: false }),
      makeEnrichedFolder({ path: "/a/Show2", selected: false }),
    ];
    const result = toggleAll(folders);
    expect(result[0]?.selected).toBe(true);
    expect(result[1]?.selected).toBe(true);
  });

  it("selects all non-missing folders when some are selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/Show1", selected: true }),
      makeEnrichedFolder({ path: "/a/Show2", selected: false }),
    ];
    const result = toggleAll(folders);
    expect(result[0]?.selected).toBe(true);
    expect(result[1]?.selected).toBe(true);
  });

  it("deselects all non-missing folders when all are already selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/Show1", selected: true }),
      makeEnrichedFolder({ path: "/a/Show2", selected: true }),
    ];
    const result = toggleAll(folders);
    expect(result[0]?.selected).toBe(false);
    expect(result[1]?.selected).toBe(false);
  });

  it("never toggles missing folders", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/Show1", selected: false }),
      makeEnrichedFolder({ path: "/a/Show2", exists: false, status: "missing" }),
    ];
    const result = toggleAll(folders);
    expect(result[0]?.selected).toBe(true);
    expect(result[1]?.selected).toBe(false);
  });

  it("returns a new array and does not mutate the original", () => {
    const folders = [makeEnrichedFolder({ path: "/a/Show1", selected: false })];
    const result = toggleAll(folders);
    expect(result).not.toBe(folders);
    expect(folders[0]?.selected).toBe(false);
  });

  it("handles empty array", () => {
    expect(toggleAll([])).toEqual([]);
  });

  it("handles all-missing folders", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/Show1", exists: false, status: "missing", selected: false }),
      makeEnrichedFolder({ path: "/a/Show2", exists: false, status: "missing", selected: false }),
    ];
    const result = toggleAll(folders);
    expect(result[0]?.selected).toBe(false);
    expect(result[1]?.selected).toBe(false);
  });
});

describe("deriveScanToolbar", () => {
  it("returns allSelected:true when all non-missing folders are selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", selected: true }),
      makeEnrichedFolder({ path: "/a/S2", selected: true }),
    ];
    const result = deriveScanToolbar(folders);
    expect(result.allSelected).toBe(true);
    expect(result.someSelected).toBe(false);
    expect(result.noneSelected).toBe(false);
    expect(result.selectableCount).toBe(2);
  });

  it("returns someSelected:true when some but not all non-missing are selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", selected: true }),
      makeEnrichedFolder({ path: "/a/S2", selected: false }),
    ];
    const result = deriveScanToolbar(folders);
    expect(result.allSelected).toBe(false);
    expect(result.someSelected).toBe(true);
    expect(result.noneSelected).toBe(false);
    expect(result.selectableCount).toBe(2);
  });

  it("returns noneSelected:true when no folders are selected", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", selected: false }),
      makeEnrichedFolder({ path: "/a/S2", selected: false }),
    ];
    const result = deriveScanToolbar(folders);
    expect(result.allSelected).toBe(false);
    expect(result.someSelected).toBe(false);
    expect(result.noneSelected).toBe(true);
    expect(result.selectableCount).toBe(2);
  });

  it("excludes missing folders from selectableCount", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", selected: false }),
      makeEnrichedFolder({ path: "/a/S2", exists: false, status: "missing" }),
    ];
    const result = deriveScanToolbar(folders);
    expect(result.selectableCount).toBe(1);
  });

  it("returns allSelected:false and selectableCount:0 when all folders are missing", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", exists: false, status: "missing" }),
      makeEnrichedFolder({ path: "/a/S2", exists: false, status: "missing" }),
    ];
    const result = deriveScanToolbar(folders);
    expect(result.allSelected).toBe(false);
    expect(result.someSelected).toBe(false);
    expect(result.noneSelected).toBe(false);
    expect(result.selectableCount).toBe(0);
  });

  it("handles empty array", () => {
    const result = deriveScanToolbar([]);
    expect(result.allSelected).toBe(false);
    expect(result.someSelected).toBe(false);
    expect(result.noneSelected).toBe(false);
    expect(result.selectableCount).toBe(0);
  });
});

describe("mergeReviewPlans", () => {
  it("merges groups by animeId and concatenates files", () => {
    const plan1 = makePlan([
      makeGroup({
        animeId: "a1",
        animeTitle: "Show A",
        files: [makeFile({ fileId: "f1", animeId: "a1" })],
      }),
    ]);
    const plan2 = makePlan([
      makeGroup({
        animeId: "a1",
        animeTitle: "Show A",
        files: [makeFile({ fileId: "f2", animeId: "a1" })],
      }),
    ]);
    const merged = mergeReviewPlans([plan1, plan2]);
    expect(merged.groups).toHaveLength(1);
    expect(merged.groups[0]?.files).toHaveLength(2);
    expect(merged.groups[0]?.animeId).toBe("a1");
  });

  it("keeps distinct animeIds in separate groups", () => {
    const plan1 = makePlan([
      makeGroup({
        animeId: "a1",
        animeTitle: "Show A",
        files: [makeFile({ fileId: "f1", animeId: "a1" })],
      }),
    ]);
    const plan2 = makePlan([
      makeGroup({
        animeId: "a2",
        animeTitle: "Show B",
        files: [makeFile({ fileId: "f2", animeId: "a2" })],
      }),
    ]);
    const merged = mergeReviewPlans([plan1, plan2]);
    expect(merged.groups).toHaveLength(2);
  });

  it("computes totalFiles across all merged groups", () => {
    const plan1 = makePlan([
      makeGroup({
        animeId: "a1",
        files: [
          makeFile({ fileId: "f1", animeId: "a1" }),
          makeFile({ fileId: "f2", animeId: "a1" }),
        ],
      }),
    ]);
    const plan2 = makePlan([
      makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f3", animeId: "a2" })] }),
    ]);
    const merged = mergeReviewPlans([plan1, plan2]);
    expect(merged.totalFiles).toBe(3);
  });

  it("computes ambiguousCount from merged files", () => {
    const plan1 = makePlan([
      makeGroup({
        animeId: "a1",
        files: [makeFile({ fileId: "f1", animeId: "a1", status: "ambiguous" })],
      }),
    ]);
    const plan2 = makePlan([
      makeGroup({
        animeId: "a1",
        files: [makeFile({ fileId: "f2", animeId: "a1", status: "matched" })],
      }),
    ]);
    const merged = mergeReviewPlans([plan1, plan2]);
    expect(merged.ambiguousCount).toBe(1);
  });

  it("returns empty plan when given no plans", () => {
    const merged = mergeReviewPlans([]);
    expect(merged.groups).toEqual([]);
    expect(merged.totalFiles).toBe(0);
    expect(merged.ambiguousCount).toBe(0);
    expect(merged.sessionId).toBe("merged");
  });

  it("uses sessionId from the last plan", () => {
    const plan1 = makePlan([
      makeGroup({ animeId: "a1", files: [makeFile({ fileId: "f1", animeId: "a1" })] }),
    ]);
    plan1.sessionId = "first";
    const plan2 = makePlan([
      makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f2", animeId: "a2" })] }),
    ]);
    plan2.sessionId = "last";
    const merged = mergeReviewPlans([plan1, plan2]);
    expect(merged.sessionId).toBe("last");
  });

  it("does not mutate original plans or groups", () => {
    const group = makeGroup({
      animeId: "a1",
      files: [makeFile({ fileId: "f1", animeId: "a1" })],
    });
    const plan = makePlan([group]);
    mergeReviewPlans([plan]);
    expect(group.files).toHaveLength(1);
  });
});

describe("deriveScanSummaries", () => {
  it("returns summary entry for each folder that has a plan", () => {
    const folders = [
      makeEnrichedFolder({ path: "/media/A", basename: "A" }),
      makeEnrichedFolder({ path: "/media/B", basename: "B" }),
    ];
    const plans = new Map<string, ReturnType<typeof makePlan>>();
    plans.set(
      "/media/A",
      makePlan([makeGroup({ animeId: "a1", files: [makeFile({ fileId: "f1", animeId: "a1" })] })]),
    );
    plans.set(
      "/media/B",
      makePlan([makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f2", animeId: "a2" })] })]),
    );
    const summaries = deriveScanSummaries(plans, folders);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]?.basename).toBe("A");
    expect(summaries[0]?.fileCount).toBe(1);
    expect(summaries[1]?.basename).toBe("B");
    expect(summaries[1]?.fileCount).toBe(1);
  });

  it("excludes folders without plans", () => {
    const folders = [
      makeEnrichedFolder({ path: "/media/A", basename: "A" }),
      makeEnrichedFolder({ path: "/media/B", basename: "B" }),
    ];
    const plans = new Map<string, ReturnType<typeof makePlan>>();
    plans.set(
      "/media/A",
      makePlan([makeGroup({ animeId: "a1", files: [makeFile({ fileId: "f1", animeId: "a1" })] })]),
    );
    const summaries = deriveScanSummaries(plans, folders);
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.basename).toBe("A");
  });

  it("counts matched and cached files as matchCount", () => {
    const folders = [makeEnrichedFolder({ path: "/media/A", basename: "A" })];
    const plans = new Map<string, ReturnType<typeof makePlan>>();
    plans.set(
      "/media/A",
      makePlan([
        makeGroup({
          animeId: "a1",
          files: [
            makeFile({ fileId: "f1", animeId: "a1", status: "matched" }),
            makeFile({ fileId: "f2", animeId: "a1", status: "cached" }),
            makeFile({ fileId: "f3", animeId: "a1", status: "ambiguous" }),
          ],
        }),
      ]),
    );
    const summaries = deriveScanSummaries(plans, folders);
    expect(summaries[0]?.matchCount).toBe(2);
    expect(summaries[0]?.ambiguousCount).toBe(1);
    expect(summaries[0]?.failedCount).toBe(0);
  });

  it("counts failed files", () => {
    const folders = [makeEnrichedFolder({ path: "/media/A", basename: "A" })];
    const plans = new Map<string, ReturnType<typeof makePlan>>();
    plans.set(
      "/media/A",
      makePlan([
        makeGroup({
          animeId: "a1",
          files: [
            makeFile({ fileId: "f1", animeId: "a1", status: "failed" }),
            makeFile({ fileId: "f2", animeId: "a1", status: "matched" }),
          ],
        }),
      ]),
    );
    const summaries = deriveScanSummaries(plans, folders);
    expect(summaries[0]?.matchCount).toBe(1);
    expect(summaries[0]?.failedCount).toBe(1);
  });
});
