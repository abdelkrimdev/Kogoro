import { describe, expect, it } from "bun:test";
import { makeEnrichedFolder } from "../../fixtures";
import {
  deriveBatchProgress,
  deriveFolderStatus,
  deriveScanFolders,
  deriveScanToolbar,
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

describe("deriveBatchProgress", () => {
  it("returns current=1 for first folder in batch", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", basename: "S1", selected: true }),
      makeEnrichedFolder({ path: "/a/S2", basename: "S2", selected: true }),
    ];
    const p = deriveBatchProgress(folders, "/a/S1");
    expect(p.current).toBe(1);
    expect(p.total).toBe(2);
    expect(p.folderBasename).toBe("S1");
  });

  it("returns current=2 for second folder in batch", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", basename: "S1", selected: true }),
      makeEnrichedFolder({ path: "/a/S2", basename: "S2", selected: true }),
    ];
    const p = deriveBatchProgress(folders, "/a/S2");
    expect(p.current).toBe(2);
    expect(p.total).toBe(2);
    expect(p.folderBasename).toBe("S2");
  });

  it("excludes unselected folders from total", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", basename: "S1", selected: true }),
      makeEnrichedFolder({ path: "/a/S2", basename: "S2", selected: false }),
      makeEnrichedFolder({ path: "/a/S3", basename: "S3", selected: false }),
    ];
    const p = deriveBatchProgress(folders, "/a/S1");
    expect(p.current).toBe(1);
    expect(p.total).toBe(1);
  });

  it("excludes missing folders from total", () => {
    const folders = [
      makeEnrichedFolder({ path: "/a/S1", basename: "S1", selected: true }),
      makeEnrichedFolder({
        path: "/a/S2",
        basename: "S2",
        selected: true,
        exists: false,
        status: "missing",
      }),
    ];
    const p = deriveBatchProgress(folders, "/a/S1");
    expect(p.total).toBe(1);
  });
});
