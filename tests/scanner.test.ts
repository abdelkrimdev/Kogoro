import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { MatchCache } from "../src/match-cache.ts";
import { OverrideStore } from "../src/override-store.ts";
import { Renamer } from "../src/renamer.ts";
import { computeFileHash, Scanner } from "../src/scanner.ts";

describe("Scanner", () => {
  function createMockDb(): DatabasePlugin {
    return {
      async searchAnime(title: string) {
        return [{ id: "1", title, entryType: "tv" as const }];
      },
      async getEpisodes(_animeId: string) {
        return [
          {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            title: "Ep 1",
            entryType: "tv" as const,
          },
          {
            id: "102",
            animeId: "1",
            season: 1,
            episode: 2,
            title: "Ep 2",
            entryType: "tv" as const,
          },
          {
            id: "103",
            animeId: "1",
            season: 1,
            episode: 3,
            title: "Ep 3",
            entryType: "tv" as const,
          },
        ];
      },
      async getArtwork() {
        return [];
      },
    };
  }
  test("scanFile parses filename and returns auto-resolved match", async () => {
    const scanner = new Scanner({ database: createMockDb() });
    const result = await scanner.scanFile("[Group] My Anime - 01.mkv");

    expect(result.file).toBe("[Group] My Anime - 01.mkv");
    expect(result.parsed.title).toBe("My Anime");
    expect(result.parsed.episode).toBe(1);
    expect(result.status).toBe("matched");
    expect(result.match).not.toBeNull();
    expect(result.match?.anime.title).toBe("My Anime");
    expect(result.hash).toBe("");
  });

  test("persists override after interactive ambiguous resolution", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-override-"));
    try {
      const ambiguousDb: DatabasePlugin = {
        async searchAnime(title: string) {
          return [
            { id: "1", title, entryType: "tv" as const },
            { id: "2", title: `${title} Special`, entryType: "special" as const },
          ];
        },
        async getEpisodes(animeId: string) {
          if (animeId === "1") {
            return [
              {
                id: "101",
                animeId: "1",
                season: 1,
                episode: 1,
                title: "Ep 1",
                entryType: "tv" as const,
              },
            ];
          }
          return [
            {
              id: "201",
              animeId: "2",
              season: 1,
              episode: 1,
              title: "Special",
              entryType: "special" as const,
            },
          ];
        },
        async getArtwork() {
          return [];
        },
      };

      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        database: ambiguousDb,
        overrideStore,
      });

      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "fake content");

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
      });

      expect(result.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("persists override after interactive failed resolution (manual entry)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-failed-override-"));
    try {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        database: createMockDb(),
        overrideStore,
      });

      const filePath = join(dir, "Unknown File.mkv");
      writeFileSync(filePath, "fake");

      const result = await scanner.scanFile(filePath, {
        onFailed: async () => ({ animeId: "99", episode: 5, entryType: "special" }),
      });

      expect(result.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("99");
      expect(savedOverride?.entryType).toBe("special");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("override persists choices across scan sessions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-cross-session-"));
    try {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({
        database: createMockDb(),
        overrideStore,
      });

      // First scan: override saved via onFailed for a file the parser cannot match
      const filePath = join(dir, "[Group] Unknown Show - 99.mkv");
      writeFileSync(filePath, "content");

      const firstResult = await scanner.scanFile(filePath, {
        onFailed: async () => ({ animeId: "42", episode: 1, entryType: "movie" }),
      });
      expect(firstResult.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      expect(overrideStore.get(overrideHash)?.animeId).toBe("42");

      // Second scan: should use override (no DB query needed)
      const secondDb: DatabasePlugin = {
        async searchAnime() {
          throw new Error("Should not be called");
        },
        async getEpisodes() {
          throw new Error("Should not be called");
        },
        async getArtwork() {
          return [];
        },
      };

      const secondScanner = new Scanner({ database: secondDb, overrideStore });
      const secondResult = await secondScanner.scanFile(filePath);

      expect(secondResult.status).toBe("matched");
      expect(secondResult.match?.anime.id).toBe("42");
      expect(secondResult.match?.anime.entryType).toBe("movie");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scanFile with cache and renamer (dry-run) computes hash, matches, caches, and plans rename", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-test-"));
    try {
      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "fake video content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({ database: createMockDb(), cache, renamer });

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });

      expect(result.file).toBe(filePath);
      expect(result.hash).toBeTruthy();
      expect(result.cached).toBe(false);
      expect(result.skipped).toBe(false);
      expect(result.status).toBe("matched");
      expect(result.match).not.toBeNull();
      expect(result.match?.anime.title).toBe("My Anime");
      expect(result.plan).not.toBeNull();
      expect(result.plan?.targetFilename).toContain("My Anime");
      expect(result.plan?.action).toBe("move");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("cache hit: second scan skips matcher and returns cached status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-test-"));
    try {
      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const scanner = new Scanner({ database: createMockDb(), cache });

      // First scan
      const first = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(first.status).toBe("matched");
      expect(first.cached).toBe(false);
      expect(first.hash).toBeTruthy();
      expect(cache.has(first.hash)).toBe(true);

      // Second scan — cache hit
      const second = await scanner.scanFile(filePath);
      expect(second.status).toBe("cached");
      expect(second.cached).toBe(true);
      expect(second.skipped).toBe(true);
      expect(second.match).not.toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--force flag ignores cache and re-matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-test-"));
    try {
      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const scanner = new Scanner({ database: createMockDb(), cache });

      // First scan
      const first = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(cache.has(first.hash)).toBe(true);

      // Second scan with force — ignores cache
      const second = await scanner.scanFile(filePath, {
        force: true,
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(second.status).toBe("matched");
      expect(second.cached).toBe(false);
      expect(second.skipped).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scanFile with cache and renamer executes rename", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scan-test-"));
    try {
      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "fake video content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({ database: createMockDb(), cache, renamer });

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
      });

      expect(result.file).toBe(filePath);
      expect(result.status).toBe("matched");
      expect(result.plan).not.toBeNull();

      // File should have been moved to target
      const baseDir = dirname(filePath);
      const targetPath = result.plan?.targetPath ?? "";
      const absTarget = join(baseDir, targetPath);
      expect(existsSync(absTarget)).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scanDir discovers media files, parses, and matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scanner-test-"));
    try {
      writeFileSync(join(dir, "[SubsPlease] One Piece - 01.mkv"), "");
      writeFileSync(join(dir, "[SubsPlease] One Piece - 02.mkv"), "");
      writeFileSync(join(dir, "readme.txt"), "not a media file");

      const scanner = new Scanner({ database: createMockDb() });
      const results = await scanner.scanDir(dir, [".mkv"]);

      expect(results).toHaveLength(2);
      expect(results[0]?.parsed.title).toBeTruthy();
      expect(results[1]?.parsed.title).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scanBatch processes multiple files with concurrency and reports progress", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scanner-batch-"));
    try {
      writeFileSync(join(dir, "[Group] Anime - 01.mkv"), "a");
      writeFileSync(join(dir, "[Group] Anime - 02.mkv"), "b");
      writeFileSync(join(dir, "[Group] Anime - 03.mkv"), "c");

      const scanner = new Scanner({ database: createMockDb() });
      const filePaths = [
        join(dir, "[Group] Anime - 01.mkv"),
        join(dir, "[Group] Anime - 02.mkv"),
        join(dir, "[Group] Anime - 03.mkv"),
      ];

      const progressReports: Array<{
        completed: number;
        total: number;
        file: string;
        status: string;
      }> = [];
      const results = await scanner.scanBatch(filePaths, {
        concurrency: 2,
        onProgress: (p) => progressReports.push(p),
      });

      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(r.status).toBe("matched");
      }
      expect(progressReports).toHaveLength(3);
      expect(progressReports[0]?.total).toBe(3);
      expect(progressReports[2]?.completed).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scanBatch aborts mid-way with abortSignal and returns partial results", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scanner-abort-"));
    try {
      writeFileSync(join(dir, "[Group] Anime - 01.mkv"), "a");
      writeFileSync(join(dir, "[Group] Anime - 02.mkv"), "b");
      writeFileSync(join(dir, "[Group] Anime - 03.mkv"), "c");
      writeFileSync(join(dir, "[Group] Anime - 04.mkv"), "d");

      const scanner = new Scanner({ database: createMockDb() });
      const filePaths = [
        join(dir, "[Group] Anime - 01.mkv"),
        join(dir, "[Group] Anime - 02.mkv"),
        join(dir, "[Group] Anime - 03.mkv"),
        join(dir, "[Group] Anime - 04.mkv"),
      ];

      const abortController = new AbortController();
      const results = await scanner.scanBatch(filePaths, {
        concurrency: 2,
        abortSignal: abortController.signal,
        onProgress: (p) => {
          if (p.completed >= 2) {
            abortController.abort();
          }
        },
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeLessThan(4);
      for (const r of results) {
        expect(r.status).toBe("matched");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
