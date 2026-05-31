import { describe, expect, test } from "bun:test";
import { createMockMatcher, makeMatchResult, makeParsedResult } from "../fixtures";
import type { ReviewPlan } from "../types";
import {
  type ScanCompleteEvent,
  type ScanEvent,
  ScanOrchestrator,
  type ScanReviewReadyEvent,
} from "./scan-orchestrator";
import type { ScanResult } from "./scanner";

function makeScanResult(file: string, overrides?: Partial<ScanResult>): ScanResult {
  return {
    file,
    hash: `hash-${file}`,
    parsed: makeParsedResult(null),
    match: null,
    plan: null,
    cached: false,
    skipped: false,
    status: "matched",
    ...overrides,
  };
}

describe("ScanOrchestrator", () => {
  describe("state transitions", () => {
    test("starts in idle state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(orch.getState()).toBe("idle");
    });

    test("transitions to scan on startScan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      const promise = orch.startScan("/test/path");
      expect(orch.getState()).toBe("scan");
      await promise;
    });

    test("transitions scan → plan → review → done after scan completes", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
      });
      await orch.startScan("/test/path");
      expect(orch.getState()).toBe("review");
    });

    test("transitions to done on approvePlan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
      });
      await orch.startScan("/test/path");
      await orch.approvePlan();
      expect(orch.getState()).toBe("done");
    });

    test("transitions to done on rejectPlan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
          }),
      });
      await orch.startScan("/test/path");
      orch.rejectPlan();
      expect(orch.getState()).toBe("done");
    });
  });

  describe("progress events", () => {
    test("emits scanProgress for each file", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) =>
          makeScanResult(`/a/ep${index !== undefined ? index + 1 : 1}.mkv`, {
            match: makeMatchResult(),
            status: "matched",
          }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      const progressEvents = events.filter((e) => e.type === "scanProgress");
      expect(progressEvents.length).toBe(2);
      expect(progressEvents[0]).toMatchObject({ file: expect.any(String), completed: 1, total: 2 });
      expect(progressEvents[1]).toMatchObject({ file: expect.any(String), completed: 2, total: 2 });
    });

    test("emits scanPhaseComplete after scan phase", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      const phaseEvents = events.filter((e) => e.type === "scanPhaseComplete");
      expect(phaseEvents.length).toBeGreaterThanOrEqual(1);
      expect(phaseEvents[0]).toMatchObject({ phase: "plan" });
    });

    test("emits scanReviewReady with plan", async () => {
      let emittedPlan: ReviewPlan | undefined;
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
      });
      orch.on("scanReviewReady", (e) => {
        emittedPlan = (e as ScanReviewReadyEvent).plan;
      });
      await orch.startScan("/test/path");

      expect(emittedPlan).toBeDefined();
      expect(emittedPlan?.groups).toHaveLength(1);
      expect(emittedPlan?.totalFiles).toBe(1);
    });

    test("emits scanExecutionProgress during execute phase", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async () => ({ success: true }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");
      await orch.approvePlan();

      const execEvents = events.filter((e) => e.type === "scanExecutionProgress");
      expect(execEvents.length).toBe(1);
      expect(execEvents[0]).toMatchObject({
        completed: 1,
        total: 1,
        file: expect.any(String),
      });
    });

    test("emits scanComplete after execution", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async () => ({ success: true }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");
      await orch.approvePlan();

      const completeEvents = events.filter((e) => e.type === "scanComplete");
      expect(completeEvents.length).toBe(1);
      expect(completeEvents[0]).toMatchObject({
        summary: expect.objectContaining({ renamed: expect.any(Number) }),
      });
    });
  });

  describe("ambiguous matches", () => {
    test("queues ambiguous matches without pausing scan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
          }
          return makeScanResult("/a/ep2.mkv", {
            match: makeMatchResult(),
            status: "matched",
          });
        },
      });
      await orch.startScan("/test/path");
      expect(orch.getState()).toBe("review");
    });

    test("counts ambiguous in summary", async () => {
      let reviewEvent: ScanReviewReadyEvent | undefined;
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
          }
          return makeScanResult("/a/ep2.mkv", {
            match: makeMatchResult(),
            status: "matched",
          });
        },
      });
      orch.on("scanReviewReady", (e) => {
        reviewEvent = e as ScanReviewReadyEvent;
      });
      await orch.startScan("/test/path");
      expect(reviewEvent?.plan.ambiguousCount).toBe(1);
    });
  });

  describe("cancellation", () => {
    test("cancels during scan phase", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async () => makeScanResult("dummy"),
      });
      orch.startScan("/test/path");
      orch.cancel();
      expect(orch.getState()).toBe("done");
    });

    test("cancels during review phase", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
          }),
      });
      await orch.startScan("/test/path");
      orch.cancel();
      expect(orch.getState()).toBe("done");
    });

    test("emits scanComplete on cancel", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
          }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");
      orch.cancel();

      const completeEvents = events.filter((e) => e.type === "scanComplete");
      expect(completeEvents.length).toBe(1);
    });
  });

  describe("execution", () => {
    test("reports failed renames in summary", async () => {
      let completeEvent: ScanCompleteEvent | undefined;
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep1.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async () => ({
          success: false,
          error: { type: "permission", message: "Access denied" },
        }),
      });
      orch.on("scanComplete", (e) => {
        completeEvent = e as ScanCompleteEvent;
      });
      await orch.startScan("/test/path");
      await orch.approvePlan();

      expect(completeEvent?.summary.renameFailed).toBe(1);
      expect(completeEvent?.summary.renamed).toBe(0);
    });

    test("skips files without plans during execution", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
          }
          return makeScanResult("/a/ep2.mkv", {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: "/a/ep2.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          });
        },
        executeRename: async () => ({ success: true }),
      });
      await orch.startScan("/test/path");
      await orch.approvePlan();
      expect(orch.getState()).toBe("done");
    });
  });

  describe("error handling", () => {
    test("rejects startScan if already running", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      orch.startScan("/test/path");
      expect(() => orch.startScan("/other/path")).toThrow("already running");
    });

    test("rejects approvePlan if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.approvePlan()).toThrow("not in review");
    });

    test("rejects rejectPlan if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.rejectPlan()).toThrow("not in review");
    });

    test("rejects cancel if idle", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.cancel()).toThrow("not running");
    });
  });

  describe("swapFiles", () => {
    test("swaps proposed paths between two files in same group", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                episode: {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              }),
              status: "matched",
              plan: {
                sourcePath: "/a/ep1.mkv",
                targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
                targetDir: "Jujutsu Kaisen/Season 1",
                targetFilename: "S01E01.mkv",
                action: "move",
              },
            });
          }
          return makeScanResult("/a/ep2.mkv", {
            match: makeMatchResult({
              episode: {
                id: "102",
                animeId: "1",
                season: 1,
                episode: 2,
                titleEn: "Ep 2",
                entryType: "tv",
              },
            }),
            status: "matched",
            plan: {
              sourcePath: "/a/ep2.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E02.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E02.mkv",
              action: "move",
            },
          });
        },
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      expect(plan).toBeDefined();

      // Get file IDs from the plan
      const group = plan?.groups[0];
      expect(group).toBeDefined();
      const fileAId = group?.files[0]?.fileId;
      const fileBId = group?.files[1]?.fileId;
      expect(fileAId).toBeDefined();
      expect(fileBId).toBeDefined();

      // Swap the files
      if (fileAId && fileBId) {
        orch.swapFiles(fileAId, fileBId);
      }

      // Verify the proposed paths are swapped
      const updatedPlan = orch.getPlan();
      const updatedGroup = updatedPlan?.groups[0];
      expect(updatedGroup?.files[0]?.proposedPath).toBe("Jujutsu Kaisen/Season 1/S01E02.mkv");
      expect(updatedGroup?.files[1]?.proposedPath).toBe("Jujutsu Kaisen/Season 1/S01E01.mkv");
    });

    test("emits scanReviewReady after swap", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                episode: {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              }),
              status: "matched",
              plan: {
                sourcePath: "/a/ep1.mkv",
                targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
                targetDir: "Jujutsu Kaisen/Season 1",
                targetFilename: "S01E01.mkv",
                action: "move",
              },
            });
          }
          return makeScanResult("/a/ep2.mkv", {
            match: makeMatchResult({
              episode: {
                id: "102",
                animeId: "1",
                season: 1,
                episode: 2,
                titleEn: "Ep 2",
                entryType: "tv",
              },
            }),
            status: "matched",
            plan: {
              sourcePath: "/a/ep2.mkv",
              targetPath: "Jujutsu Kaisen/Season 1/S01E02.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E02.mkv",
              action: "move",
            },
          });
        },
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const group = plan?.groups[0];
      const fileAId = group?.files[0]?.fileId;
      const fileBId = group?.files[1]?.fileId;

      // Clear events from initial scan
      events.length = 0;

      // Swap the files
      if (fileAId && fileBId) {
        orch.swapFiles(fileAId, fileBId);
      }

      // Verify scanReviewReady is emitted
      const reviewEvents = events.filter((e) => e.type === "scanReviewReady");
      expect(reviewEvents.length).toBe(1);
    });

    test("rejects swapFiles if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.swapFiles("file-a", "file-b")).toThrow("not in review");
    });

    test("rejects swapFiles if files not in same group", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "1", titleEn: "Anime A", entryType: "tv" },
                episode: {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              }),
              status: "matched",
              plan: {
                sourcePath: "/a/ep1.mkv",
                targetPath: "Anime A/Season 1/S01E01.mkv",
                targetDir: "Anime A/Season 1",
                targetFilename: "S01E01.mkv",
                action: "move",
              },
            });
          }
          return makeScanResult("/b/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "2", titleEn: "Anime B", entryType: "tv" },
              episode: {
                id: "201",
                animeId: "2",
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            }),
            status: "matched",
            plan: {
              sourcePath: "/b/ep1.mkv",
              targetPath: "Anime B/Season 1/S01E01.mkv",
              targetDir: "Anime B/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          });
        },
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const fileAId = plan?.groups[0]?.files[0]?.fileId;
      const fileBId = plan?.groups[1]?.files[0]?.fileId;

      if (fileAId && fileBId) {
        expect(() => orch.swapFiles(fileAId, fileBId)).toThrow("not in same group");
      }
    });
  });
});
