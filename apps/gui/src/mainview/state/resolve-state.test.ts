import { describe, expect, it } from "bun:test";
import type { AnimeGroup, FileRow, ReviewPlan } from "@kogoro/core";
import {
  deriveResolveStats,
  findAmbiguousFiles,
  findFileInPlan,
  isResolveEnabled,
} from "./resolve-state";

const makeFile = (overrides: Partial<FileRow> = {}): FileRow => ({
  fileId: overrides.fileId ?? "f1",
  sourcePath: overrides.sourcePath ?? "/media/Steins;Gate/S01E01.mkv",
  proposedPath: overrides.proposedPath ?? "/library/Steins;Gate/TV/1x01 - Prologue.mkv",
  status: overrides.status ?? "matched",
  animeId: overrides.animeId ?? "a1",
  episodeId: overrides.episodeId ?? "e1",
  episode: overrides.episode ?? 1,
});

const makeGroup = (overrides: Partial<AnimeGroup> = {}): AnimeGroup => ({
  animeId: overrides.animeId ?? "a1",
  animeTitle: overrides.animeTitle ?? "Steins;Gate",
  entryType: overrides.entryType ?? "tv",
  image: overrides.image,
  files: overrides.files ?? [makeFile()],
  swapPairs: overrides.swapPairs ?? [],
});

const makePlan = (groups: AnimeGroup[] = []): ReviewPlan => ({
  sessionId: "s1",
  groups,
  totalFiles: groups.reduce((sum, g) => sum + g.files.length, 0),
  ambiguousCount: groups.reduce(
    (sum, g) => sum + g.files.filter((f) => f.status === "ambiguous").length,
    0,
  ),
});

describe("findAmbiguousFiles", () => {
  it("returns files with ambiguous status from all groups", () => {
    const plan = makePlan([
      makeGroup({
        animeId: "a1",
        animeTitle: "Steins;Gate",
        files: [
          makeFile({ fileId: "f1", status: "matched" }),
          makeFile({ fileId: "f2", status: "ambiguous" }),
        ],
      }),
      makeGroup({
        animeId: "a2",
        animeTitle: "Attack on Titan",
        files: [
          makeFile({ fileId: "f3", status: "ambiguous" }),
          makeFile({ fileId: "f4", status: "failed" }),
        ],
      }),
    ]);

    const result = findAmbiguousFiles(plan);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      fileId: "f2",
      sourcePath: "/media/Steins;Gate/S01E01.mkv",
      animeTitle: "Steins;Gate",
    });
    expect(result[1]).toEqual({
      fileId: "f3",
      sourcePath: "/media/Steins;Gate/S01E01.mkv",
      animeTitle: "Attack on Titan",
    });
  });

  it("returns empty array when no ambiguous files exist", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ fileId: "f1", status: "matched" }),
          makeFile({ fileId: "f2", status: "failed" }),
        ],
      }),
    ]);

    expect(findAmbiguousFiles(plan)).toHaveLength(0);
  });
});

describe("findFileInPlan", () => {
  it("returns file and group for valid fileId", () => {
    const group = makeGroup({
      animeTitle: "Steins;Gate",
      files: [makeFile({ fileId: "f1" }), makeFile({ fileId: "f2", status: "ambiguous" })],
    });
    const plan = makePlan([group]);

    const result = findFileInPlan(plan, "f2");
    expect(result).not.toBeNull();
    expect(result?.file.fileId).toBe("f2");
    expect(result?.file.status).toBe("ambiguous");
    expect(result?.group.animeTitle).toBe("Steins;Gate");
  });

  it("returns null for non-existent fileId", () => {
    const plan = makePlan([makeGroup({ files: [makeFile({ fileId: "f1" })] })]);

    expect(findFileInPlan(plan, "nonexistent")).toBeNull();
  });
});

describe("isResolveEnabled", () => {
  it("returns true for ambiguous files", () => {
    const plan = makePlan([
      makeGroup({ files: [makeFile({ fileId: "f1", status: "ambiguous" })] }),
    ]);

    expect(isResolveEnabled(plan, "f1")).toBe(true);
  });

  it("returns false for matched files", () => {
    const plan = makePlan([makeGroup({ files: [makeFile({ fileId: "f1", status: "matched" })] })]);

    expect(isResolveEnabled(plan, "f1")).toBe(false);
  });

  it("returns false for non-existent fileId", () => {
    const plan = makePlan([makeGroup()]);

    expect(isResolveEnabled(plan, "nonexistent")).toBe(false);
  });
});

describe("deriveResolveStats", () => {
  it("counts ambiguous and resolved files", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ fileId: "f1", status: "matched", animeId: "a1" }),
          makeFile({ fileId: "f2", status: "ambiguous", animeId: null }),
          makeFile({ fileId: "f3", status: "matched", animeId: "a1" }),
          makeFile({ fileId: "f4", status: "failed", animeId: null }),
        ],
      }),
    ]);

    const stats = deriveResolveStats(plan);
    expect(stats.ambiguousCount).toBe(1);
    expect(stats.resolvedCount).toBe(2);
  });

  it("returns zeros for empty plan", () => {
    const plan = makePlan([]);
    const stats = deriveResolveStats(plan);
    expect(stats.ambiguousCount).toBe(0);
    expect(stats.resolvedCount).toBe(0);
  });
});
