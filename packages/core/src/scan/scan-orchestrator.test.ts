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

function makeAmbiguousScanResult(file: string): ScanResult {
  return makeScanResult(file, { status: "ambiguous" });
}

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

    test("populates topCandidates on ambiguous files when callback provided", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
        computeTopCandidates: async () => [
          { episodeNumber: 1, title: "Episode 1" },
          { episodeNumber: 2, title: "Episode 2" },
        ],
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const file = plan?.groups[0]?.files[0];
      expect(file?.topCandidates).toEqual([
        { episodeNumber: 1, title: "Episode 1" },
        { episodeNumber: 2, title: "Episode 2" },
      ]);
    });

    test("does not set topCandidates when callback is not provided", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const file = plan?.groups[0]?.files[0];
      expect(file?.topCandidates).toBeUndefined();
    });

    test("does not set topCandidates on matched files", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
          }),
        computeTopCandidates: async () => [{ episodeNumber: 1, title: "Episode 1" }],
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const file = plan?.groups[0]?.files[0];
      expect(file?.topCandidates).toBeUndefined();
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

    test("cancels during execute phase and stops remaining renames", async () => {
      const executedFiles: string[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv", "/a/ep3.mkv"],
        scanFile: async (_file, _options, index) =>
          makeScanResult(`/a/ep${(index ?? 0) + 1}.mkv`, {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: `/a/ep${(index ?? 0) + 1}.mkv`,
              targetPath: `Jujutsu Kaisen/Season 1/S01E0${(index ?? 0) + 1}.mkv`,
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: `S01E0${(index ?? 0) + 1}.mkv`,
              action: "move",
            },
          }),
        executeRename: async (plan) => {
          executedFiles.push(plan.sourcePath);
          if (executedFiles.length === 1) {
            orch.cancel();
          }
          return { success: true };
        },
      });
      orch.on("*", () => {});
      await orch.startScan("/test/path");
      await orch.approvePlan();

      expect(orch.getState()).toBe("done");
      expect(executedFiles.length).toBeLessThanOrEqual(2);
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
      expect(completeEvent?.summary.renameFailures).toEqual([
        { file: "ep1.mkv", reason: "Access denied" },
      ]);
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

    test("uses scan root as baseDir for all files, not per-file dirname", async () => {
      const baseDirs: string[] = [];
      const ep1 = "/downloads/Oshi no Ko/TV/ep1.mkv";
      const ep2 = "/downloads/Oshi no Ko/TV/ep2.mkv";
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [ep1, ep2],
        scanFile: async (_file, _options, index) => {
          const file = (index ?? 0) === 0 ? ep1 : ep2;
          return makeScanResult(file, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Oshi no Ko", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: file,
              targetPath: `Oshi no Ko/TV/S01E0${(index ?? 0) + 1}.mkv`,
              targetDir: "Oshi no Ko/TV",
              targetFilename: `S01E0${(index ?? 0) + 1}.mkv`,
              action: "move",
            },
          });
        },
        executeRename: async (_plan, baseDir) => {
          baseDirs.push(baseDir);
          return { success: true };
        },
      });
      await orch.startScan("/downloads/Oshi no Ko/TV");
      await orch.approvePlan();

      expect(baseDirs).toHaveLength(2);
      expect(baseDirs[0]).toBe(baseDirs[1]);
      expect(baseDirs[0]).not.toBe("/downloads/Oshi no Ko/TV");
    });

    test("only executes explicitly approved groups", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "1", titleEn: "Anime A", entryType: "tv" },
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
        executeRename: async () => ({ success: true }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      // Approve only group 1
      orch.approveGroup("1");

      events.length = 0;
      await orch.approvePlan();

      const execEvents = events.filter((e) => e.type === "scanExecutionProgress");
      expect(execEvents.length).toBe(1);
      expect(execEvents[0]?.file).toBe("/a/ep1.mkv");
    });

    test("executes all non-rejected groups when only rejections exist", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "1", titleEn: "Anime A", entryType: "tv" },
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
        executeRename: async () => ({ success: true }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      // Reject group 1 only
      orch.rejectGroup("1");

      events.length = 0;
      await orch.approvePlan();

      const execEvents = events.filter((e) => e.type === "scanExecutionProgress");
      expect(execEvents.length).toBe(1);
      expect(execEvents[0]?.file).toBe("/b/ep1.mkv");
    });

    test("skips rejected groups when both approvals and rejections exist", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "1", titleEn: "Anime A", entryType: "tv" },
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
        executeRename: async () => ({ success: true }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      orch.approveGroup("1");
      orch.rejectGroup("2");

      events.length = 0;
      await orch.approvePlan();

      const execEvents = events.filter((e) => e.type === "scanExecutionProgress");
      expect(execEvents.length).toBe(1);
      expect(execEvents[0]?.file).toBe("/a/ep1.mkv");
    });

    test("cleans up empty source directories after rename", async () => {
      const { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } = await import("node:fs");
      const testDir = "/tmp/kogoro-test-cleanup";
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(`${testDir}/Anime/TV`, { recursive: true });
      writeFileSync(`${testDir}/Anime/TV/ep1.mkv`, "");

      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [`${testDir}/Anime/TV/ep1.mkv`],
        scanFile: async () =>
          makeScanResult(`${testDir}/Anime/TV/ep1.mkv`, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Anime", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: `${testDir}/Anime/TV/ep1.mkv`,
              targetPath: "Anime/S01E01.mkv",
              targetDir: "Anime",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async (plan, baseDir) => {
          const { dirname, join } = await import("node:path");
          const target = join(baseDir, plan.targetPath);
          mkdirSync(dirname(target), { recursive: true });
          renameSync(plan.sourcePath, target);
          return { success: true };
        },
      });

      await orch.startScan(testDir);
      await orch.approvePlan();

      // TV dir should be empty and removed; Anime dir now has the renamed file
      expect(existsSync(`${testDir}/Anime/TV`)).toBe(false);
      expect(existsSync(`${testDir}/Anime/S01E01.mkv`)).toBe(true);
      rmSync(testDir, { recursive: true, force: true });
    });

    test("preserves source directories with non-hidden files", async () => {
      const { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } = await import("node:fs");
      const testDir = "/tmp/kogoro-test-cleanup2";
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(`${testDir}/Anime/TV`, { recursive: true });
      writeFileSync(`${testDir}/Anime/TV/ep1.mkv`, "");
      writeFileSync(`${testDir}/Anime/TV/other-file.txt`, "");

      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [`${testDir}/Anime/TV/ep1.mkv`],
        scanFile: async () =>
          makeScanResult(`${testDir}/Anime/TV/ep1.mkv`, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Anime", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: `${testDir}/Anime/TV/ep1.mkv`,
              targetPath: "Anime/S01E01.mkv",
              targetDir: "Anime",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async (plan, baseDir) => {
          const { dirname, join } = await import("node:path");
          const target = join(baseDir, plan.targetPath);
          mkdirSync(dirname(target), { recursive: true });
          renameSync(plan.sourcePath, target);
          return { success: true };
        },
      });

      await orch.startScan(testDir);
      await orch.approvePlan();

      // Directory should be preserved because it had other-file.txt
      expect(existsSync(`${testDir}/Anime/TV/other-file.txt`)).toBe(true);
      rmSync(testDir, { recursive: true, force: true });
    });

    test("removes directories with only hidden files", async () => {
      const { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } = await import("node:fs");
      const testDir = "/tmp/kogoro-test-cleanup3";
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(`${testDir}/Anime/TV`, { recursive: true });
      writeFileSync(`${testDir}/Anime/TV/ep1.mkv`, "");
      writeFileSync(`${testDir}/Anime/TV/.DS_Store`, "");

      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [`${testDir}/Anime/TV/ep1.mkv`],
        scanFile: async () =>
          makeScanResult(`${testDir}/Anime/TV/ep1.mkv`, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Anime", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: `${testDir}/Anime/TV/ep1.mkv`,
              targetPath: "Anime/S01E01.mkv",
              targetDir: "Anime",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async (plan, baseDir) => {
          const { dirname, join } = await import("node:path");
          const target = join(baseDir, plan.targetPath);
          mkdirSync(dirname(target), { recursive: true });
          renameSync(plan.sourcePath, target);
          return { success: true };
        },
      });

      await orch.startScan(testDir);
      await orch.approvePlan();

      // .DS_Store is hidden, so the directory should be cleaned up
      expect(existsSync(`${testDir}/Anime/TV`)).toBe(false);
      rmSync(testDir, { recursive: true, force: true });
    });

    test("preserves directories with hidden subdirectories", async () => {
      const { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } = await import("node:fs");
      const testDir = "/tmp/kogoro-test-cleanup5";
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(`${testDir}/Anime/TV/.git/objects`, { recursive: true });
      writeFileSync(`${testDir}/Anime/TV/ep1.mkv`, "");
      writeFileSync(`${testDir}/Anime/TV/.git/config`, "");

      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [`${testDir}/Anime/TV/ep1.mkv`],
        scanFile: async () =>
          makeScanResult(`${testDir}/Anime/TV/ep1.mkv`, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Anime", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: `${testDir}/Anime/TV/ep1.mkv`,
              targetPath: "Anime/S01E01.mkv",
              targetDir: "Anime",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async (plan, baseDir) => {
          const { dirname, join } = await import("node:path");
          const target = join(baseDir, plan.targetPath);
          mkdirSync(dirname(target), { recursive: true });
          renameSync(plan.sourcePath, target);
          return { success: true };
        },
      });

      await orch.startScan(testDir);
      await orch.approvePlan();

      // .git is a hidden dir, not a hidden file — directory should be preserved
      expect(existsSync(`${testDir}/Anime/TV/.git/config`)).toBe(true);
      rmSync(testDir, { recursive: true, force: true });
    });

    test("stops cleanup at scan root", async () => {
      const { mkdirSync, writeFileSync, existsSync, rmSync, renameSync } = await import("node:fs");
      const testDir = "/tmp/kogoro-test-cleanup4";
      rmSync(testDir, { recursive: true, force: true });
      mkdirSync(testDir, { recursive: true });
      writeFileSync(`${testDir}/ep1.mkv`, "");

      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [`${testDir}/ep1.mkv`],
        scanFile: async () =>
          makeScanResult(`${testDir}/ep1.mkv`, {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Anime", entryType: "tv" },
            }),
            status: "matched",
            plan: {
              sourcePath: `${testDir}/ep1.mkv`,
              targetPath: "Anime/TV/S01E01.mkv",
              targetDir: "Anime/TV",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
        executeRename: async (plan, baseDir) => {
          const { dirname, join } = await import("node:path");
          const target = join(baseDir, plan.targetPath);
          mkdirSync(dirname(target), { recursive: true });
          renameSync(plan.sourcePath, target);
          return { success: true };
        },
      });

      await orch.startScan(testDir);
      await orch.approvePlan();

      // Scan root itself should never be removed
      expect(existsSync(testDir)).toBe(true);
      rmSync(testDir, { recursive: true, force: true });
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

  describe("approveGroup", () => {
    test("marks group as approved and emits scanReviewReady", async () => {
      let emittedCount = 0;
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
                episode: {
                  id: "101",
                  animeId: "anime-a",
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
          return makeScanResult("/b/ep2.mkv", {
            match: makeMatchResult({
              anime: { id: "anime-b", titleEn: "Anime B", entryType: "tv" },
              episode: {
                id: "202",
                animeId: "anime-b",
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            }),
            status: "matched",
            plan: {
              sourcePath: "/b/ep2.mkv",
              targetPath: "Anime B/Season 1/S01E01.mkv",
              targetDir: "Anime B/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          });
        },
      });

      orch.on("scanReviewReady", () => {
        emittedCount++;
      });

      await orch.startScan("/test/path");

      const initialEmitted = emittedCount;
      orch.approveGroup("anime-a");

      // Verify scanReviewReady was emitted again
      expect(emittedCount).toBe(initialEmitted + 1);

      // Verify group state in plan
      const plan = orch.getPlan();
      const groupA = plan?.groups.find((g) => g.animeId === "anime-a");
      const groupB = plan?.groups.find((g) => g.animeId === "anime-b");
      expect(groupA?.rejected).toBe(false);
      // groupB should remain neutral (rejected is undefined or false)
      expect(groupB?.rejected).toBeFalsy();
    });

    test("rejects approveGroup if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.approveGroup("anime-a")).toThrow("not in review");
    });

    test("rejects approveGroup if animeId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
            }),
            status: "matched",
          }),
      });
      await orch.startScan("/test/path");
      expect(() => orch.approveGroup("nonexistent")).toThrow("not found");
    });
  });

  describe("rejectGroup", () => {
    test("marks group as rejected and emits scanReviewReady", async () => {
      let emittedCount = 0;
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep2.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
                episode: {
                  id: "101",
                  animeId: "anime-a",
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
          return makeScanResult("/b/ep2.mkv", {
            match: makeMatchResult({
              anime: { id: "anime-b", titleEn: "Anime B", entryType: "tv" },
              episode: {
                id: "202",
                animeId: "anime-b",
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            }),
            status: "matched",
            plan: {
              sourcePath: "/b/ep2.mkv",
              targetPath: "Anime B/Season 1/S01E01.mkv",
              targetDir: "Anime B/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          });
        },
      });

      orch.on("scanReviewReady", () => {
        emittedCount++;
      });

      await orch.startScan("/test/path");

      const initialEmitted = emittedCount;
      orch.rejectGroup("anime-a");

      expect(emittedCount).toBe(initialEmitted + 1);

      const plan = orch.getPlan();
      const groupA = plan?.groups.find((g) => g.animeId === "anime-a");
      expect(groupA?.rejected).toBe(true);
    });

    test("rejects rejectGroup if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.rejectGroup("anime-a")).toThrow("not in review");
    });

    test("rejects rejectGroup if animeId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
            }),
            status: "matched",
          }),
      });
      await orch.startScan("/test/path");
      expect(() => orch.rejectGroup("nonexistent")).toThrow("not found");
    });
  });

  describe("getMatchResults", () => {
    test("returns empty array when no results exist", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(orch.getMatchResults()).toEqual([]);
    });

    test("returns matched files with anime and episode data", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-1", titleEn: "Anime A", entryType: "tv" },
              episode: {
                id: "ep-1",
                animeId: "tvdb-1",
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            }),
            status: "matched",
          }),
      });
      await orch.startScan("/test");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        animeId: "tvdb-1",
        animeTitle: "Anime A",
        entryType: "tv",
        episodeId: "ep-1",
        episode: 1,
        season: 1,
        title: "Ep 1",
        filePath: "/a/ep1.mkv",
      });
    });

    test("handles match without episode data", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/movie.mkv"],
        scanFile: async () =>
          makeScanResult("/a/movie.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-10", titleEn: "A Movie", entryType: "movie" },
              episode: undefined,
            }),
            status: "matched",
          }),
      });
      await orch.startScan("/test");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.episodeId).toBeNull();
      expect(results[0]?.episode).toBeNull();
      expect(results[0]?.season).toBeNull();
      expect(results[0]?.title).toBeNull();
    });

    test("excludes ambiguous and failed results", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/a/amb.mkv", "/a/fail.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({ anime: { id: "1", titleEn: "A", entryType: "tv" } }),
              status: "matched",
            });
          }
          if (index === 1) {
            return makeScanResult("/a/amb.mkv", { status: "ambiguous" });
          }
          return makeScanResult("/a/fail.mkv", { status: "failed" });
        },
      });
      await orch.startScan("/test");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.filePath).toBe("/a/ep1.mkv");
    });

    test("includes cached results with match data", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/cached.mkv"],
        scanFile: async () =>
          makeScanResult("/a/cached.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-20", titleEn: "Anime B", entryType: "tv" },
            }),
            status: "cached",
          }),
      });
      await orch.startScan("/test");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.animeId).toBe("tvdb-20");
    });

    test("excludes rejected groups", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "tvdb-a", titleEn: "Anime A", entryType: "tv" },
                episode: {
                  id: "ep-a",
                  animeId: "tvdb-a",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep A1",
                  entryType: "tv",
                },
              }),
              status: "matched",
            });
          }
          return makeScanResult("/b/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-b", titleEn: "Anime B", entryType: "tv" },
              episode: {
                id: "ep-b",
                animeId: "tvdb-b",
                season: 1,
                episode: 1,
                titleEn: "Ep B1",
                entryType: "tv",
              },
            }),
            status: "matched",
          });
        },
      });
      await orch.startScan("/test");

      orch.rejectGroup("tvdb-a");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.animeId).toBe("tvdb-b");
    });

    test("only includes explicitly approved groups when approvals exist", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv", "/c/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "tvdb-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            });
          }
          if (index === 1) {
            return makeScanResult("/b/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "tvdb-b", titleEn: "Anime B", entryType: "tv" },
              }),
              status: "matched",
            });
          }
          return makeScanResult("/c/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-c", titleEn: "Anime C", entryType: "tv" },
            }),
            status: "matched",
          });
        },
      });
      await orch.startScan("/test");

      orch.approveGroup("tvdb-a");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.animeId).toBe("tvdb-a");
    });

    test("excludes rejected and non-approved when both approvals and rejections exist", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv", "/c/ep1.mkv"],
        scanFile: async (_file, _options, index) => {
          if (index === 0) {
            return makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "tvdb-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            });
          }
          if (index === 1) {
            return makeScanResult("/b/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "tvdb-b", titleEn: "Anime B", entryType: "tv" },
              }),
              status: "matched",
            });
          }
          return makeScanResult("/c/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "tvdb-c", titleEn: "Anime C", entryType: "tv" },
            }),
            status: "matched",
          });
        },
      });
      await orch.startScan("/test");

      orch.approveGroup("tvdb-a");
      orch.rejectGroup("tvdb-b");

      const results = orch.getMatchResults();
      expect(results).toHaveLength(1);
      expect(results[0]?.animeId).toBe("tvdb-a");
    });
  });

  describe("resolveMatch", () => {
    test("resolves ambiguous file and updates plan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
        resolveFile: async (_filePath, _animeId, _episodeId) =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult({
              anime: { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
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
          }),
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const fileId = plan?.groups[0]?.files[0]?.fileId;
      expect(fileId).toBeDefined();
      if (!fileId) throw new Error("Test invariant: fileId is undefined");

      await orch.resolveMatch(fileId, "1", "101");

      const updatedPlan = orch.getPlan();
      expect(updatedPlan?.ambiguousCount).toBe(0);
      expect(updatedPlan?.groups[0]?.files[0]?.status).toBe("matched");
      expect(updatedPlan?.groups[0]?.files[0]?.animeId).toBe("1");
    });

    test("emits scanReviewReady after resolve", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
        resolveFile: async (filePath) =>
          makeScanResult(filePath, {
            match: makeMatchResult(),
            status: "matched",
            plan: {
              sourcePath: filePath,
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            },
          }),
      });
      orch.on("*", (e) => events.push(e));
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const fileId = plan?.groups[0]?.files[0]?.fileId;

      events.length = 0;
      if (!fileId) throw new Error("Test invariant: fileId is undefined");
      await orch.resolveMatch(fileId, "1", "101");

      const reviewEvents = events.filter((e) => e.type === "scanReviewReady");
      expect(reviewEvents.length).toBe(1);
    });

    test("rejects resolveMatch if not in review state", () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => [],
        scanFile: async () => makeScanResult("dummy"),
      });
      expect(() => orch.resolveMatch("file-id", "anime-1", "ep-1")).toThrow("not in review");
    });

    test("rejects resolveMatch if fileId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () =>
          makeScanResult("/a/ep1.mkv", {
            match: makeMatchResult(),
            status: "matched",
          }),
        resolveFile: async (filePath) =>
          makeScanResult(filePath, { match: makeMatchResult(), status: "matched" }),
      });
      await orch.startScan("/test/path");
      expect(() => orch.resolveMatch("nonexistent", "1", "101")).toThrow("file not found");
    });

    test("rejects resolveMatch if resolveFile callback not provided", async () => {
      const orch = new ScanOrchestrator({
        scanner: createMockMatcher(),
        walk: async () => ["/a/ep1.mkv"],
        scanFile: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const fileId = plan?.groups[0]?.files[0]?.fileId;
      if (!fileId) throw new Error("Test invariant: fileId is undefined");
      expect(() => orch.resolveMatch(fileId, "1", "101")).toThrow("resolve not available");
    });
  });
});
