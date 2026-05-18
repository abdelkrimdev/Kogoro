import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createArtworkHandlers } from "../src/cli/artwork-commands.ts";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import type { ArtworkResult } from "../src/db/types.ts";
import { MatchCache } from "../src/match-cache.ts";

function mockFetch(
  data: string,
  status = 200,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": "image/jpeg" },
    });
  };
}

const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

function createMockDb(artworks: ArtworkResult[]): DatabasePlugin {
  return {
    async searchAnime() {
      return [];
    },
    async getEpisodes() {
      return [];
    },
    async getArtwork() {
      return artworks;
    },
  };
}

describe("artwork CLI commands", () => {
  test("process downloads cover and outputs summary", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-artwork-test-"));
    try {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const videoPath = join(animeDir, "ep1.mkv");
      writeFileSync(videoPath, "dummy content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createArtworkHandlers({
        primaryDb: createMockDb([
          { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
        ]),
        cache,
        fetch: mockFetch(testImageBytes),
      });

      let output = "";
      let errorOutput = "";
      await handlers.process(
        dir,
        {},
        (msg) => {
          output = msg;
        },
        (msg) => {
          errorOutput = msg;
        },
      );

      expect(errorOutput).toBe("");
      expect(output).toContain("1 anime processed");
      expect(output).toContain("1 covers downloaded");
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("process with verbose flag includes per-anime log messages", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-artwork-verbose-"));
    try {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const videoPath = join(animeDir, "ep1.mkv");
      writeFileSync(videoPath, "dummy content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createArtworkHandlers({
        primaryDb: createMockDb([
          { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
        ]),
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const logs: string[] = [];
      let summary = "";
      await handlers.process(
        dir,
        { verbose: true },
        (msg) => {
          if (
            msg.startsWith("[download]") ||
            msg.startsWith("[skip]") ||
            msg.startsWith("[no artwork]")
          ) {
            logs.push(msg);
          } else {
            summary = msg;
          }
        },
        () => {},
      );

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toContain("[download]");
      expect(summary).toContain("1 covers downloaded");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("process handles errors gracefully", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-artwork-error-"));
    try {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const videoPath = join(animeDir, "ep1.mkv");
      writeFileSync(videoPath, "dummy content");

      const cache = new MatchCache({ dbPath: join(dir, "cache.db") });
      const hash = await MatchCache.hashFile(videoPath);
      cache.set(hash, {
        animeId: "12345",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 1,
        title: "Test Episode",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const failingDb: DatabasePlugin = {
        async searchAnime() {
          throw new Error("fail");
        },
        async getEpisodes() {
          throw new Error("fail");
        },
        async getArtwork() {
          throw new Error("DB connection failed");
        },
      };

      const handlers = createArtworkHandlers({
        primaryDb: failingDb,
        cache,
      });

      let output = "";
      let errorOutput = "";
      await handlers.process(
        dir,
        {},
        (msg) => {
          output = msg;
        },
        (msg) => {
          errorOutput = msg;
        },
      );

      expect(output).toBe("");
      expect(errorOutput).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
