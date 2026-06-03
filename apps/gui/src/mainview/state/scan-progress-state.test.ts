import { describe, expect, it } from "bun:test";
import { makeScanProgressEntry } from "../../fixtures";
import {
  addScanProgressEvent,
  createScanProgressState,
  deriveBreakdown,
  deriveProgressPercent,
  getStatusColor,
  isIndeterminate,
} from "./scan-progress-state";

describe("createScanProgressState", () => {
  it("returns initial state with walk phase", () => {
    const state = createScanProgressState();
    expect(state.phase).toBe("walk");
    expect(state.entries).toEqual([]);
    expect(state.completed).toBe(0);
    expect(state.total).toBe(0);
  });
});

describe("addScanProgressEvent", () => {
  it("adds an entry and updates completed/total", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/a.mkv", status: "matched", completed: 1, total: 10 }),
    );
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]?.file).toBe("/a.mkv");
    expect(state.entries[0]?.status).toBe("matched");
    expect(state.completed).toBe(1);
    expect(state.total).toBe(10);
  });

  it("switches phase to scan on first event", () => {
    const state = createScanProgressState();
    expect(state.phase).toBe("walk");
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 1, total: 5 }));
    expect(state.phase).toBe("scan");
  });

  it("accumulates multiple entries in order", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/a.mkv", status: "matched", completed: 1, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/b.mkv", status: "ambiguous", completed: 2, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/c.mkv", status: "failed", completed: 3, total: 3 }),
    );
    expect(state.entries).toHaveLength(3);
    expect(state.entries[2]?.file).toBe("/c.mkv");
    expect(state.completed).toBe(3);
  });

  it("preserves earlier entries when adding new events", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/a.mkv", status: "matched", completed: 1, total: 5 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ file: "/b.mkv", status: "failed", completed: 2, total: 5 }),
    );
    expect(state.entries[0]?.file).toBe("/a.mkv");
    expect(state.entries[0]?.status).toBe("matched");
    expect(state.entries[1]?.file).toBe("/b.mkv");
    expect(state.entries[1]?.status).toBe("failed");
  });
});

describe("deriveProgressPercent", () => {
  it("returns 0 when total is 0", () => {
    const state = createScanProgressState();
    expect(deriveProgressPercent(state)).toBe(0);
  });

  it("returns 0 for walk phase even with non-zero values", () => {
    const state = createScanProgressState();
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 1, total: 10 }));
    // Reset phase back to walk to test edge case
    state.phase = "walk";
    expect(deriveProgressPercent(state)).toBe(0);
  });

  it("returns correct percentage during scan phase", () => {
    const state = createScanProgressState();
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 3, total: 10 }));
    expect(deriveProgressPercent(state)).toBe(30);
  });

  it("returns 100 when completed equals total", () => {
    const state = createScanProgressState();
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 5, total: 5 }));
    expect(deriveProgressPercent(state)).toBe(100);
  });

  it("handles completed exceeding total", () => {
    const state = createScanProgressState();
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 5, total: 3 }));
    expect(deriveProgressPercent(state)).toBe(100);
  });
});

describe("isIndeterminate", () => {
  it("returns true during walk phase", () => {
    const state = createScanProgressState();
    expect(isIndeterminate(state)).toBe(true);
  });

  it("returns false during scan phase", () => {
    const state = createScanProgressState();
    addScanProgressEvent(state, makeScanProgressEntry({ completed: 1, total: 10 }));
    expect(isIndeterminate(state)).toBe(false);
  });
});

describe("getStatusColor", () => {
  it("returns success preset for matched status", () => {
    expect(getStatusColor("matched")).toBe("preset-tonal-success");
  });

  it("returns success preset for cached status", () => {
    expect(getStatusColor("cached")).toBe("preset-tonal-success");
  });

  it("returns warning preset for ambiguous status", () => {
    expect(getStatusColor("ambiguous")).toBe("preset-tonal-warning");
  });

  it("returns error preset for failed status", () => {
    expect(getStatusColor("failed")).toBe("preset-tonal-error");
  });

  it("returns default surface preset for skipped status", () => {
    expect(getStatusColor("skipped")).toBe("preset-tonal-surface");
  });

  it("returns default surface preset for pending status", () => {
    expect(getStatusColor("pending")).toBe("preset-tonal-surface");
  });
});

describe("deriveBreakdown", () => {
  it("returns zero counts for empty entries", () => {
    const state = createScanProgressState();
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 0, ambiguousCount: 0, failedCount: 0 });
  });

  it("counts matched and cached entries as matched", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "matched", completed: 1, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "matched", completed: 2, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "cached", completed: 3, total: 3 }),
    );
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 3, ambiguousCount: 0, failedCount: 0 });
  });

  it("counts ambiguous entries", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "ambiguous", completed: 1, total: 2 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "ambiguous", completed: 2, total: 2 }),
    );
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 0, ambiguousCount: 2, failedCount: 0 });
  });

  it("counts failed entries", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "failed", completed: 1, total: 1 }),
    );
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 0, ambiguousCount: 0, failedCount: 1 });
  });

  it("counts mixed entries correctly", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "matched", completed: 1, total: 5 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "ambiguous", completed: 2, total: 5 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "failed", completed: 3, total: 5 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "cached", completed: 4, total: 5 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "ambiguous", completed: 5, total: 5 }),
    );
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 2, ambiguousCount: 2, failedCount: 1 });
  });

  it("ignores skipped and pending entries", () => {
    const state = createScanProgressState();
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "skipped", completed: 1, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "pending", completed: 2, total: 3 }),
    );
    addScanProgressEvent(
      state,
      makeScanProgressEntry({ status: "matched", completed: 3, total: 3 }),
    );
    expect(deriveBreakdown(state)).toEqual({ matchedCount: 1, ambiguousCount: 0, failedCount: 0 });
  });
});
