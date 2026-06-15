import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  ConfigManager,
  DatabasePlugin,
  MatcherLike,
  ReviewPlan,
  ScanEvent,
  ScanReviewReadyEvent,
} from "@kogoro/core";
import {
  createAmbiguousMatcher,
  createLibraryRepository,
  createMatchCacheService,
  createMockDb,
  hashFile,
  LibraryService,
  Matcher,
  makeMatchResult,
  makeParsedResult,
  OverrideStore,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  ScanStateService,
  TEMPLATE_PRESETS,
  walk,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";
import { createScanHandlers } from "./scan";

function createOrchestratorWithRealScan(
  dir: string,
  matcherOrDb?: MatcherLike | ReturnType<typeof createMockDb>,
) {
  let matcher: MatcherLike;
  if (
    matcherOrDb &&
    "match" in matcherOrDb &&
    typeof matcherOrDb.match === "function" &&
    "matchBatch" in matcherOrDb
  ) {
    matcher = matcherOrDb as MatcherLike;
  } else {
    matcher = new Matcher({
      database: (matcherOrDb as ReturnType<typeof createMockDb>) ?? createMockDb(),
    });
  }

  const overrideStore = new OverrideStore(dir);
  const renamer = new Renamer({
    filenameTemplate: `${TEMPLATE_PRESETS.standard}.{ext}`,
    directoryTemplate: SCHEMA_DEFAULTS.template.directory,
  });

  const scanner = new Scanner({ matcher, renamer, overrideStore });

  return new ScanOrchestrator({
    pipeline: {
      walk: async (path: string) => walk(path, SCHEMA_DEFAULTS["media-extensions"]),
      scan: async (filePath: string, options?: { dryRun?: boolean }) =>
        scanner.scanFile(filePath, { dryRun: options?.dryRun ?? true }),
      rename: async (plan, baseDir) => {
        const result = renamer.execute(plan, baseDir);
        return { success: result.success, error: result.error };
      },
      plan: () => null,
    },
  });
}

function createFailingDbPlugin(): DatabasePlugin {
  return createMockDb({
    searchAnime: () => [],
    getEpisodes: () => [],
  });
}

describe("ScanOrchestrator", () => {
  test("walk discovers media files and scanner matches them", async () => {
    await withTempDir("scan-walk-match", async (dir) => {
      const dbPlugin = createMockDb({
        searchAnime: (title: string) => {
          if (title === "My Anime") {
            return [{ id: "1", titleEn: "My Anime", entryType: "tv" }];
          }
          return [];
        },
        getEpisodes: (animeId: string) => {
          if (animeId === "1") {
            return [
              { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
            ];
          }
          return [];
        },
      });

      writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

      const orch = createOrchestratorWithRealScan(dir, dbPlugin);

      const events: ScanEvent[] = [];
      orch.on("*", (e) => events.push(e));

      await orch.startScan(dir);

      expect(orch.getState()).toBe("review");

      const progressEvents = events.filter((e) => e.type === "scanProgress");
      expect(progressEvents.length).toBe(1);
      expect(progressEvents[0]).toMatchObject({
        status: "matched",
        matched: true,
      });

      const reviewEvents = events.filter((e) => e.type === "scanReviewReady");
      expect(reviewEvents.length).toBe(1);
      const plan = (reviewEvents[0] as ScanReviewReadyEvent).plan;
      expect(plan.groups.length).toBe(1);
      expect(plan.groups[0]?.animeTitle).toBe("My Anime");
      expect(plan.groups[0]?.files.length).toBe(1);
    });
  });

  test("scanner returns failed status when no match found", async () => {
    await withTempDir("scan-failed", async (dir) => {
      const dbPlugin = createFailingDbPlugin();

      writeTempFile(dir, "[Group] Unknown Show - 01.mkv", "fake video content");

      const orch = createOrchestratorWithRealScan(dir, dbPlugin);

      const events: ScanEvent[] = [];
      orch.on("*", (e) => events.push(e));

      await orch.startScan(dir);

      expect(orch.getState()).toBe("review");

      const progressEvents = events.filter((e) => e.type === "scanProgress");
      expect(progressEvents.length).toBe(1);
      expect(progressEvents[0]).toMatchObject({
        status: "failed",
        matched: false,
      });
    });
  });

  test("scanner returns ambiguous status for multiple candidates", async () => {
    await withTempDir("scan-ambiguous", async (dir) => {
      const ambiguousMatcher = createAmbiguousMatcher();

      writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

      const orch = createOrchestratorWithRealScan(dir, ambiguousMatcher);

      const events: ScanEvent[] = [];
      orch.on("*", (e) => events.push(e));

      await orch.startScan(dir);

      expect(orch.getState()).toBe("review");

      const progressEvents = events.filter((e) => e.type === "scanProgress");
      expect(progressEvents.length).toBe(1);
      expect(progressEvents[0]).toMatchObject({
        status: "ambiguous",
        matched: false,
      });
    });
  });

  test("walk discovers multiple media files in nested directories", async () => {
    await withTempDir("scan-nested", async (dir) => {
      const dbPlugin = createMockDb({
        searchAnime: (title: string) => {
          if (title === "Anime A") {
            return [{ id: "1", titleEn: "Anime A", entryType: "tv" }];
          }
          if (title === "Anime B") {
            return [{ id: "2", titleEn: "Anime B", entryType: "tv" }];
          }
          return [];
        },
        getEpisodes: (animeId: string) => {
          return [
            {
              id: `${animeId}01`,
              animeId,
              season: 1,
              episode: 1,
              titleEn: "Ep 1",
              entryType: "tv",
            },
          ];
        },
      });

      const subdir = join(dir, "subdir");
      mkdirSync(subdir, { recursive: true });
      writeTempFile(dir, "[Group] Anime A - 01.mkv", "fake video content A");
      writeTempFile(subdir, "[Group] Anime B - 01.mkv", "fake video content B");

      const orch = createOrchestratorWithRealScan(dir, dbPlugin);

      const events: ScanEvent[] = [];
      orch.on("*", (e) => events.push(e));

      await orch.startScan(dir);

      expect(orch.getState()).toBe("review");

      const progressEvents = events.filter((e) => e.type === "scanProgress");
      expect(progressEvents.length).toBe(2);

      const reviewEvents = events.filter((e) => e.type === "scanReviewReady");
      expect(reviewEvents.length).toBe(1);
      const plan = (reviewEvents[0] as ScanReviewReadyEvent).plan;
      expect(plan.groups.length).toBe(2);
    });
  });

  test("renames files to proposed paths", async () => {
    await withTempDir("scan-execute-rename", async (dir) => {
      const dbPlugin = createMockDb({
        searchAnime: (title: string) => {
          if (title === "My Anime") {
            return [{ id: "1", titleEn: "My Anime", entryType: "tv" }];
          }
          return [];
        },
        getEpisodes: (animeId: string) => {
          if (animeId === "1") {
            return [
              { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
            ];
          }
          return [];
        },
      });

      const sourcePath = join(dir, "[Group] My Anime - 01.mkv");
      writeTempFile(dir, "[Group] My Anime - 01.mkv", "unique video content for rename test");

      const orch = createOrchestratorWithRealScan(dir, dbPlugin);

      await orch.startScan(dir);

      const plan = orch.getPlan();
      expect(plan).not.toBeNull();
      expect(plan?.groups[0]?.files[0]?.proposedPath).toBeDefined();

      await orch.approvePlan();

      expect(orch.getState()).toBe("done");

      const targetPath = join(dir, "My Anime", "TV", "My Anime - 1x01 - Ep 1.mkv");
      expect(existsSync(targetPath)).toBe(true);
      expect(existsSync(sourcePath)).toBe(false);
    });
  });

  describe("library rebuild after approval", () => {
    test("rebuilds library from matched scan results", async () => {
      await withTempDir("scan-rebuild", async (dir) => {
        const dbPlugin = createMockDb({
          searchAnime: (title: string) => {
            if (title === "My Anime") {
              return [{ id: "1", titleEn: "My Anime", entryType: "tv" }];
            }
            return [];
          },
          getEpisodes: (animeId: string) => {
            if (animeId === "1") {
              return [
                {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              ];
            }
            return [];
          },
        });

        writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

        const orch = createOrchestratorWithRealScan(dir, dbPlugin);
        await orch.startScan(dir);
        await orch.approvePlan();

        const matches = orch.getMatchResults();
        expect(matches.length).toBeGreaterThan(0);

        const { repo: libraryRepo, close } = createLibraryRepository(dir);
        const libraryService = new LibraryService(libraryRepo);
        libraryService.rebuildFromMatches(matches);

        const animeList = libraryRepo.listAnime();
        expect(animeList).toHaveLength(1);
        expect(animeList[0]?.title).toBe("My Anime");
        expect(animeList[0]?.entryType).toBe("tv");

        const episodes = libraryRepo.getEpisodesByAnimeId(animeList[0]?.id ?? 0);
        expect(episodes).toHaveLength(1);
        expect(episodes[0]?.episodeNumber).toBe(1);

        close();
      });
    });

    test("excludes ambiguous files from rebuild", async () => {
      await withTempDir("scan-rebuild-ambiguous", async (dir) => {
        writeTempFile(dir, "[Group] Ambiguous Show - 01.mkv", "fake video");

        const orch = createOrchestratorWithRealScan(dir, createAmbiguousMatcher());
        await orch.startScan(dir);
        await orch.approvePlan();

        const matches = orch.getMatchResults();
        expect(matches).toHaveLength(0);
      });
    });

    test("respects approved/rejected groups in rebuild", async () => {
      await withTempDir("scan-rebuild-approve", async (dir) => {
        const dbPlugin = createMockDb({
          searchAnime: (title: string) => {
            if (title === "Anime A") {
              return [{ id: "a", titleEn: "Anime A", entryType: "tv" }];
            }
            if (title === "Anime B") {
              return [{ id: "b", titleEn: "Anime B", entryType: "tv" }];
            }
            return [];
          },
          getEpisodes: (animeId: string) => {
            return [
              {
                id: `${animeId}-ep1`,
                animeId,
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            ];
          },
        });

        writeTempFile(dir, "[Group] Anime A - 01.mkv", "video A");
        writeTempFile(dir, "[Group] Anime B - 01.mkv", "video B");

        const orch = createOrchestratorWithRealScan(dir, dbPlugin);
        await orch.startScan(dir);

        orch.approveGroup("a");
        orch.rejectGroup("b");

        await orch.approvePlan();

        const matches = orch.getMatchResults();
        expect(matches).toHaveLength(1);
        expect(matches[0]?.animeId).toBe("a");
      });
    });
  });
  describe("merge on scan complete", () => {
    test("getMatchResults returns results even when review plan is empty", async () => {
      await withTempDir("orch-empty-plan", async (dir) => {
        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [join(dir, "ep1.mkv")],
            scan: async () => ({
              file: join(dir, "ep1.mkv"),
              hash: "hash-ep1",
              parsed: makeParsedResult("Jujutsu Kaisen", 1, 1),
              match: makeMatchResult({
                anime: { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
              }),
              plan: {
                sourcePath: join(dir, "ep1.mkv"),
                targetPath: "ep1.mkv",
                targetDir: ".",
                targetFilename: "ep1.mkv",
                action: "move",
              },
              cached: false,
              skipped: false,
              status: "matched",
            }),
            plan: () => null,
          },
        });
        await orch.startScan(dir);

        const plan = orch.getPlan();
        expect(plan?.groups).toHaveLength(0);

        const matches = orch.getMatchResults();
        expect(matches).toHaveLength(1);
        expect(matches[0]?.animeId).toBe("1");
      });
    });

    test("returns empty when no files are matched", async () => {
      await withTempDir("orch-no-match", async (dir) => {
        const orch = new ScanOrchestrator({
          pipeline: {
            walk: async () => [join(dir, "ep1.mkv")],
            scan: async () => ({
              file: join(dir, "ep1.mkv"),
              hash: "hash-ep1",
              parsed: makeParsedResult(null),
              match: null,
              plan: null,
              cached: false,
              skipped: false,
              status: "failed",
            }),
            plan: () => null,
          },
        });
        await orch.startScan(dir);

        const matches = orch.getMatchResults();
        expect(matches).toHaveLength(0);
      });
    });
  });

  describe("CacheService wiring", () => {
    test("scan handlers accept and pass CacheService to orchestrator", async () => {
      await withTempDir("scan-cache-wire", async (dir) => {
        const { matchRepo, scanStateRepo, cacheService, close } = createMatchCacheService(dir);
        const scanStateService = new ScanStateService(scanStateRepo);

        // Seed a stale entry that should be purged on scan
        scanStateRepo.set("/deleted/old.mkv", 100, 1000, "staleHash");
        matchRepo.set("staleHash", {
          animeId: "99",
          entryType: "tv",
          episodeId: null,
          season: null,
          episode: null,
          title: null,
          sourceDb: "tvdb",
          timestamp: "2026-01-01T00:00:00.000Z",
        });

        const dbPlugin = createMockDb({
          searchAnime: (title: string) => {
            if (title === "My Anime") {
              return [{ id: "1", titleEn: "My Anime", entryType: "tv" }];
            }
            return [];
          },
          getEpisodes: (animeId: string) => {
            if (animeId === "1") {
              return [
                {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              ];
            }
            return [];
          },
        });

        writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

        const { repo: libraryRepo } = createLibraryRepository(dir);
        const libraryService = new LibraryService(libraryRepo);

        const handlers = createScanHandlers({
          pluginFactory: {
            primaryDatabase: async () => dbPlugin,
            subtitle: async () => undefined,
          } as unknown as PluginFactory,
          configManager: {
            getTemplate: () => TEMPLATE_PRESETS.standard,
            get: (key: string) => {
              if (key === "template.directory") return SCHEMA_DEFAULTS.template.directory;
              if (key === "primary-db") return "tvdb";
              if (key === "exclude-patterns") return SCHEMA_DEFAULTS["exclude-patterns"];
              return undefined;
            },
            getList: (key: string) => {
              if (key === "exclude-patterns") return SCHEMA_DEFAULTS["exclude-patterns"];
              return [];
            },
            resolveMediaExtensions: () => SCHEMA_DEFAULTS["media-extensions"],
          } as unknown as ConfigManager,
          cacheService,
          libraryService,
          scanStateService,
          mergeMatches: () => {},
          send: {
            scanProgress: () => {},
            scanPhaseComplete: () => {},
            scanReviewReady: () => {},
            scanExecutionProgress: () => {},
            scanComplete: () => {},
          },
        });

        await handlers.scanStart({ path: dir });
        // Wait briefly for the async scan to complete
        await new Promise((r) => setTimeout(r, 100));

        // Stale entry should be purged via CacheService
        expect(scanStateRepo.get("/deleted/old.mkv")).toBeNull();
        expect(matchRepo.has("staleHash")).toBe(false);

        close();
      });
    });

    test("resolveMatch caches the resolved match with computed hash", async () => {
      await withTempDir("resolve-cache", async (dir) => {
        const { matchRepo, scanStateRepo, cacheService, close } = createMatchCacheService(dir);
        const scanStateService = new ScanStateService(scanStateRepo);

        const dbPlugin = createMockDb({
          searchAnime: (title: string) => {
            if (title === "My Anim") {
              return [
                { id: "1", titleEn: "My Anime", entryType: "tv" },
                { id: "2", titleEn: "My Anima", entryType: "tv" },
              ];
            }
            return [];
          },
          getEpisodes: (animeId: string) => {
            if (animeId === "1" || animeId === "2") {
              return [
                {
                  id: `${animeId}-ep1`,
                  animeId,
                  season: 1,
                  episode: 1,
                  titleEn: "Ep 1",
                  entryType: "tv",
                },
              ];
            }
            return [];
          },
        });

        const filePath = join(dir, "[Group] My Anim - 01.mkv");
        writeTempFile(dir, "[Group] My Anim - 01.mkv", "fake video content");

        const { repo: libraryRepo } = createLibraryRepository(dir);
        const libraryService = new LibraryService(libraryRepo);

        const captured: { plan?: ReviewPlan } = {};

        const handlers = createScanHandlers({
          pluginFactory: {
            primaryDatabase: async () => dbPlugin,
            subtitle: async () => undefined,
          } as unknown as PluginFactory,
          configManager: {
            getTemplate: () => TEMPLATE_PRESETS.standard,
            get: (key: string) => {
              if (key === "template.directory") return SCHEMA_DEFAULTS.template.directory;
              if (key === "primary-db") return "tvdb";
              if (key === "exclude-patterns") return SCHEMA_DEFAULTS["exclude-patterns"];
              return undefined;
            },
            getList: (key: string) => {
              if (key === "exclude-patterns") return SCHEMA_DEFAULTS["exclude-patterns"];
              return [];
            },
            resolveMediaExtensions: () => SCHEMA_DEFAULTS["media-extensions"],
          } as unknown as ConfigManager,
          cacheService,
          libraryService,
          scanStateService,
          mergeMatches: () => {},
          send: {
            scanProgress: () => {},
            scanPhaseComplete: () => {},
            scanReviewReady: (data) => {
              captured.plan = data.plan;
            },
            scanExecutionProgress: () => {},
            scanComplete: () => {},
          },
        });

        const { sessionId } = await handlers.scanStart({ path: dir });
        await new Promise((r) => setTimeout(r, 100));

        expect(captured.plan).toBeDefined();
        if (!captured.plan) throw new Error("Test invariant: plan is undefined");
        const fileId = captured.plan.groups[0]?.files[0]?.fileId;
        expect(fileId).toBeDefined();
        if (!fileId) throw new Error("Test invariant: fileId is undefined");

        const expectedHash = await hashFile(filePath);
        const hashBefore = matchRepo.get(expectedHash);
        expect(hashBefore).toBeNull();

        const resolveResult = await handlers.getResolveCandidates({ sessionId, fileId });
        expect(resolveResult.candidates.length).toBeGreaterThan(0);

        const candidate = resolveResult.candidates[0];
        expect(candidate).toBeDefined();
        if (!candidate) throw new Error("Test invariant: candidate is undefined");

        await handlers.resolveMatch({
          sessionId,
          fileId,
          animeId: candidate.animeId,
          episodeId: candidate.episodeId,
        });

        const cached = matchRepo.get(expectedHash);
        expect(cached).not.toBeNull();
        expect(cached?.animeId).toBe(candidate.animeId);

        close();
      });
    });
  });
});
