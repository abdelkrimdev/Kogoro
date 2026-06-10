import { describe, expect, it } from "bun:test";
import { makeFile, makeGroup, makePlan } from "../../fixtures";
import { createScanProgressState } from "./scan-progress-state";
import {
  createInitialSnapshot,
  reduceClearAfterComplete,
  reduceClearAfterReview,
  reduceMessage,
  reduceOnBatchFolderComplete,
  reduceOnBatchFolderStarted,
  reduceOnBatchScanComplete,
  reduceOnBatchScanStarted,
  reduceOnViewResults,
  type ScanSessionSnapshot,
} from "./scan-session-reducer";

function snapshot(overrides: Partial<ScanSessionSnapshot> = {}): ScanSessionSnapshot {
  return { ...createInitialSnapshot(), ...overrides };
}

describe("createInitialSnapshot", () => {
  it("returns default idle state", () => {
    const s = createInitialSnapshot();
    expect(s.sessionId).toBeNull();
    expect(s.plan).toBeNull();
    expect(s.statusText).toBe("Ready");
    expect(s.isScanning).toBe(false);
    expect(s.isExecuting).toBe(false);
    expect(s.scanProgressState).toBeNull();
  });
});

describe("reduceMessage — scanProgress", () => {
  it("sets status text with file count", () => {
    const s = reduceMessage(snapshot(), "scanProgress", {
      completed: 3,
      total: 10,
      file: "/media/a.mkv",
      status: "matched",
    });
    expect(s.statusText).toBe("Scanning: 3/10 - matched");
  });

  it("sets isScanning to true", () => {
    const s = reduceMessage(snapshot(), "scanProgress", {
      completed: 1,
      total: 5,
      file: "/a.mkv",
      status: "matched",
    });
    expect(s.isScanning).toBe(true);
  });

  it("creates scanProgressState on first event", () => {
    const s = reduceMessage(snapshot(), "scanProgress", {
      completed: 1,
      total: 5,
      file: "/a.mkv",
      status: "matched",
    });
    expect(s.scanProgressState).not.toBeNull();
    expect(s.scanProgressState?.entries).toHaveLength(1);
  });

  it("accumulates entries across multiple events", () => {
    let s = reduceMessage(snapshot(), "scanProgress", {
      completed: 1,
      total: 3,
      file: "/a.mkv",
      status: "matched",
    });
    s = reduceMessage(s, "scanProgress", {
      completed: 2,
      total: 3,
      file: "/b.mkv",
      status: "ambiguous",
    });
    s = reduceMessage(s, "scanProgress", {
      completed: 3,
      total: 3,
      file: "/c.mkv",
      status: "failed",
    });
    expect(s.scanProgressState?.entries).toHaveLength(3);
    expect(s.scanProgressState?.entries[2]?.file).toBe("/c.mkv");
    expect(s.scanProgressState?.completed).toBe(3);
  });

  it("preserves unrelated state fields", () => {
    const s = reduceMessage(snapshot({ sessionId: "s1", plan: makePlan() }), "scanProgress", {
      completed: 1,
      total: 5,
      file: "/a.mkv",
      status: "matched",
    });
    expect(s.sessionId).toBe("s1");
    expect(s.plan).not.toBeNull();
  });
});

describe("reduceMessage — scanPhaseComplete", () => {
  it("sets status text with phase name", () => {
    const s = reduceMessage(snapshot(), "scanPhaseComplete", {
      phase: "scan",
      summary: { totalFiles: 10 },
    });
    expect(s.statusText).toBe("Phase complete: scan");
  });

  it("does not change other fields", () => {
    const s = reduceMessage(snapshot({ isScanning: true }), "scanPhaseComplete", {
      phase: "walk",
      summary: { totalFiles: 0 },
    });
    expect(s.isScanning).toBe(true);
  });
});

