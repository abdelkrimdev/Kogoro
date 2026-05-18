import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { MatchCache } from "../src/match-cache.ts";
import { Renamer } from "../src/renamer.ts";
import { Scanner } from "../src/scanner.ts";

function createMockDb(): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return [{ id: "1", title, entryType: "tv" as const }];
    },
    async getEpisodes(_animeId: string) {
      return [
        { id: "101", animeId: "1", season: 1, episode: 1, title: "Ep 1", entryType: "tv" as const },
      ];
    },
    async getArtwork() {
      return [];
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
});
