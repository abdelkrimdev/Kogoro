import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { IMatcher, MatchResult } from "./matcher";
import { OverrideStore } from "./override-store";
import { Renamer } from "./renamer";
import { computeFileHash, getDirectoryTitle, Scanner } from "./scanner";
import { createCache, createMockMatcher, withTempDir, writeTempFile } from "./test-fixtures";

describe("Scanner", () => {
  test("scanFile parses filename and returns auto-resolved match", async () => {
    const scanner = new Scanner({ matcher: createMockMatcher() });
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
    await withTempDir("scan-override", async (dir) => {
      const ambiguousMatcher: IMatcher = {
        async match(parsed) {
          return [
            {
              anime: { id: "1", title: parsed.title ?? "", entryType: "tv" as const },
              episode: {
                id: "101",
                animeId: "1",
                season: 1,
                episode: 1,
                title: "Ep 1",
                entryType: "tv" as const,
              },
              score: 1,
            },
            {
              anime: {
                id: "2",
                title: `${parsed.title ?? ""} Special`,
                entryType: "special" as const,
              },
              episode: {
                id: "201",
                animeId: "2",
                season: 1,
                episode: 1,
                title: "Special",
                entryType: "special" as const,
              },
              score: 0.8,
            },
          ];
        },
        async matchBatch(parsedList) {
          const results: MatchResult[][] = [];
          for (const p of parsedList) {
            results.push(await this.match(p));
          }
          return results.flat();
        },
      };

      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({ matcher: ambiguousMatcher, overrideStore });

      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake content");

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
      });

      expect(result.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("1");
    });
  });

  test("persists override after interactive failed resolution", async () => {
    await withTempDir("scan-failed-override", async (dir) => {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({ matcher: createMockMatcher(), overrideStore });

      const filePath = writeTempFile(dir, "Unknown File.mkv");

      const result = await scanner.scanFile(filePath, {
        onFailed: async () => ({ animeId: "99", episode: 5, entryType: "special" }),
      });

      expect(result.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      const savedOverride = overrideStore.get(overrideHash);
      expect(savedOverride).toBeDefined();
      expect(savedOverride?.animeId).toBe("99");
      expect(savedOverride?.entryType).toBe("special");
    });
  });

  test("override persists choices across scan sessions", async () => {
    await withTempDir("scan-cross-session", async (dir) => {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({ matcher: createMockMatcher(), overrideStore });

      const filePath = writeTempFile(dir, "[Group] Unknown Show - 99.mkv");

      const firstResult = await scanner.scanFile(filePath, {
        onFailed: async () => ({ animeId: "42", episode: 1, entryType: "movie" }),
      });
      expect(firstResult.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      expect(overrideStore.get(overrideHash)?.animeId).toBe("42");

      const secondScanner = new Scanner({ matcher: createMockMatcher(), overrideStore });
      const secondResult = await secondScanner.scanFile(filePath);

      expect(secondResult.status).toBe("matched");
      expect(secondResult.match?.anime.id).toBe("42");
      expect(secondResult.match?.anime.entryType).toBe("movie");
    });
  });

  test("scanFile with cache and dry-run renamer computes hash, matches, caches, and plans rename", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

      const cache = createCache(dir);
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({ matcher: createMockMatcher(), cache, renamer });

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
    });
  });

  test("returns cached result for previously matched file", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");

      const cache = createCache(dir);
      const scanner = new Scanner({ matcher: createMockMatcher(), cache });

      const first = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(first.status).toBe("matched");
      expect(first.cached).toBe(false);
      expect(first.hash).toBeTruthy();
      expect(cache.has(first.hash)).toBe(true);

      const second = await scanner.scanFile(filePath);
      expect(second.status).toBe("cached");
      expect(second.cached).toBe(true);
      expect(second.skipped).toBe(true);
      expect(second.match).not.toBeNull();
    });
  });

  test("rescans a previously-matched file when forced", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");

      const cache = createCache(dir);
      const scanner = new Scanner({ matcher: createMockMatcher(), cache });

      const first = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(cache.has(first.hash)).toBe(true);

      const second = await scanner.scanFile(filePath, {
        force: true,
        onAmbiguous: async (candidates) => candidates[0] ?? null,
        dryRun: true,
      });
      expect(second.status).toBe("matched");
      expect(second.cached).toBe(false);
      expect(second.skipped).toBe(false);
    });
  });

  test("renames file to target path on successful match", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

      const cache = createCache(dir);
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {episode:02}.{ext}",
        directoryTemplate: "{anime}/{type}",
        action: "move",
      });
      const scanner = new Scanner({ matcher: createMockMatcher(), cache, renamer });

      const result = await scanner.scanFile(filePath, {
        onAmbiguous: async (candidates) => candidates[0] ?? null,
      });

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

  test("scanDir discovers media files, parses, and matches", async () => {
    await withTempDir("scanner", async (dir) => {
      writeTempFile(dir, "[SubsPlease] One Piece - 01.mkv", "");
      writeTempFile(dir, "[SubsPlease] One Piece - 02.mkv", "");
      writeTempFile(dir, "readme.txt", "not a media file");

      const scanner = new Scanner({ matcher: createMockMatcher() });
      const results = await scanner.scanDir(dir, [".mkv"]);

      expect(results).toHaveLength(2);
      expect(results[0]?.parsed.title).toBeTruthy();
      expect(results[1]?.parsed.title).toBeTruthy();
    });
  });

  test("scanBatch processes multiple files with concurrency and reports progress", async () => {
    await withTempDir("scanner-batch", async (dir) => {
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");

      const scanner = new Scanner({ matcher: createMockMatcher() });
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
    });
  });

  test("calls matchBatch once for batch scan", async () => {
    const batchCallTitles: string[][] = [];
    const trackingMatcher: IMatcher = {
      async match(parsed) {
        return [
          {
            anime: { id: "1", title: parsed.title ?? "", entryType: "tv" as const },
            episode: {
              id: "101",
              animeId: "1",
              season: parsed.season ?? 1,
              episode: parsed.episode ?? 1,
              title: `Ep ${parsed.episode ?? 1}`,
              entryType: "tv" as const,
            },
            score: 1,
          },
        ];
      },
      async matchBatch(parsedList) {
        batchCallTitles.push(parsedList.map((p) => p.title ?? ""));
        return parsedList.map((p) => ({
          anime: { id: "1", title: p.title ?? "", entryType: "tv" as const },
          episode:
            p.episode !== null
              ? {
                  id: "101",
                  animeId: "1",
                  season: p.season ?? 1,
                  episode: p.episode,
                  title: `Ep ${p.episode}`,
                  entryType: "tv" as const,
                }
              : undefined,
          score: 1,
        }));
      },
    };

    const scanner = new Scanner({ matcher: trackingMatcher });
    const results = await scanner.scanBatch(
      ["[Group] Anime - 01.mkv", "[Group] Anime - 02.mkv", "[Group] Anime - 03.mkv"],
      { concurrency: 3 },
    );

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe("matched");
    }
    expect(batchCallTitles).toHaveLength(1);
    expect(batchCallTitles[0]).toEqual(["Anime", "Anime", "Anime"]);
  });

  test("stops processing remaining files when scanning is cancelled", async () => {
    await withTempDir("scanner-abort", async (dir) => {
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");
      writeTempFile(dir, "[Group] Anime - 04.mkv", "d");

      const scanner = new Scanner({ matcher: createMockMatcher() });
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
          if (p.completed >= 2) abortController.abort();
        },
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.length).toBeLessThan(4);
      for (const r of results) {
        expect(r.status).toBe("matched");
      }
    });
  });

  describe("Directory name fallback", () => {
    test("returns parent directory name as anime title", () => {
      expect(getDirectoryTitle("/anime/Oshi no Ko/file.mkv")).toBe("Oshi no Ko");
      expect(getDirectoryTitle("/downloads/Jujutsu Kaisen/ep.mkv")).toBe("Jujutsu Kaisen");
    });

    test("derives anime name from grandparent directory when nested under a category folder", () => {
      expect(getDirectoryTitle("/anime/Oshi no Ko/TV/file.mkv")).toBe("Oshi no Ko");
      expect(getDirectoryTitle("/shows/JJK/Movies/movie.mkv")).toBe("JJK");
    });

    test("returns null for root-level files", () => {
      expect(getDirectoryTitle("/file.mkv")).toBeNull();
      expect(getDirectoryTitle("file.mkv")).toBeNull();
    });

    test("uses directory name when filename has no parseable title", async () => {
      await withTempDir("dirfallback", async (dir) => {
        const animeDir = join(dir, "Summertime Render");
        mkdirSync(animeDir);
        writeTempFile(animeDir, "[Group].mkv");

        const scanner = new Scanner({ matcher: createMockMatcher() });
        const result = await scanner.scanFile(join(animeDir, "[Group].mkv"));

        expect(result.parsed.title).toBe("Summertime Render");
        expect(result.status).toBe("matched");
        expect(result.match?.anime.title).toBe("Summertime Render");
      });
    });

    test("derives anime name from grandparent when file is inside a category subdirectory", async () => {
      await withTempDir("dirfallback", async (dir) => {
        const tvDir = join(dir, "Jujutsu Kaisen", "TV");
        mkdirSync(tvDir, { recursive: true });
        writeTempFile(tvDir, "[Group].mkv");

        const scanner = new Scanner({ matcher: createMockMatcher() });
        const result = await scanner.scanFile(join(tvDir, "[Group].mkv"));

        expect(result.parsed.title).toBe("Jujutsu Kaisen");
        expect(result.status).toBe("matched");
      });
    });

    test("does not override parsed title with directory name", async () => {
      await withTempDir("dirfallback", async (dir) => {
        const animeDir = join(dir, "Wrong Name");
        mkdirSync(animeDir);
        writeTempFile(animeDir, "[SubsPlease] Correct Name - 01.mkv");

        const scanner = new Scanner({ matcher: createMockMatcher() });
        const result = await scanner.scanFile(join(animeDir, "[SubsPlease] Correct Name - 01.mkv"));

        expect(result.parsed.title).toBe("Correct Name");
      });
    });
  });
});