describe("reduceMessage — scanReviewReady", () => {
  it("stores sessionId and plan", () => {
    const plan = makePlan();
    const s = reduceMessage(snapshot(), "scanReviewReady", {
      sessionId: "sess-42",
      plan,
    });
    expect(s.sessionId).toBe("sess-42");
    expect(s.plan).toBe(plan);
  });

  it("sets isScanning to false", () => {
    const s = reduceMessage(snapshot({ isScanning: true }), "scanReviewReady", {
      sessionId: "s1",
      plan: makePlan(),
    });
    expect(s.isScanning).toBe(false);
  });

  it("sets review-ready status text", () => {
    const s = reduceMessage(snapshot(), "scanReviewReady", {
      sessionId: "s1",
      plan: makePlan(),
    });
    expect(s.statusText).toBe("Scan complete — review results");
  });
});

describe("reduceMessage — scanExecutionProgress", () => {
  it("extracts filename from full path", () => {
    const s = reduceMessage(snapshot(), "scanExecutionProgress", {
      completed: 1,
      total: 5,
      file: "/media/Steins;Gate/S01E01.mkv",
      status: "renamed",
    });
    expect(s.statusText).toContain("S01E01.mkv");
  });

  it("sets isExecuting to true", () => {
    const s = reduceMessage(snapshot(), "scanExecutionProgress", {
      completed: 1,
      total: 5,
      file: "/a.mkv",
      status: "renamed",
    });
    expect(s.isExecuting).toBe(true);
  });

  it("formats status text with progress", () => {
    const s = reduceMessage(snapshot(), "scanExecutionProgress", {
      completed: 3,
      total: 10,
      file: "/a.mkv",
      status: "done",
    });
    expect(s.statusText).toBe("Executing: 3/10 - a.mkv - done");
  });
});

describe("reduceMessage — scanComplete", () => {
  it("formats summary with renamed and failed counts", () => {
    const s = reduceMessage(snapshot(), "scanComplete", {
      summary: {
        renamed: 8,
        renameFailed: 2,
        renameFailures: [],
      },
    });
    expect(s.statusText).toBe("Complete: 8 renamed, 2 failed");
  });

  it("appends unique failure reasons", () => {
    const s = reduceMessage(snapshot(), "scanComplete", {
      summary: {
        renamed: 5,
        renameFailed: 3,
        renameFailures: [
          { file: "/a.mkv", reason: "permission denied" },
          { file: "/b.mkv", reason: "file exists" },
          { file: "/c.mkv", reason: "permission denied" },
        ],
      },
    });
    expect(s.statusText).toBe("Complete: 5 renamed, 3 failed (permission denied, file exists)");
  });

  it("does not change other state fields", () => {
    const s = reduceMessage(snapshot({ isExecuting: true, isScanning: true }), "scanComplete", {
      summary: { renamed: 1, renameFailed: 0, renameFailures: [] },
    });
    expect(s.isExecuting).toBe(true);
    expect(s.isScanning).toBe(true);
  });
});

describe("reduceMessage — enrichmentProgress", () => {
  it("formats artwork progress", () => {
    const s = reduceMessage(snapshot(), "enrichmentProgress", {
      command: "artwork",
      completed: 3,
      total: 10,
      file: "/a.mkv",
      status: "downloaded",
    });
    expect(s.statusText).toBe("Cover art: 3/10 - downloaded");
  });

  it("formats metadata progress", () => {
    const s = reduceMessage(snapshot(), "enrichmentProgress", {
      command: "metadata",
      completed: 1,
      total: 5,
      file: "/b.mkv",
      status: "written",
    });
    expect(s.statusText).toBe("Metadata: 1/5 - written");
  });
});

describe("reduceMessage — unknown message", () => {
  it("returns state unchanged", () => {
    const s = snapshot({ statusText: "custom" });
    const result = reduceMessage(s, "unknownMessage", {});
    expect(result).toBe(s);
  });
});

