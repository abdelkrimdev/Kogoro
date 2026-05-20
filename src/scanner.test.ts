import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { MatchCache } from "./match-cache";
import { OverrideStore } from "./override-store";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { AnimeResult, EpisodeResult } from "./plugins/database/types";
import { Renamer } from "./renamer";
import { computeFileHash, getDirectoryTitle, Scanner } from "./scanner";

async function withTempDir(label: string, fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), `kogoro-test-${label}-`));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeTempFile(dir: string, name: string, content = "content"): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

const STD_EPISODES: EpisodeResult[] = [
  { id: "101", animeId: "1", season: 1, episode: 1, title: "Ep 1", entryType: "tv" as const },
  { id: "102", animeId: "1", season: 1, episode: 2, title: "Ep 2", entryType: "tv" as const },
  { id: "103", animeId: "1", season: 1, episode: 3, title: "Ep 3", entryType: "tv" as const },
];

interface MockDbOptions {
  searchResults?: (title: string) => AnimeResult[];
  episodes?: (animeId: string) => EpisodeResult[];
  trackCalls?: { search?: number[]; episodes?: number[] };
}

function createMockDb(opts: MockDbOptions = {}): DatabasePlugin {
  const counters = opts.trackCalls;
  const defaultSearch = (title: string) => {
    if (title === "Unknown File" || title === "Unknown Show") return [];
    return [{ id: "1", title, entryType: "tv" as const }];
  };

  return {
    async searchAnime(title: string) {
      counters?.search?.push(1);
      return (opts.searchResults ?? defaultSearch)(title);
    },
    async getEpisodes(animeId: string) {
      counters?.episodes?.push(1);
      return (opts.episodes ?? (() => STD_EPISODES))(animeId);
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

function createThrowingDb(): DatabasePlugin {
  return {
    async searchAnime() {
      throw new Error("Should not be called");
    },
    async getEpisodes() {
      throw new Error("Should not be called");
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

describe("Scanner", () => {
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
    await withTempDir("scan-override", async (dir) => {
      const ambiguousDb = createMockDb({
        searchResults: (title) => [
          { id: "1", title, entryType: "tv" as const },
          { id: "2", title: `${title} Special`, entryType: "special" as const },
        ],
        episodes: (animeId) =>
          animeId === "1"
            ? [
                {
                  id: "101",
                  animeId: "1",
                  season: 1,
                  episode: 1,
                  title: "Ep 1",
                  entryType: "tv" as const,
                },
              ]
            : [
                {
                  id: "201",
                  animeId: "2",
                  season: 1,
                  episode: 1,
                  title: "Special",
                  entryType: "special" as const,
                },
              ],
      });

      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({ database: ambiguousDb, overrideStore });

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

  test("persists override after interactive failed resolution (manual entry)", async () => {
    await withTempDir("scan-failed-override", async (dir) => {
      const overrideStore = new OverrideStore(dir);
      const scanner = new Scanner({ database: createMockDb(), overrideStore });

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
      const scanner = new Scanner({ database: createMockDb(), overrideStore });

      const filePath = writeTempFile(dir, "[Group] Unknown Show - 99.mkv");

      const firstResult = await scanner.scanFile(filePath, {
        onFailed: async () => ({ animeId: "42", episode: 1, entryType: "movie" }),
      });
      expect(firstResult.status).toBe("matched");

      const overrideHash = computeFileHash(basename(filePath));
      expect(overrideStore.get(overrideHash)?.animeId).toBe("42");

      const secondScanner = new Scanner({ database: createThrowingDb(), overrideStore });
      const secondResult = await secondScanner.scanFile(filePath);

      expect(secondResult.status).toBe("matched");
      expect(secondResult.match?.anime.id).toBe("42");
      expect(secondResult.match?.anime.entryType).toBe("movie");
    });
  });

  test("scanFile with cache and renamer (dry-run) computes hash, matches, caches, and plans rename", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake video content");

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
    });
  });

  test("returns cached result for previously matched file", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const scanner = new Scanner({ database: createMockDb(), cache });

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

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const scanner = new Scanner({ database: createMockDb(), cache });

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

      const scanner = new Scanner({ database: createMockDb() });
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
    });
  });

  test("groups files by anime title to reduce database lookups", async () => {
    const searchCalls: number[] = [];
    const episodeCalls: number[] = [];

    const trackingDb = createMockDb({
      trackCalls: { search: searchCalls, episodes: episodeCalls },
    });

    const scanner = new Scanner({ database: trackingDb });
    const results = await scanner.scanBatch(
      ["[Group] Anime - 01.mkv", "[Group] Anime - 02.mkv", "[Group] Anime - 03.mkv"],
      { concurrency: 3 },
    );

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe("matched");
    }
    expect(searchCalls.length).toBe(1);
    expect(episodeCalls.length).toBe(1);
  });

  test("stops processing remaining files when scanning is cancelled", async () => {
    await withTempDir("scanner-abort", async (dir) => {
      writeTempFile(dir, "[Group] Anime - 01.mkv", "a");
      writeTempFile(dir, "[Group] Anime - 02.mkv", "b");
      writeTempFile(dir, "[Group] Anime - 03.mkv", "c");
      writeTempFile(dir, "[Group] Anime - 04.mkv", "d");

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

        const scanner = new Scanner({ database: createMockDb() });
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

        const scanner = new Scanner({ database: createMockDb() });
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

        const scanner = new Scanner({ database: createMockDb() });
        const result = await scanner.scanFile(join(animeDir, "[SubsPlease] Correct Name - 01.mkv"));

        expect(result.parsed.title).toBe("Correct Name");
      });
    });
  });
});
