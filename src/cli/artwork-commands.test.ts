import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createArtworkHandlers } from "../cli/artwork-commands";
import {
  createArtworkDb,
  createLogCapture,
  makeThrowingDb,
  mockFetch,
  seedCacheEntry,
  testImageBytes,
  withTempDir,
} from "../test-fixtures";

describe("artwork CLI commands", () => {
  test("process downloads cover and outputs summary", async () => {
    await withTempDir("artwork", async (dir) => {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const { cache } = await seedCacheEntry(animeDir, "ep1.mkv", {
        animeId: "12345",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Test Episode",
      });

      const handlers = createArtworkHandlers({
        primaryDb: createArtworkDb([
          { id: "1", type: "poster", url: "https://example.com/poster.jpg" },
        ]),
        cache,
        fetch: mockFetch(testImageBytes),
      });

      const log = createLogCapture();
      await handlers.process(dir, {}, log.onLog, log.onError);

      expect(log.errorOutput).toBe("");
      expect(log.output).toContain("1 anime processed");
      expect(log.output).toContain("1 covers downloaded");
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    });
  });

  test("process with verbose flag includes per-anime log messages", async () => {
    await withTempDir("artwork", async (dir) => {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const { cache } = await seedCacheEntry(animeDir, "ep1.mkv", {
        animeId: "12345",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Test Episode",
      });

      const handlers = createArtworkHandlers({
        primaryDb: createArtworkDb([
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
    });
  });

  test("process reports no artwork on DB failure", async () => {
    await withTempDir("artwork", async (dir) => {
      const animeDir = join(dir, "TV", "Jujutsu Kaisen");
      mkdirSync(animeDir, { recursive: true });
      const { cache } = await seedCacheEntry(animeDir, "ep1.mkv", {
        animeId: "12345",
        episodeId: "101",
        season: 1,
        episode: 1,
        title: "Test Episode",
      });

      const failingDb = makeThrowingDb();

      const handlers = createArtworkHandlers({
        primaryDb: failingDb,
        cache,
      });

      const log = createLogCapture();
      await handlers.process(dir, {}, log.onLog, log.onError);

      expect(log.output).toContain("no artwork found");
      expect(log.errorOutput).toBe("");
    });
  });
});