describe("reduceOnViewResults", () => {
  it("clears scanProgressState", () => {
    const prev = snapshot({ scanProgressState: createScanProgressState() });
    const s = reduceOnViewResults(prev);
    expect(s.scanProgressState).toBeNull();
  });

  it("sets status text to review ready", () => {
    const s = reduceOnViewResults(snapshot());
    expect(s.statusText).toBe("Review ready");
  });

  it("clears batch summary state when entering review", () => {
    const prev = snapshot({
      showSummary: true,
      scanSummaries: [
        { basename: "Show", fileCount: 5, matchCount: 4, ambiguousCount: 0, failedCount: 1 },
      ],
      currentScanFolder: "Show",
      batchFolderProgress: { current: 3, total: 3 },
    });
    const s = reduceOnViewResults(prev);
    expect(s.showSummary).toBe(false);
    expect(s.scanSummaries).toHaveLength(0);
    expect(s.currentScanFolder).toBeNull();
    expect(s.batchFolderProgress).toBeNull();
  });
});

describe("reduceClearAfterReview", () => {
  it("clears sessionId and plan", () => {
    const s = reduceClearAfterReview(snapshot({ sessionId: "s1", plan: makePlan() }));
    expect(s.sessionId).toBeNull();
    expect(s.plan).toBeNull();
  });

  it("preserves other fields", () => {
    const s = reduceClearAfterReview(
      snapshot({ sessionId: "s1", plan: makePlan(), statusText: "review" }),
    );
    expect(s.statusText).toBe("review");
  });
});

describe("reduceClearAfterComplete", () => {
  it("clears session fields", () => {
    const s = reduceClearAfterComplete(snapshot({ sessionId: "s1", plan: makePlan() }));
    expect(s.sessionId).toBeNull();
    expect(s.plan).toBeNull();
  });

  it("resets scanning and executing flags", () => {
    const s = reduceClearAfterComplete(snapshot({ isScanning: true, isExecuting: true }));
    expect(s.isScanning).toBe(false);
    expect(s.isExecuting).toBe(false);
  });

  it("clears scanProgressState", () => {
    const s = reduceClearAfterComplete(snapshot({ scanProgressState: createScanProgressState() }));
    expect(s.scanProgressState).toBeNull();
  });

  it("clears batch state", () => {
    const s = reduceClearAfterComplete(
      snapshot({
        isBatchScanning: true,
        currentScanFolder: "Show",
        batchFolderProgress: { current: 2, total: 3 },
        showSummary: true,
        scanSummaries: [
          { basename: "Show", fileCount: 5, matchCount: 4, ambiguousCount: 0, failedCount: 1 },
        ],
      }),
    );
    expect(s.isBatchScanning).toBe(false);
    expect(s.currentScanFolder).toBeNull();
    expect(s.batchFolderProgress).toBeNull();
    expect(s.showSummary).toBe(false);
    expect(s.scanSummaries).toHaveLength(0);
  });
});

describe("reduceOnBatchScanStarted", () => {
  it("sets isBatchScanning to true", () => {
    const s = reduceOnBatchScanStarted(snapshot(), 3);
    expect(s.isBatchScanning).toBe(true);
  });

  it("stores folder count in batchFolderProgress", () => {
    const s = reduceOnBatchScanStarted(snapshot(), 5);
    expect(s.batchFolderProgress).toEqual({ current: 0, total: 5 });
  });

  it("clears previous summaries", () => {
    const prev = snapshot({
      showSummary: true,
      scanSummaries: [
        { basename: "old", fileCount: 1, matchCount: 1, ambiguousCount: 0, failedCount: 0 },
      ],
    });
    const s = reduceOnBatchScanStarted(prev, 2);
    expect(s.showSummary).toBe(false);
    expect(s.scanSummaries).toHaveLength(0);
  });

  it("resets perFolderPlans", () => {
    const prev = snapshot({ perFolderPlans: new Map([["/old", makePlan()]]) });
    const s = reduceOnBatchScanStarted(prev, 1);
    expect(s.perFolderPlans.size).toBe(0);
  });

  it("clears previous plan and sessionId", () => {
    const prev = snapshot({ plan: makePlan(), sessionId: "old-session" });
    const s = reduceOnBatchScanStarted(prev, 1);
    expect(s.plan).toBeNull();
    expect(s.sessionId).toBeNull();
  });
});

