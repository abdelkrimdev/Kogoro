import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabasePlugin, MatcherLike, ScanEvent, ScanReviewReadyEvent } from "@kogoro/core";
import {
  createAmbiguousMatcher,
  createCache,
  createMockDb,
  Matcher,
  OverrideStore,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  TEMPLATE_PRESETS,
  walk,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";

function createOrchestratorWithRealScan(
  dir: string,
  matcherOrDb?: MatcherLike | ReturnType<typeof createMockDb>,
) {
  let matcher: MatcherLike;
  if (
    matcherOrDb &&
    "match" in matcherOrDb &&
    typeof matcherOrDb.match === "function" &&
    "getEpisodes" in matcherOrDb
  ) {
    matcher = matcherOrDb as MatcherLike;
  } else {
    matcher = new Matcher({
      database: (matcherOrDb as ReturnType<typeof createMockDb>) ?? createMockDb(),
    });
  }

  const cache = createCache(dir);
  const overrideStore = new OverrideStore(dir);
  const renamer = new Renamer({
    filenameTemplate: `${TEMPLATE_PRESETS.standard}.{ext}`,
    directoryTemplate: SCHEMA_DEFAULTS.template.directory,
  });

  const scanner = new Scanner({ matcher, cache, renamer, overrideStore });

  return new ScanOrchestrator({
    scanner: { match: async () => [], matchBatch: async () => [] },
    walk: async (path: string) => walk(path, SCHEMA_DEFAULTS["media-extensions"]),
    scanFile: async (filePath: string, options?: { dryRun?: boolean }) =>
      scanner.scanFile(filePath, { dryRun: options?.dryRun ?? true }),
    executeRename: async (plan, baseDir) => {
      const result = renamer.execute(plan, baseDir);
      return { success: result.success, error: result.error };
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
});
