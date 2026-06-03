import { describe, expect, it } from "bun:test";
import { makeFile, makeGroup, makePlan, makeReviewState } from "../../fixtures";
import { deriveReviewStats, filterReviewGroups, findSwapPairForFile } from "./review-state";

describe("filterReviewGroups", () => {
  describe("search filtering", () => {
    it("returns all groups when search is empty", () => {
      const plan = makePlan([
        makeGroup({ animeId: "a1", animeTitle: "Steins;Gate" }),
        makeGroup({ animeId: "a2", animeTitle: "Attack on Titan" }),
      ]);
      const state = makeReviewState({ plan, searchQuery: "" });
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
      const state = makeReviewState({ plan, searchQuery: "steins" });
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
      const state = makeReviewState({ plan, searchQuery: "E01" });
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
      const state = makeReviewState({ plan, searchQuery: "parallax" });
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
      const state = makeReviewState({ plan, statusFilter: "all" });
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
      const state = makeReviewState({ plan, statusFilter: "matched" });
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
      const state = makeReviewState({ plan, statusFilter: "needs-attention" });
      const result = filterReviewGroups(state);
      expect(result[0]?.files).toHaveLength(2);
      expect(result[0]?.files.map((f) => f.status)).toEqual(["ambiguous", "failed"]);
    });

    it("excludes empty groups after filtering", () => {
      const plan = makePlan([
        makeGroup({ animeId: "a1", files: [makeFile({ status: "matched" })] }),
        makeGroup({ animeId: "a2", files: [makeFile({ fileId: "f2", status: "ambiguous" })] }),
      ]);
      const state = makeReviewState({ plan, statusFilter: "matched" });
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

  it("counts matched, ambiguous, and failed files across groups", () => {
    const plan = makePlan([
      makeGroup({
        animeId: "a1",
        files: [
          makeFile({ fileId: "f1", status: "matched" }),
          makeFile({ fileId: "f2", status: "matched" }),
          makeFile({ fileId: "f3", status: "ambiguous" }),
          makeFile({ fileId: "f4", status: "failed" }),
        ],
      }),
      makeGroup({
        animeId: "a2",
        files: [
          makeFile({ fileId: "f5", status: "matched" }),
          makeFile({ fileId: "f6", status: "failed" }),
        ],
      }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.totalFiles).toBe(6);
    expect(stats.totalGroups).toBe(2);
    expect(stats.matchedCount).toBe(3);
    expect(stats.ambiguousCount).toBe(1);
    expect(stats.failedCount).toBe(2);
  });

  it("counts cached files as matched in breakdown", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ fileId: "f1", status: "cached" }),
          makeFile({ fileId: "f2", status: "ambiguous" }),
        ],
      }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.matchedCount).toBe(1);
    expect(stats.ambiguousCount).toBe(1);
  });

  it("derives resolvedCount from initialAmbiguousCount minus current ambiguousCount", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ fileId: "f1", status: "matched" }),
          makeFile({ fileId: "f2", status: "matched" }),
          makeFile({ fileId: "f3", status: "ambiguous" }),
        ],
      }),
    ]);
    plan.initialAmbiguousCount = 4;
    const stats = deriveReviewStats(plan);
    expect(stats.resolvedCount).toBe(3);
  });

  it("returns zero resolvedCount when initialAmbiguousCount is not set", () => {
    const plan = makePlan([
      makeGroup({
        files: [
          makeFile({ fileId: "f1", status: "matched" }),
          makeFile({ fileId: "f2", status: "ambiguous" }),
        ],
      }),
    ]);
    const stats = deriveReviewStats(plan);
    expect(stats.resolvedCount).toBe(0);
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