describe("reduceOnBatchFolderStarted", () => {
  it("sets currentScanFolder to folder basename", () => {
    const s = reduceOnBatchFolderStarted(snapshot(), "/anime/Jujutsu Kaisen", "Jujutsu Kaisen");
    expect(s.currentScanFolder).toBe("Jujutsu Kaisen");
  });

  it("increments batchFolderProgress current", () => {
    const prev = snapshot({ batchFolderProgress: { current: 0, total: 3 } });
    const s = reduceOnBatchFolderStarted(prev, "/anime/One Piece", "One Piece");
    expect(s.batchFolderProgress).toEqual({ current: 1, total: 3 });
  });

  it("creates fresh scanProgressState", () => {
    const s = reduceOnBatchFolderStarted(snapshot(), "/anime/Show", "Show");
    expect(s.scanProgressState).not.toBeNull();
    expect(s.scanProgressState?.entries).toHaveLength(0);
  });
});

describe("reduceOnBatchFolderComplete", () => {
  it("stores plan in perFolderPlans", () => {
    const plan = makePlan();
    const s = reduceOnBatchFolderComplete(snapshot(), "/anime/Show", plan);
    expect(s.perFolderPlans.get("/anime/Show")).toBe(plan);
  });

  it("clears scanProgressState for next folder", () => {
    const prev = snapshot({ scanProgressState: createScanProgressState() });
    const s = reduceOnBatchFolderComplete(prev, "/anime/Show", makePlan());
    expect(s.scanProgressState).toBeNull();
  });

  it("preserves other folder plans", () => {
    const plan1 = makePlan();
    const plan2 = makePlan();
    let s = reduceOnBatchFolderComplete(snapshot(), "/anime/A", plan1);
    s = reduceOnBatchFolderComplete(s, "/anime/B", plan2);
    expect(s.perFolderPlans.size).toBe(2);
    expect(s.perFolderPlans.get("/anime/A")).toBe(plan1);
    expect(s.perFolderPlans.get("/anime/B")).toBe(plan2);
  });
});

describe("reduceOnBatchScanComplete", () => {
  it("computes scanSummaries from perFolderPlans", () => {
    const folders = [
      { path: "/anime/A", basename: "A" },
      { path: "/anime/B", basename: "B" },
    ];
    const planA = makePlan([
      makeGroup({ files: [makeFile({ status: "matched" }), makeFile({ status: "ambiguous" })] }),
    ]);
    const planB = makePlan([makeGroup({ files: [makeFile({ status: "matched" })] })]);
    let s = reduceOnBatchScanStarted(snapshot(), 2);
    s = reduceOnBatchFolderComplete(s, "/anime/A", planA);
    s = reduceOnBatchFolderComplete(s, "/anime/B", planB);
    s = reduceOnBatchScanComplete(s, folders);
    expect(s.scanSummaries).toHaveLength(2);
    expect(s.scanSummaries[0]).toEqual({
      basename: "A",
      fileCount: 2,
      matchCount: 1,
      ambiguousCount: 1,
      failedCount: 0,
    });
    expect(s.scanSummaries[1]).toEqual({
      basename: "B",
      fileCount: 1,
      matchCount: 1,
      ambiguousCount: 0,
      failedCount: 0,
    });
  });

  it("sets showSummary to true", () => {
    const s = reduceOnBatchScanComplete(
      reduceOnBatchFolderComplete(reduceOnBatchScanStarted(snapshot(), 1), "/anime/A", makePlan()),
      [{ path: "/anime/A", basename: "A" }],
    );
    expect(s.showSummary).toBe(true);
  });

  it("sets isBatchScanning to false", () => {
    const s = reduceOnBatchScanComplete(
      reduceOnBatchFolderComplete(reduceOnBatchScanStarted(snapshot(), 1), "/anime/A", makePlan()),
      [{ path: "/anime/A", basename: "A" }],
    );
    expect(s.isBatchScanning).toBe(false);
  });

  it("sets isScanning to false", () => {
    const s = reduceOnBatchScanComplete(
      reduceOnBatchFolderComplete(
        reduceOnBatchScanStarted(snapshot({ isScanning: true }), 1),
        "/anime/A",
        makePlan(),
      ),
      [{ path: "/anime/A", basename: "A" }],
    );
    expect(s.isScanning).toBe(false);
  });
});
