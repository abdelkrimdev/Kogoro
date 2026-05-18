import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScanHandlers } from "../src/cli/scan-commands.ts";
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
      // In -y mode, ambiguous should return matched (auto picks first)
      // Actually, Scanner returns 'ambiguous' when no onAmbiguous callback and multiple matches
      expect(parsed[0]?.status).toBe("ambiguous");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
