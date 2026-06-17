import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  createAmbiguousMatcher,
  createMatchCacheService,
  createMockMatcher,
  createTestHashCache,
  createTrackingMatcher,
  makeNoMatchResult,
  overrideKey,
  withTempDir,
  writeTempFile,
} from "../fixtures";
import type { ProgressEvent, TaskContext } from "../io/progress";
import type { MatcherLike, MatchResult } from "../match/matcher";
import { AMBIGUOUS_MATCH_REASON } from "../match/matcher";
import { OverrideStore } from "../match/override-store";
import { Renamer } from "../rename/renamer";
import { Scanner } from "./scanner";

describe("Scanner", () => {
  test("scanFile with no matcher returns failed status", async () => {
    const scanner = new Scanner({ hashCache: createTestHashCache() });
    const result = await scanner.scanFile("[Group] My Anime - 01.mkv");

    expect(result.file).toBe("[Group] My Anime - 01.mkv");
    expect(result.status).toBe("failed");
    expect(result.failureReason).toBe("No database configured");
    expect(result.match).toBeNull();
    expect(result.plan).toBeNull();
  });

  test("scanBatch with no matcher returns failed for each file", async () => {
    const scanner = new Scanner({ hashCache: createTestHashCache() });
    const results = await scanner.scanBatch([
      "[Group] Anime A - 01.mkv",
      "[Group] Anime B - 02.mkv",
    ]);

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.status).toBe("failed");
      expect(r.failureReason).toBe("No database configured");
    }
  });

  test("scanFile parses filename and returns auto-resolved match", async () => {
    await withTempDir("scan-parse", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content");
      const scanner = new Scanner({
        hashCache: createTestHashCache(),
        matcher: createMockMatcher(),
      });
      const result = await scanner.scanFile(filePath);

      expect(result.file).toBe(filePath);
      expect(result.parsed.title).toBe("My Anime");
      expect(result.parsed.episode).toBe(1);
      expect(result.status).toBe("matched");
      expect(result.match).not.toBeNull();
      expect(result.match?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(result.hash).toBeTruthy();
    });
  });

  test("persists override after interactive ambiguous resolution", async () => {
    await withTempDir("scan-override", async (dir) => {
      const ambiguousMatcher = createAmbiguousMatcher();

      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: ambiguousMatcher,
        overrideStore,
      });

      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake content");

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates, _parsed, _filePath) => candidates[0] ?? null,
      });

      expect(result.status).toBe("matched");

      const overrideHash = overrideKey(filePath);
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("1");
    });
  });

  test("persists override after interactive failed resolution", async () => {
    await withTempDir("scan-failed-override", async (dir) => {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: createMockMatcher([makeNoMatchResult()]),
        overrideStore,
      });

      const filePath = writeTempFile(dir, "Unknown File.mkv");

      const result = await scanner.scanFile(filePath, {
        onFailed: async (_parsed, _filePath) => ({
          animeId: "99",
          episode: 5,
          entryType: "special",
        }),
      });

      expect(result.status).toBe("matched");

      const overrideHash = overrideKey(filePath);
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("99");
      expect(savedOverride?.entryType).toBe("special");
    });
  });

  test("override persists choices across scan sessions", async () => {
    await withTempDir("scan-cross-session", async (dir) => {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: createMockMatcher([makeNoMatchResult()]),
        overrideStore,
      });

      const filePath = writeTempFile(dir, "[Group] Unknown Show - 99.mkv");

      const firstResult = await scanner.scanFile(filePath, {
        onFailed: async (_parsed, _filePath) => ({ animeId: "42", episode: 1, entryType: "movie" }),
      });
      expect(firstResult.status).toBe("matched");

      const overrideHash = overrideKey(filePath);
      expect(overrideStore.get(overrideHash)?.animeId).toBe("42");

      const secondScanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: createMockMatcher([
          {
            anime: { id: "42", titleEn: "(overridden)", entryType: "movie" },
            episode: {
              id: "ep-42",
              animeId: "42",
              season: 1,
              episode: 1,
              titleEn: "Test",
              entryType: "movie",
            },
            score: 1,
          },
        ]),
        overrideStore,
      });
      const secondResult = await secondScanner.scanFile(filePath);

      expect(secondResult.status).toBe("matched");
      expect(secondResult.match?.anime.id).toBe("42");
      expect(secondResult.match?.anime.entryType).toBe("movie");
    });
  });

  test("scanFile with cache and dry-run renamer computes hash, matches, caches, and plans rename", async () => {
    await withTempDir("scan", async (_dir) => {
      const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "fake video content");

      const { cacheService } = createMatchCacheService();
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({
        hashCache: createTestHashCache({ cacheService }),
        matcher: createMockMatcher(),
        renamer,
      });

      const result = await scanner.scanFile(filePath, { dryRun: true });

      expect(result.file).toBe(filePath);
      expect(result.hash).toBeTruthy();
      expect(result.cached).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.status).toBe("matched");
      expect(result.match).not.toBeNull();
      expect(result.match?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(result.plan).not.toBeNull();
      expect(result.plan?.targetFilename).toContain("Jujutsu Kaisen");
      expect(result.plan?.action).toBe("move");
    });
  });

  test("returns cached result for previously matched file", async () => {
    await withTempDir("scan", async (_dir) => {
      const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv");

      const { cacheService } = createMatchCacheService();
      const scanner = new Scanner({
        hashCache: createTestHashCache({ cacheService }),
        matcher: createMockMatcher(),
      });

      const first = await scanner.scanFile(filePath, { dryRun: true });
      expect(first.status).toBe("matched");
      expect(first.cached).toBe(false);
      expect(first.hash).toBeTruthy();
      expect(cacheService.has(first.hash)).toBe(true);

      const second = await scanner.scanFile(filePath);
      expect(second.status).toBe("cached");
      expect(second.cached).toBe(true);
      expect(second.skipped).toBe(true);
      expect(second.match).not.toBeNull();
    });
  });

  test("rescans a previously-matched file when forced", async () => {
    await withTempDir("scan", async (_dir) => {
      const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv");

      const { cacheService } = createMatchCacheService();
      const scanner = new Scanner({
        hashCache: createTestHashCache({ cacheService }),
        matcher: createMockMatcher(),
      });

      const first = await scanner.scanFile(filePath, { dryRun: true });
      expect(cacheService.has(first.hash)).toBe(true);

      const second = await scanner.scanFile(filePath, {
        force: true,
        dryRun: true,
      });
      expect(second.status).toBe("matched");
      expect(second.cached).toBe(false);
      expect(second.skipped).toBe(false);
    });
  });

  test("renames file to target path on successful match", async () => {
    await withTempDir("scan", async (_dir) => {
      const filePath = writeTempFile(_dir, "[Group] My Anime - 01.mkv", "fake video content");

      const { cacheService } = createMatchCacheService();
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({
        hashCache: createTestHashCache({ cacheService }),
        matcher: createMockMatcher(),
        renamer,
      });

      const result = await scanner.scanFile(filePath);

      expect(result.file).toBe(filePath);
      expect(result.status).toBe("matched");
      expect(result.plan).not.toBeNull();

      const baseDir = dirname(filePath);
      const targetPath = result.plan?.targetPath ?? "";
      const absTarget = join(baseDir, targetPath);
      expect(existsSync(absTarget)).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });
  });

  test("uses baseDir option to place renamed file relative to baseDir", async () => {
    await withTempDir("scan", async (dir) => {
      const subDir = join(dir, "subdir");
      mkdirSync(subDir);
      const filePath = writeTempFile(subDir, "[Group] My Anime - 01.mkv", "fake video content");

      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({
        hashCache: createTestHashCache(),
        matcher: createMockMatcher(),
        renamer,
      });

      const result = await scanner.scanFile(filePath, { baseDir: dir });

      expect(result.status).toBe("matched");

      const absTarget = join(dir, "Jujutsu Kaisen/TV/Jujutsu Kaisen - 13.mkv");
      expect(existsSync(absTarget)).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });
  });

  test("batches all files into a single database call", async () => {
    await withTempDir("scan-batch-single", async (dir) => {
      const { matcher: trackingMatcher, batchCallTitles } = createTrackingMatcher();
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");

      const scanner = new Scanner({ hashCache: createTestHashCache(), matcher: trackingMatcher });
      const filePaths = [
        join(dir, "[Group] Anime - 01.mkv"),
        join(dir, "[Group] Anime - 02.mkv"),
        join(dir, "[Group] Anime - 03.mkv"),
      ];

      const results = await scanner.scanBatch(filePaths, { concurrency: 3 });

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.status).toBe("matched");
      }
      expect(batchCallTitles).toHaveLength(1);
      expect(batchCallTitles[0]).toEqual(["Anime", "Anime", "Anime"]);
    });
  });

  test("reports progress for each file in batch", async () => {
    await withTempDir("scanner-ctx-progress", async (dir) => {
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");

      const scanner = new Scanner({
        hashCache: createTestHashCache(),
        matcher: createMockMatcher(),
      });
      const filePaths = [
        join(dir, "[Group] Anime - 01.mkv"),
        join(dir, "[Group] Anime - 02.mkv"),
        join(dir, "[Group] Anime - 03.mkv"),
      ];

      const events: ProgressEvent[] = [];
      const ctx: TaskContext = {
        progress: (p) => events.push(p),
        log() {},
        error() {},
      };

      const results = await scanner.scanBatch(filePaths, { ctx, concurrency: 2 });

      expect(results).toHaveLength(3);
      expect(events).toHaveLength(3);
      expect(events[0]?.completed).toBe(1);
      expect(events[0]?.total).toBe(3);
      expect(events[2]?.completed).toBe(3);
      expect(events[2]?.total).toBe(3);
    });
  });

  test("stops when aborted mid-batch", async () => {
    await withTempDir("scanner-ctx-abort", async (dir) => {
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");
      writeTempFile(dir, "[Group] Anime - 04.mkv", "d");

      const scanner = new Scanner({
        hashCache: createTestHashCache(),
        matcher: createMockMatcher(),
      });
      const filePaths = [
        join(dir, "[Group] Anime - 01.mkv"),
        join(dir, "[Group] Anime - 02.mkv"),
        join(dir, "[Group] Anime - 03.mkv"),
        join(dir, "[Group] Anime - 04.mkv"),
      ];

      const abortController = new AbortController();
      const ctx: TaskContext = {
        progress: (p) => {
          if (p.completed >= 2) abortController.abort();
        },
        log() {},
        error() {},
        abortSignal: abortController.signal,
      };

      const results = await scanner.scanBatch(filePaths, { ctx, concurrency: 2 });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeLessThan(4);
    });
  });

  test("scanBatch persists override after ambiguous batch match resolution", async () => {
    await withTempDir("scan-batch-ambiguous-override", async (dir) => {
      writeTempFile(dir, "[Group] My Anime - 01.mkv", "a");

      const overrideStore = new OverrideStore(dir);
      const ambiguousMatcher = createAmbiguousMatcher();
      const batchMatcher: MatcherLike = {
        async match(parsed) {
          return ambiguousMatcher.match(parsed);
        },
        async matchBatch(parsedList) {
          const results: MatchResult[] = [];
          for (const p of parsedList) {
            const matches = await ambiguousMatcher.match(p);
            const first = matches[0];
            if (matches.length > 1 && first) {
              results.push({
                anime: first.anime,
                episode: first.episode,
                score: first.score,
                failureReason: AMBIGUOUS_MATCH_REASON,
              });
            } else {
              results.push(first ?? makeNoMatchResult());
            }
          }
          return results;
        },
      };

      const scanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: batchMatcher,
        overrideStore,
      });

      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      const results = await scanner.scanBatch([filePath], {
        concurrency: 1,
        onFailed: async () => ({ animeId: "1", episode: 1, entryType: "tv" }),
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");

      const overrideHash = overrideKey(filePath);
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("1");
    });
  });

  test("scanBatch persists override after onFailed resolution", async () => {
    await withTempDir("scan-batch-failed-override", async (dir) => {
      writeTempFile(dir, "Unknown File.mkv", "a");

      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        hashCache: createTestHashCache({ overrideStore }),
        matcher: createMockMatcher([makeNoMatchResult()]),
        overrideStore,
      });

      const filePath = join(dir, "Unknown File.mkv");
      const results = await scanner.scanBatch([filePath], {
        concurrency: 1,
        onFailed: async () => ({ animeId: "99", episode: 5, entryType: "special" }),
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");

      const overrideHash = overrideKey(filePath);
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("99");
    });
  });
});
