import { describe, expect, it } from "bun:test";
import type { AnimeGroup, FileRow, ReviewPlan } from "@kogoro/core";
import {
  deriveReviewStats,
  filterReviewGroups,
  findSwapPairForFile,
  type ReviewState,
} from "./review-state";

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

const makeState = (overrides: Partial<ReviewState> = {}): ReviewState => ({
  plan: overrides.plan ?? makePlan(),
  searchQuery: overrides.searchQuery ?? "",
  statusFilter: overrides.statusFilter ?? "all",
});

describe("filterReviewGroups", () => {
  describe("search filtering", () => {
    it("returns all groups when search is empty", () => {
      const plan = makePlan([
        makeGroup({ animeId: "a1", animeTitle: "Steins;Gate" }),
        makeGroup({ animeId: "a2", animeTitle: "Attack on Titan" }),
      ]);
      const state = makeState({ plan, searchQuery: "" });
      expect(filterReviewGroups(state)).toHaveLength(2);
    });

    it("filters groups by anime title", () => {
      const plan = makePlan([
        makeGroup({
          animeId: "a1",
          animeTitle: "Steins;Gate",
          files: [
            makeFile({
              sourcePath: "/media/Steins;Gate/S01E01.mkv",
              proposedPath: "/library/Steins;Gate/TV/1x01.mkv",
            }),
          ],
        }),
        makeGroup({
          animeId: "a2",
          animeTitle: "Attack on Titan",
          files: [
            makeFile({
              fileId: "f2",
              sourcePath: "/media/Attack on Titan/S01E01.mkv",
              proposedPath: "/library/Attack on Titan/TV/1x01.mkv",
            }),
          ],
        }),
        makeGroup({
          animeId: "a3",
          animeTitle: "Steins;Gate 0",
          files: [
            makeFile({
              fileId: "f3",
              sourcePath: "/media/Steins;Gate 0/S01E01.mkv",
              proposedPath: "/library/Steins;Gate 0/TV/1x01.mkv",
            }),
          ],
        }),
      ]);
      const state = makeState({ plan, searchQuery: "steins" });
      const result = filterReviewGroups(state);
      expect(result).toHaveLength(2);
      expect(result.map((g) => g.animeId)).toEqual(["a1", "a3"]);
    });

    it("filters files within groups by source path", () => {
      const plan = makePlan([
        makeGroup({
          animeId: "a1",
          animeTitle: "Steins;Gate",
          files: [
            makeFile({ fileId: "f1", sourcePath: "/media/Steins;Gate/S01E01.mkv" }),
            makeFile({ fileId: "f2", sourcePath: "/media/Steins;Gate/S01E02.mkv" }),
          ],
        }),
      ]);
      const state = makeState({ plan, searchQuery: "E01" });
      const result = filterReviewGroups(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.files).toHaveLength(1);
      expect(result[0]?.files[0]?.fileId).toBe("f1");
    });

    it("filters files by proposed path", () => {
      const plan = makePlan([
        makeGroup({
          animeId: "a1",
          files: [
            makeFile({ fileId: "f1", proposedPath: "/library/Steins;Gate/TV/1x01 - Prologue.mkv" }),
            makeFile({ fileId: "f2", proposedPath: "/library/Steins;Gate/TV/1x02 - Parallax.mkv" }),
          ],
        }),
      ]);
      const state = makeState({ plan, searchQuery: "parallax" });
      const result = filterReviewGroups(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.files[0]?.fileId).toBe("f2");
    });
  });

  describe("status filtering", () => {
    it("returns all files when statusFilter is all", () => {
      const plan = makePlan([
        makeGroup({
          files: [
            makeFile({ status: "matched" }),
            makeFile({ fileId: "f2", status: "ambiguous" }),
            makeFile({ fileId: "f3", status: "failed" }),
          ],
        }),
      ]);
      const state = makeState({ plan, statusFilter: "all" });
      const result = filterReviewGroups(state);
      expect(result[0]?.files).toHaveLength(3);
    });

    it("filters files by matched status", () => {
      const plan = makePlan([
        makeGroup({
          files: [
            makeFile({ status: "matched" }),
            makeFile({ fileId: "f2", status: "ambiguous" }),
            makeFile({ fileId: "f3", status: "matched" }),
          ],
        }),
      ]);
      const state = makeState({ plan, statusFilter: "matched" });
      const result = filterReviewGroups(state);
      expect(result[0]?.files).toHaveLength(2);
    });

    it("filters needs-attention to include ambiguous and failed", () => {
      const plan = makePlan([
        makeGroup({
          files: [
            makeFile({ status: "matched" }),
            makeFile({ fileId: "f2", status: "ambiguous" }),
            makeFile({ fileId: "f3", status: "failed" }),
            makeFile({ fileId: "f4", status: "cached" }),
          ],
        }),
      ]);
      const state = makeState({ plan, statusFilter: "needs-attention" });
      const result = filterReviewGroups(state);
      expect(result[0]?.files).toHaveLength(2);
      expect(result[0]?.files.map((f) => f.status)).toEqual(["ambiguous", "failed"]);
    });

    it("excludes empty groups after filtering", () => {
      const plan = makePlan([
        makeGroup({ animeId: "a1", files: [makeFile({ status: "matched" })] }),
        makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f2", status: "ambiguous" })] }),
      ]);
      const state = makeState({ plan, statusFilter: "matched" });
      const result = filterReviewGroups(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.animeId).toBe("a1");
    });
  });
});

describe("deriveReviewStats", () => {
  it("derives total files and groups from plan", () => {
    const plan = makePlan([
      makeGroup({ files: [makeFile(), makeFile({ fileId: "f2" })] }),
      makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f3" })] }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.totalFiles).toBe(3);
    expect(stats.totalGroups).toBe(2);
  });

  it("counts ambiguous files", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ status: "matched" }),
          makeFile({ fileId: "f2", status: "ambiguous" }),
          makeFile({ fileId: "f3", status: "ambiguous" }),
        ],
      }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.ambiguousCount).toBe(2);
  });

  it("counts groups with swap pairs", () => {
    const plan = makePlan([
      makeGroup({ swapPairs: [{ fileAId: "f1", fileBId: "f2" }] }),
      makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f3" })], swapPairs: [] }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.swapsCount).toBe(1);
  });
});

describe("findSwapPairForFile", () => {
  it("returns paired file ID when file is fileA in a swap pair", () => {
    const group = makeGroup({
      swapPairs: [{ fileAId: "f1", fileBId: "f2" }],
    });
    expect(findSwapPairForFile(group, "f1")).toBe("f2");
  });

  it("returns paired file ID when file is fileB in a swap pair", () => {
    const group = makeGroup({
      swapPairs: [{ fileAId: "f1", fileBId: "f2" }],
    });
    expect(findSwapPairForFile(group, "f2")).toBe("f1");
  });

  it("returns null when file is not in any swap pair", () => {
    const group = makeGroup({
      swapPairs: [{ fileAId: "f1", fileBId: "f2" }],
    });
    expect(findSwapPairForFile(group, "f3")).toBeNull();
  });

  it("returns correct pair when group has multiple swap pairs", () => {
    const group = makeGroup({
      swapPairs: [
        { fileAId: "f1", fileBId: "f2" },
        { fileAId: "f3", fileBId: "f4" },
      ],
    });
    expect(findSwapPairForFile(group, "f3")).toBe("f4");
  });
});
