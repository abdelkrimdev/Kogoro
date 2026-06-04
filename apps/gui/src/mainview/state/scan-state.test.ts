import { describe, expect, it } from "bun:test";
import { deriveFolderStatus, deriveScanFolders, relativeTimestamp } from "./scan-state";

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
