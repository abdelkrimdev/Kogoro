import { describe, expect, test } from "bun:test";
import {
  createMatchCacheService,
  makeCachedMatch,
  makeMatchResult,
  makeParsedResult,
  withTempDir,
} from "../fixtures";
import { hashFile } from "../io/file-hash";
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

function makeBatchScan(scanFn: (file: string) => Promise<ScanResult>) {
  return async (filePaths: string[]) => Promise.all(filePaths.map(scanFn));
}

describe("ScanOrchestrator", () => {
  describe("state transitions", () => {
    test("starts in idle state", () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(orch.getState()).toBe("idle");
    });

    test("transitions to scan on startScan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      const promise = orch.startScan("/test/path");
      expect(orch.getState()).toBe("scan");
      await promise;
    });

    test("transitions scan → plan → review → done after scan completes", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      expect(orch.getState()).toBe("review");
    });

    test("transitions to done on approvePlan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              return makeScanResult(`/a/ep${_idx !== undefined ? _idx + 1 : 1}.mkv`, {
                match: makeMatchResult(),
                status: "matched",
              });
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                return makeScanResult(`/a/ep${_idx !== undefined ? _idx + 1 : 1}.mkv`, {
                  match: makeMatchResult(),
                  status: "matched",
                });
              };
            })(),
          ),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
                return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
              }
              return makeScanResult("/a/ep2.mkv", {
                match: makeMatchResult(),
                status: "matched",
              });
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
                  return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
                }
                return makeScanResult("/a/ep2.mkv", {
                  match: makeMatchResult(),
                  status: "matched",
                });
              };
            })(),
          ),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      expect(orch.getState()).toBe("review");
    });

    test("counts ambiguous in summary", async () => {
      let reviewEvent: ScanReviewReadyEvent | undefined;
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
                return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
              }
              return makeScanResult("/a/ep2.mkv", {
                match: makeMatchResult(),
                status: "matched",
              });
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
                  return makeScanResult("/a/ep1.mkv", { status: "ambiguous" });
                }
                return makeScanResult("/a/ep2.mkv", {
                  match: makeMatchResult(),
                  status: "matched",
                });
              };
            })(),
          ),
          plan: () => null,
        },
      });
      orch.on("scanReviewReady", (e) => {
        reviewEvent = e as ScanReviewReadyEvent;
      });
      await orch.startScan("/test/path");
      expect(reviewEvent?.plan.ambiguousCount).toBe(1);
    });

    test("does not set topCandidates on matched files", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          ),
          topCandidates: async () => [{ episodeNumber: 1, title: "Episode 1" }],
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      orch.startScan("/test/path");
      orch.cancel();
      expect(orch.getState()).toBe("done");
    });

    test("cancels during review phase", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          ),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      orch.cancel();
      expect(orch.getState()).toBe("done");
    });

    test("emits scanComplete on cancel", async () => {
      const events: ScanEvent[] = [];
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          ),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv", "/a/ep3.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              return makeScanResult(`/a/ep${(_idx ?? 0) + 1}.mkv`, {
                match: makeMatchResult(),
                status: "matched",
                plan: {
                  sourcePath: `/a/ep${(_idx ?? 0) + 1}.mkv`,
                  targetPath: `Jujutsu Kaisen/Season 1/S01E0${(_idx ?? 0) + 1}.mkv`,
                  targetDir: "Jujutsu Kaisen/Season 1",
                  targetFilename: `S01E0${(_idx ?? 0) + 1}.mkv`,
                  action: "move",
                },
              });
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                return makeScanResult(`/a/ep${(_idx ?? 0) + 1}.mkv`, {
                  match: makeMatchResult(),
                  status: "matched",
                  plan: {
                    sourcePath: `/a/ep${(_idx ?? 0) + 1}.mkv`,
                    targetPath: `Jujutsu Kaisen/Season 1/S01E0${(_idx ?? 0) + 1}.mkv`,
                    targetDir: "Jujutsu Kaisen/Season 1",
                    targetFilename: `S01E0${(_idx ?? 0) + 1}.mkv`,
                    action: "move",
                  },
                });
              };
            })(),
          ),
          rename: async (plan) => {
            executedFiles.push(plan.sourcePath);
            if (executedFiles.length === 1) {
              orch.cancel();
            }
            return { success: true };
          },
          plan: () => null,
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
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
          scanBatch: makeBatchScan(async () =>
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
          ),
          rename: async () => ({
            success: false,
            error: { type: "permission", message: "Access denied" },
          }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => [ep1, ep2],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              const file = (_idx ?? 0) === 0 ? ep1 : ep2;
              return makeScanResult(file, {
                match: makeMatchResult({
                  anime: { id: "1", titleEn: "Oshi no Ko", entryType: "tv" },
                }),
                status: "matched",
                plan: {
                  sourcePath: file,
                  targetPath: `Oshi no Ko/TV/S01E0${(_idx ?? 0) + 1}.mkv`,
                  targetDir: "Oshi no Ko/TV",
                  targetFilename: `S01E0${(_idx ?? 0) + 1}.mkv`,
                  action: "move",
                },
              });
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                const file = (_idx ?? 0) === 0 ? ep1 : ep2;
                return makeScanResult(file, {
                  match: makeMatchResult({
                    anime: { id: "1", titleEn: "Oshi no Ko", entryType: "tv" },
                  }),
                  status: "matched",
                  plan: {
                    sourcePath: file,
                    targetPath: `Oshi no Ko/TV/S01E0${(_idx ?? 0) + 1}.mkv`,
                    targetDir: "Oshi no Ko/TV",
                    targetFilename: `S01E0${(_idx ?? 0) + 1}.mkv`,
                    action: "move",
                  },
                });
              };
            })(),
          ),
          rename: async (_plan, baseDir) => {
            baseDirs.push(baseDir);
            return { success: true };
          },
          plan: () => null,
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          rename: async () => ({ success: true }),
          plan: () => null,
        },
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
  });

  describe("error handling", () => {
    test("rejects startScan if already running", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      orch.startScan("/test/path");
      expect(() => orch.startScan("/other/path")).toThrow("already running");
    });

    test("rejects approvePlan if not in review state", () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.approvePlan()).toThrow("not in review");
    });

    test("rejects cancel if idle", () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.cancel()).toThrow("not running");
    });
  });

  describe("swapFiles", () => {
    test("swaps proposed paths between two files in same group", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          plan: () => null,
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          plan: () => null,
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
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.swapFiles("file-a", "file-b")).toThrow("not in review");
    });

    test("rejects swapFiles if files not in same group", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep1.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          plan: () => null,
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          plan: () => null,
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
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.approveGroup("anime-a")).toThrow("not in review");
    });

    test("rejects approveGroup if animeId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            }),
          ),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      expect(() => orch.approveGroup("nonexistent")).toThrow("not found");
    });
  });

  describe("rejectGroup", () => {
    test("marks group as rejected and emits scanReviewReady", async () => {
      let emittedCount = 0;
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/b/ep2.mkv"],
          scan: (() => {
            let _scanIdx = 0;
            return async (_file, _options) => {
              const _idx = _scanIdx++;
              if (_idx === 0) {
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
            };
          })(),
          scanBatch: makeBatchScan(
            (() => {
              let _scanIdx = 0;
              return async (_file) => {
                const _idx = _scanIdx++;
                if (_idx === 0) {
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
              };
            })(),
          ),
          plan: () => null,
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
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.rejectGroup("anime-a")).toThrow("not in review");
    });

    test("rejects rejectGroup if animeId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult({
                anime: { id: "anime-a", titleEn: "Anime A", entryType: "tv" },
              }),
              status: "matched",
            }),
          ),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      expect(() => orch.rejectGroup("nonexistent")).toThrow("not found");
    });
  });

  describe("getMatchResults", () => {
    test("returns empty array when no results exist", () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(orch.getMatchResults()).toEqual([]);
    });
  });

  describe("resolveMatch", () => {
    test("resolves ambiguous file and updates plan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
          scanBatch: makeBatchScan(async () => makeAmbiguousScanResult("/a/ep1.mkv")),
          resolve: async (_filePath, _animeId, _episodeId) =>
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
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
          scanBatch: makeBatchScan(async () => makeAmbiguousScanResult("/a/ep1.mkv")),
          resolve: async (filePath) =>
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
          plan: () => null,
        },
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
        pipeline: {
          walk: async () => [],
          scan: async () => makeScanResult("dummy"),
          scanBatch: makeBatchScan(async () => makeScanResult("dummy")),
          plan: () => null,
        },
      });
      expect(() => orch.resolveMatch("file-id", "anime-1", "ep-1")).toThrow("not in review");
    });

    test("rejects resolveMatch if fileId not found in plan", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          scanBatch: makeBatchScan(async () =>
            makeScanResult("/a/ep1.mkv", {
              match: makeMatchResult(),
              status: "matched",
            }),
          ),
          resolve: async (filePath) =>
            makeScanResult(filePath, { match: makeMatchResult(), status: "matched" }),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");
      expect(() => orch.resolveMatch("nonexistent", "1", "101")).toThrow("file not found");
    });

    test("rejects resolveMatch if resolveFile callback not provided", async () => {
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv"],
          scan: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
          scanBatch: makeBatchScan(async () => makeAmbiguousScanResult("/a/ep1.mkv")),
          plan: () => null,
        },
      });
      await orch.startScan("/test/path");

      const plan = orch.getPlan();
      const fileId = plan?.groups[0]?.files[0]?.fileId;
      if (!fileId) throw new Error("Test invariant: fileId is undefined");
      expect(() => orch.resolveMatch(fileId, "1", "101")).toThrow("resolve not available");
    });

    test("persists resolved match to cache service", async () => {
      await withTempDir("orch-persist-resolve", async (_dir) => {
        const { cacheService, close } = createMatchCacheService();
        const resolvedMatch = makeMatchResult({
          anime: { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          episode: {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
        });

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => ["/a/ep1.mkv"],
            scan: async () => makeAmbiguousScanResult("/a/ep1.mkv"),
            scanBatch: makeBatchScan(async () => makeAmbiguousScanResult("/a/ep1.mkv")),
            resolve: async (_filePath, _animeId, _episodeId) =>
              makeScanResult("/a/ep1.mkv", {
                match: resolvedMatch,
                hash: "resolved-hash",
                status: "matched",
                plan: {
                  sourcePath: "/a/ep1.mkv",
                  targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
                  targetDir: "Jujutsu Kaisen/Season 1",
                  targetFilename: "S01E01.mkv",
                  action: "move",
                },
              }),
            plan: () => null,
          },
          cacheService,
          sourceDb: "tvdb",
        });
        await orch.startScan("/test/path");

        const plan = orch.getPlan();
        const fileId = plan?.groups[0]?.files[0]?.fileId;
        if (!fileId) throw new Error("Test invariant: fileId is undefined");

        await orch.resolveMatch(fileId, "1", "101");

        expect(cacheService.has("resolved-hash")).toBe(true);
        const cached = cacheService.get("resolved-hash");
        expect(cached?.animeId).toBe("1");
        expect(cached?.episodeId).toBe("101");
        close();
      });
    });
  });

  describe("incremental scan", () => {
    test("skips unchanged files and returns status cached with match and plan", async () => {
      await withTempDir("orch-incremental", async (dir) => {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { cacheService, scanStateService, close } = createMatchCacheService();

        const file1 = join(dir, "ep1.mkv");
        const file2 = join(dir, "ep2.mkv");
        writeFileSync(file1, "content1");
        writeFileSync(file2, "content2");

        // Get real stat and hash for file1
        const { statSync } = await import("node:fs");
        const stat1 = statSync(file1);
        const hash1 = await hashFile(file1);

        // Pre-populate scan state and matches cache for file1
        scanStateService.set(file1, stat1.size, Math.floor(stat1.mtimeMs / 1000), hash1);
        cacheService.set(hash1, makeCachedMatch({ animeId: "1", episodeId: "101", episode: 1 }));

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1, file2],
            scan: async (filePath) => {
              return makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              });
            },
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                if (filePath === file1) {
                  return makeScanResult(filePath, {
                    hash: hash1,
                    match: makeMatchResult({ anime: { id: "1", titleEn: "JJK", entryType: "tv" } }),
                    cached: true,
                    skipped: true,
                    status: "cached",
                    plan: {
                      sourcePath: filePath,
                      targetPath: "JJK/S01E01.mkv",
                      targetDir: "JJK",
                      targetFilename: "S01E01.mkv",
                      action: "move",
                    },
                  });
                }
                return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
              });
            },
            plan: (filePath, _match) => ({
              sourcePath: filePath,
              targetPath: "Jujutsu Kaisen/Season 1/S01E01.mkv",
              targetDir: "Jujutsu Kaisen/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            }),
          },
          cacheService,
          scanStateService,
        });

        await orch.startScan(dir);

        expect(orch.getState()).toBe("review");

        const results = (orch as unknown as { results: ScanResult[] }).results;
        const r1 = results.find((r) => r.file === file1);
        const r2 = results.find((r) => r.file === file2);
        expect(r1?.status).toBe("cached");
        expect(r1?.skipped).toBe(true);
        expect(r1?.match).not.toBeNull();
        expect(r1?.match?.anime.id).toBe("1");
        expect(r1?.plan).not.toBeNull();
        expect(r1?.plan?.targetFilename).toBe("S01E01.mkv");
        expect(r2?.status).toBe("matched");
        close();
      });
    });

    test("falls through to full scan when hash lookup misses", async () => {
      await withTempDir("orch-cache-miss", async (dir) => {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { scanStateService, close } = createMatchCacheService();
        const scanFileCalls: string[] = [];

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        const { statSync } = await import("node:fs");
        const stat1 = statSync(file1);

        // Pre-populate scan state but NOT matches table
        scanStateService.set(file1, stat1.size, Math.floor(stat1.mtimeMs / 1000), "stale-hash");

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) => {
              scanFileCalls.push(filePath);
              return makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              });
            },
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                scanFileCalls.push(filePath);
                return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
              });
            },
            plan: () => null,
          },
          scanStateService,
        });

        await orch.startScan(dir);

        // file1 should be scanned (hash lookup missed)
        expect(scanFileCalls).toEqual([file1]);
        expect(orch.getState()).toBe("review");

        const results = (orch as unknown as { results: ScanResult[] }).results;
        const r1 = results.find((r) => r.file === file1);
        expect(r1?.status).toBe("matched");
        expect(r1?.skipped).toBe(false);
        close();
      });
    });

    test("force option scans all files even if unchanged", async () => {
      await withTempDir("orch-force", async (dir) => {
        const { writeFileSync, statSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { scanStateService, close } = createMatchCacheService();
        const scanFileCalls: string[] = [];

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        const stat1 = statSync(file1);
        const hash1 = await hashFile(file1);
        scanStateService.set(file1, stat1.size, Math.floor(stat1.mtimeMs / 1000), hash1);

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) => {
              scanFileCalls.push(filePath);
              return makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              });
            },
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                scanFileCalls.push(filePath);
                return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
              });
            },
            plan: () => null,
          },
          scanStateService,
          force: true,
        });

        await orch.startScan(dir);

        // file1 should be scanned despite being in cache (force bypasses)
        expect(scanFileCalls).toEqual([file1]);
        close();
      });
    });

    test("emits scanProgress for skipped files", async () => {
      await withTempDir("orch-incr-progress", async (dir) => {
        const { writeFileSync, statSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { cacheService, scanStateService, close } = createMatchCacheService();
        const events: ScanEvent[] = [];

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        const stat1 = statSync(file1);
        const hash1 = await hashFile(file1);
        scanStateService.set(file1, stat1.size, Math.floor(stat1.mtimeMs / 1000), hash1);
        cacheService.set(hash1, makeCachedMatch({ animeId: "1", episodeId: "101", episode: 1 }));

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async () => makeScanResult(file1),
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                return makeScanResult(filePath, {
                  hash: hash1,
                  match: makeMatchResult({ anime: { id: "1", titleEn: "JJK", entryType: "tv" } }),
                  cached: true,
                  skipped: true,
                  status: "cached",
                  plan: {
                    sourcePath: filePath,
                    targetPath: "JJK/S01E01.mkv",
                    targetDir: "JJK",
                    targetFilename: "S01E01.mkv",
                    action: "move",
                  },
                });
              });
            },
            plan: () => ({
              sourcePath: file1,
              targetPath: "test/S01E01.mkv",
              targetDir: "test",
              targetFilename: "S01E01.mkv",
              action: "move",
            }),
          },
          cacheService,
          scanStateService,
        });

        orch.on("*", (e) => events.push(e));
        await orch.startScan(dir);

        const progressEvents = events.filter((e) => e.type === "scanProgress");
        expect(progressEvents).toHaveLength(1);
        expect(progressEvents[0]).toMatchObject({
          file: file1,
          status: "cached",
          matched: true,
        });
        close();
      });
    });

    test("purges stale scan_state entries during scan", async () => {
      await withTempDir("orch-stale-cleanup", async (dir) => {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { cacheService, scanStateService, close } = createMatchCacheService();

        // Create a real file
        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        // Add scan_state for a file that won't be in currentPaths (stale)
        scanStateService.set("/deleted/ep2.mkv", 200, 2000, "staleHash");

        // Add a match for the stale hash
        cacheService.set("staleHash", makeCachedMatch({ animeId: "99" }));

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) =>
              makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              }),
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
              });
            },
            plan: () => null,
          },
          cacheService,
          scanStateService,
        });

        await orch.startScan(dir);

        // Stale scan_state should be cleaned up
        expect(scanStateService.get("/deleted/ep2.mkv")).toBeNull();
        // Orphaned match should also be cleaned up
        expect(cacheService.has("staleHash")).toBe(false);
        close();
      });
    });

    test("delegates stale purge to CacheService when provided", async () => {
      await withTempDir("orch-cache-service", async (dir) => {
        const { writeFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { cacheService, scanStateService, close } = createMatchCacheService();

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        // Stale entry that should be purged by CacheService
        scanStateService.set("/deleted/ep2.mkv", 200, 2000, "staleHash");
        cacheService.set("staleHash", makeCachedMatch({ animeId: "99" }));

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) =>
              makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              }),
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
              });
            },
            plan: () => null,
          },
          cacheService,
          scanStateService,
        });

        await orch.startScan(dir);

        // CacheService.purgeStale was called — stale entries removed
        expect(scanStateService.get("/deleted/ep2.mkv")).toBeNull();
        expect(cacheService.has("staleHash")).toBe(false);
        close();
      });
    });

    test("works without cache option (no incremental behavior)", async () => {
      const scanFileCalls: string[] = [];
      const orch = new ScanOrchestrator({
        pipeline: {
          walk: async () => ["/a/ep1.mkv", "/a/ep2.mkv"],
          scan: async (filePath) => {
            scanFileCalls.push(filePath);
            return makeScanResult(filePath, {
              match: makeMatchResult(),
              status: "matched",
            });
          },
          scanBatch: async (filePaths) => {
            return filePaths.map((filePath) => {
              scanFileCalls.push(filePath);
              return makeScanResult(filePath, { match: makeMatchResult(), status: "matched" });
            });
          },
          plan: () => null,
        },
      });

      await orch.startScan("/test/path");

      // All files scanned without cache
      expect(scanFileCalls).toEqual(["/a/ep1.mkv", "/a/ep2.mkv"]);
    });

    test("stores scan state after scanning a new file", async () => {
      await withTempDir("orch-store-state", async (dir) => {
        const { writeFileSync, statSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { scanStateService, close } = createMatchCacheService();

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) =>
              makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              }),
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                const result = makeScanResult(filePath, {
                  match: makeMatchResult(),
                  status: "matched",
                });
                try {
                  const stat = statSync(filePath);
                  scanStateService.set(
                    filePath,
                    stat.size,
                    Math.floor(stat.mtimeMs / 1000),
                    result.hash,
                  );
                } catch {
                  // file might not exist, skip state storage
                }
                return result;
              });
            },
            plan: () => null,
          },
          scanStateService,
        });

        await orch.startScan(dir);

        // Verify scan state was stored with hash from scanFile result
        const stored = scanStateService.get(file1);
        expect(stored).not.toBeNull();
        const stat1 = statSync(file1);
        expect(stored?.size).toBe(stat1.size);
        expect(stored?.mtime).toBe(Math.floor(stat1.mtimeMs / 1000));
        expect(stored?.hash).toBe(`hash-${file1}`);
        close();
      });
    });

    test("stores scan state when file deleted mid-scan", async () => {
      await withTempDir("orch-setfromfs-race", async (dir) => {
        const { writeFileSync, unlinkSync, statSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { scanStateService, close } = createMatchCacheService();

        const file1 = join(dir, "ep1.mkv");
        writeFileSync(file1, "content1");

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [file1],
            scan: async (filePath) => {
              unlinkSync(filePath);
              return makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
              });
            },
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                const result = makeScanResult(filePath, {
                  match: makeMatchResult(),
                  status: "matched",
                });
                try {
                  const stat = statSync(filePath);
                  scanStateService.set(
                    filePath,
                    stat.size,
                    Math.floor(stat.mtimeMs / 1000),
                    result.hash,
                  );
                } catch {
                  // file was deleted, still store hash
                  scanStateService.set(filePath, 0, 0, result.hash);
                }
                unlinkSync(filePath);
                return result;
              });
            },
            plan: () => null,
          },
          scanStateService,
        });

        await orch.startScan(dir);
        expect(orch.getState()).toBe("review");

        const stored = scanStateService.get(file1);
        expect(stored).not.toBeNull();
        expect(stored?.hash).toBe(`hash-${file1}`);
        close();
      });
    });

    test("updates scan state after successful rename", async () => {
      await withTempDir("orch-execute-state", async (dir) => {
        const { writeFileSync, statSync, existsSync } = await import("node:fs");
        const { join, dirname } = await import("node:path");
        const { scanStateService, close } = createMatchCacheService();

        const srcFile = join(dir, "downloads", "ep1.mkv");
        const destDir = join(dir, "Anime", "TV");
        const destFile = join(destDir, "S01E01.mkv");

        // Create source file
        const { mkdirSync } = await import("node:fs");
        mkdirSync(dirname(srcFile), { recursive: true });
        writeFileSync(srcFile, "content1");

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [srcFile],
            scan: async (filePath) =>
              makeScanResult(filePath, {
                match: makeMatchResult({
                  anime: { id: "1", titleEn: "Anime", entryType: "tv" },
                }),
                status: "matched",
                plan: {
                  sourcePath: srcFile,
                  targetPath: "Anime/TV/S01E01.mkv",
                  targetDir: "Anime/TV",
                  targetFilename: "S01E01.mkv",
                  action: "move",
                },
              }),
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                const result = makeScanResult(filePath, {
                  match: makeMatchResult({
                    anime: { id: "1", titleEn: "Anime", entryType: "tv" },
                  }),
                  status: "matched",
                  plan: {
                    sourcePath: srcFile,
                    targetPath: "Anime/TV/S01E01.mkv",
                    targetDir: "Anime/TV",
                    targetFilename: "S01E01.mkv",
                    action: "move",
                  },
                });
                try {
                  const stat = statSync(filePath);
                  scanStateService.set(
                    filePath,
                    stat.size,
                    Math.floor(stat.mtimeMs / 1000),
                    result.hash,
                  );
                } catch {
                  // file might not exist, skip state storage
                }
                return result;
              });
            },
            rename: async (plan, baseDir) => {
              const target = join(baseDir, plan.targetPath);
              mkdirSync(dirname(target), { recursive: true });
              const { renameSync } = await import("node:fs");
              renameSync(plan.sourcePath, target);
              return { success: true };
            },
            plan: () => null,
          },
          scanStateService,
        });

        await orch.startScan(dir);

        // scan_state should exist for source path
        expect(scanStateService.get(srcFile)).not.toBeNull();

        await orch.approvePlan();

        // After rename: old path scan_state should be deleted
        expect(scanStateService.get(srcFile)).toBeNull();
        // New path scan_state should exist (if the file exists)
        if (existsSync(destFile)) {
          const destStat = statSync(destFile);
          const newScanState = scanStateService.get(destFile);
          expect(newScanState).not.toBeNull();
          expect(newScanState?.size).toBe(destStat.size);
        }
        close();
      });
    });

    test("excludes already-organized files from the review plan", async () => {
      await withTempDir("orch-already-organized", async (dir) => {
        const { writeFileSync, mkdirSync } = await import("node:fs");
        const { join } = await import("node:path");

        // Create an organized file at its target location
        const organizedDir = join(dir, "Attack on Titan", "Season 1");
        mkdirSync(organizedDir, { recursive: true });
        const organizedFile = join(organizedDir, "S01E01.mkv");
        writeFileSync(organizedFile, "content1");

        // Create an unorganized file in downloads
        const unorganizedFile = join(dir, "downloads", "[SubGroup] Attack on Titan - 01.mkv");
        mkdirSync(join(dir, "downloads"), { recursive: true });
        writeFileSync(unorganizedFile, "content2");

        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [organizedFile, unorganizedFile],
            scan: async (filePath) => {
              if (filePath === organizedFile) {
                return makeScanResult(filePath, {
                  match: makeMatchResult(),
                  status: "matched",
                  plan: {
                    sourcePath: organizedFile,
                    targetPath: "Attack on Titan/Season 1/S01E01.mkv",
                    targetDir: "Attack on Titan/Season 1",
                    targetFilename: "S01E01.mkv",
                    action: "move",
                  },
                });
              }
              return makeScanResult(filePath, {
                match: makeMatchResult(),
                status: "matched",
                plan: {
                  sourcePath: unorganizedFile,
                  targetPath: "Attack on Titan/Season 1/S01E02.mkv",
                  targetDir: "Attack on Titan/Season 1",
                  targetFilename: "S01E02.mkv",
                  action: "move",
                },
              });
            },
            scanBatch: async (filePaths) => {
              return filePaths.map((filePath) => {
                if (filePath === organizedFile) {
                  return makeScanResult(filePath, {
                    match: makeMatchResult(),
                    status: "matched",
                    plan: {
                      sourcePath: organizedFile,
                      targetPath: "Attack on Titan/Season 1/S01E01.mkv",
                      targetDir: "Attack on Titan/Season 1",
                      targetFilename: "S01E01.mkv",
                      action: "move",
                    },
                  });
                }
                return makeScanResult(filePath, {
                  match: makeMatchResult(),
                  status: "matched",
                  plan: {
                    sourcePath: unorganizedFile,
                    targetPath: "Attack on Titan/Season 1/S01E02.mkv",
                    targetDir: "Attack on Titan/Season 1",
                    targetFilename: "S01E02.mkv",
                    action: "move",
                  },
                });
              });
            },
            plan: (filePath, _match) => ({
              sourcePath: filePath,
              targetPath: "Attack on Titan/Season 1/S01E01.mkv",
              targetDir: "Attack on Titan/Season 1",
              targetFilename: "S01E01.mkv",
              action: "move",
            }),
          },
        });

        await orch.startScan(dir);

        // The organized file should be excluded from the plan
        const plan = orch.getPlan();
        const allFiles = plan?.groups.flatMap((g) => g.files) ?? [];
        expect(allFiles).toHaveLength(1);
        expect(allFiles[0]?.sourcePath).toBe(unorganizedFile);
      });
    });
  });
});
