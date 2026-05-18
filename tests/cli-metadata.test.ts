import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMetadataHandlers } from "../src/cli/metadata-commands.ts";
import { MatchCache } from "../src/match-cache.ts";

function setupTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-meta-"));
  return join(dir, "cache.db");
}

function cleanupTempDb(dbPath: string) {
  const dir = join(dbPath, "..");
  rmSync(dir, { recursive: true, force: true });
}

function setupTempDir(): string {
  return mkdtempSync(join(tmpdir(), "kogoro-cli-meta-dir-"));
}

function cleanupTempDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
}

describe("metadata CLI commands", () => {
  test("write generates NFO and returns summary JSON", async () => {
    const dir = setupTempDir();
    const dbPath = setupTempDb();
    try {
      const videoPath = join(dir, "Test.mkv");
      writeFileSync(videoPath, "test content");

      const hash = await MatchCache.hashFile(videoPath);
      const cache = new MatchCache({ dbPath });
      cache.set(hash, {
        animeId: "1",
        episodeId: "10",
        entryType: "tv",
        season: 1,
        episode: 2,
        title: "Test Ep",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createMetadataHandlers({ dbPath });
      let logOutput = "";
      await handlers.write(
        dir,
        false,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed.total).toBe(1);
      expect(parsed.written).toBe(1);
    } finally {
      cleanupTempDb(dbPath);
      cleanupTempDir(dir);
    }
  });

  test("write with force overwrites existing NFO", async () => {
    const dir = setupTempDir();
    const dbPath = setupTempDb();
    try {
      const videoPath = join(dir, "Force.mkv");
      const nfoPath = join(dir, "Force.nfo");
      writeFileSync(videoPath, "content");
      writeFileSync(nfoPath, "old");

      const hash = await MatchCache.hashFile(videoPath);
      const cache = new MatchCache({ dbPath });
      cache.set(hash, {
        animeId: "1",
        episodeId: "10",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "New",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createMetadataHandlers({ dbPath });
      let logOutput = "";
      await handlers.write(
        dir,
        true,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed.written).toBe(1);
      expect(parsed.skipped).toBe(0);
    } finally {
      cleanupTempDb(dbPath);
      cleanupTempDir(dir);
    }
  });
});
