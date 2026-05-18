import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScanHandlers, discoverFiles, isAlreadyOrganized } from "../src/cli/scan-commands.ts";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { MatchCache } from "../src/match-cache.ts";

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

describe("scan CLI commands", () => {
  test("scan directory with -y returns JSON with matched files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "[Group] Test Anime - 01.mkv");
      writeFileSync(filePath, "");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(dir, { yes: true });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.file).toBe(filePath);
      expect(parsed[0]?.status).toBe("matched");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan single file with -y returns matched status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "[Group] My Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(filePath, { yes: true });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.parsed.title).toBe("My Anime");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan with dry-run flag plans rename but does not move file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "My Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan).not.toBeNull();
      // File should still exist at original location (dry run)
      expect(existsSync(filePath)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan with cache: second scan returns cached status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "[Group] Anime - 01.mkv");
      writeFileSync(filePath, "same content");
      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });

      const handlers = createScanHandlers({ database: createMockDb(), cache });
      // First scan — resolves match
      const firstOutput = await handlers.scan(filePath, { yes: true, dryRun: true });
      const first = JSON.parse(firstOutput);
      expect(first[0]?.status).toBe("matched");

      // Second scan — should be cached
      const secondOutput = await handlers.scan(filePath, { yes: true, dryRun: true });
      const second = JSON.parse(secondOutput);
      expect(second[0]?.status).toBe("cached");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan with --force ignores cache and re-matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "[Group] Anime - 01.mkv");
      writeFileSync(filePath, "content");
      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });

      const handlers = createScanHandlers({ database: createMockDb(), cache });
      // First scan
      await handlers.scan(filePath, { yes: true, dryRun: true });
      // Force scan — ignores cache
      const output = await handlers.scan(filePath, { yes: true, dryRun: true, force: true });
      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan with --action copy copies the file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "My Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(filePath, { yes: true, action: "copy" });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan?.action).toBe("copy");
      // Original file should still exist after copy
      expect(existsSync(filePath)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan with ambiguous mock DB returns ambiguous status in -y mode", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      const filePath = join(dir, "Some Anime - 01.mkv");
      writeFileSync(filePath, "content");

      const ambiguousDb: DatabasePlugin = {
        async searchAnime(_title: string) {
          return [
            { id: "1", title: "Anime One", entryType: "tv" as const },
            { id: "2", title: "Anime Two", entryType: "tv" as const },
          ];
        },
        async getEpisodes(animeId: string) {
          return [
            { id: "101", animeId, season: 1, episode: 1, title: `Ep 1`, entryType: "tv" as const },
            { id: "102", animeId, season: 1, episode: 1, title: `Ep 1`, entryType: "tv" as const },
          ];
        },
        async getArtwork() {
          return [];
        },
      };

      const handlers = createScanHandlers({ database: ambiguousDb });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("ambiguous");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("scan directory with mixed outcomes returns correct statuses", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-mixed-"));
    try {
      writeFileSync(join(dir, "[Group] One Piece - 01.mkv"), "");
      writeFileSync(join(dir, "[Group] One Piece - 02.mkv"), "");
      writeFileSync(join(dir, "Some Anime - 01.mkv"), "");
      writeFileSync(join(dir, "randomfile.mkv"), "");

      const mixedDb: DatabasePlugin = {
        async searchAnime(title: string) {
          if (title.toLowerCase().includes("some")) {
            return [
              { id: "1", title: "Anime One", entryType: "tv" as const },
              { id: "2", title: "Anime Two", entryType: "tv" as const },
            ];
          }
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
          ];
        },
        async getArtwork() {
          return [];
        },
      };

      const handlers = createScanHandlers({ database: mixedDb });
      const output = await handlers.scan(dir, { yes: true, dryRun: true });
      const results = JSON.parse(output) as Array<{ status: string }>;

      expect(results).toHaveLength(4);
      const matched = results.filter((r) => r.status === "matched");
      const ambiguous = results.filter((r) => r.status === "ambiguous");
      const failed = results.filter((r) => r.status === "failed");
      expect(matched).toHaveLength(2);
      expect(ambiguous).toHaveLength(1);
      expect(failed).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("discoverFiles filters excluded patterns and skips symlinks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-discover-"));
    try {
      writeFileSync(join(dir, "Anime - 01.mkv"), "");
      writeFileSync(join(dir, "Anime - 02.mkv"), "");
      writeFileSync(join(dir, "Anime - 03.part"), "");
      writeFileSync(join(dir, "readme.txt"), "");
      symlinkSync(join(dir, "Anime - 01.mkv"), join(dir, "link.mkv"));

      const files = discoverFiles(dir, [".mkv"], [".part"]);

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith(".mkv"))).toBe(true);
      expect(files.some((f) => f.endsWith(".part"))).toBe(false);
      expect(files.some((f) => f.endsWith("link.mkv"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("isAlreadyOrganized detects files in organized directory structure", () => {
    expect(isAlreadyOrganized("/media/Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/One Piece/Movies/One Piece - Movie 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/Naruto/OVA/Naruto - OVA 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/Attack on Titan/Specials/AOT - 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/unorganized/[Group] Anime - 01.mkv")).toBe(false);
    expect(isAlreadyOrganized("/media/Anime/TV")).toBe(false);
  });

  test("scan skips already-organized files without hashing or DB lookup", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-organized-skip-"));
    try {
      const tvDir = join(dir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      writeFileSync(join(tvDir, "Jujutsu Kaisen - 1x01.mkv"), "content");
      writeFileSync(join(dir, "[Group] Unorganized - 01.mkv"), "content");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(dir, { yes: true, dryRun: true });
      const results = JSON.parse(output) as Array<{ status: string; file: string }>;

      const organized = results.find((r) => r.file.includes("TV/"));
      const unorganized = results.find((r) => r.file.includes("Unorganized"));

      expect(organized?.status).toBe("skipped");
      expect(unorganized?.status).toBe("matched");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
