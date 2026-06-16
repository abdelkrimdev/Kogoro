import { describe, expect, test } from "bun:test";
import { makeMatchResult, makeScanResult } from "../fixtures";
import { buildSummary } from "./scan-summary";

describe("buildSummary", () => {
  test("counts matched results", () => {
    const results = [
      makeScanResult("/a/ep1.mkv", { match: makeMatchResult(), status: "matched" }),
      makeScanResult("/a/ep2.mkv", { match: makeMatchResult(), status: "matched" }),
    ];
    const summary = buildSummary("s1", results, new Map());
    expect(summary.matched).toBe(2);
    expect(summary.totalFiles).toBe(2);
  });

  test("counts cached results", () => {
    const results = [makeScanResult("/a/ep1.mkv", { match: makeMatchResult(), status: "cached" })];
    const summary = buildSummary("s1", results, new Map());
    expect(summary.cached).toBe(1);
  });

  test("counts ambiguous results", () => {
    const results = [makeScanResult("/a/ep1.mkv", { status: "ambiguous" })];
    const summary = buildSummary("s1", results, new Map());
    expect(summary.ambiguous).toBe(1);
  });

  test("counts failed results", () => {
    const results = [makeScanResult("/a/ep1.mkv", { status: "failed" })];
    const summary = buildSummary("s1", results, new Map());
    expect(summary.failed).toBe(1);
  });

  test("counts rename successes", () => {
    const renameResults = new Map([
      ["/a/ep1.mkv", { success: true }],
      ["/a/ep2.mkv", { success: true }],
    ]);
    const summary = buildSummary("s1", [], renameResults);
    expect(summary.renamed).toBe(2);
    expect(summary.renameFailed).toBe(0);
  });

  test("counts rename failures with basename and error message", () => {
    const renameResults = new Map([["/a/ep1.mkv", { success: false, error: "Permission denied" }]]);
    const summary = buildSummary("s1", [], renameResults);
    expect(summary.renameFailed).toBe(1);
    expect(summary.renamed).toBe(0);
    expect(summary.renameFailures).toEqual([{ file: "ep1.mkv", reason: "Permission denied" }]);
  });

  test("uses Unknown error when error message is missing", () => {
    const renameResults = new Map([["/a/ep1.mkv", { success: false }]]);
    const summary = buildSummary("s1", [], renameResults);
    expect(summary.renameFailures[0]?.reason).toBe("Unknown error");
  });

  test("returns empty summary for empty results", () => {
    const summary = buildSummary("s1", [], new Map());
    expect(summary).toEqual({
      sessionId: "s1",
      totalFiles: 0,
      matched: 0,
      cached: 0,
      ambiguous: 0,
      failed: 0,
      renamed: 0,
      renameFailed: 0,
      renameFailures: [],
    });
  });

  test("includes sessionId in output", () => {
    const summary = buildSummary("my-session", [], new Map());
    expect(summary.sessionId).toBe("my-session");
  });
});
