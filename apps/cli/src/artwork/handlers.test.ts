import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createArtworkDb,
  createMockHttpClient,
  mockFetch,
  seedCacheEntry,
  testImageBytes,
  withTempDir,
} from "@kogoro/core";
import { createLogger, type Logger } from "../logger";
import { createArtworkHandlers } from "./handlers";

describe("artwork CLI commands", () => {
  const logLines: string[] = [];
  const errorLines: string[] = [];

  function makeLogger(level: "info" | "error" = "info"): Logger {
    return createLogger(level, (msg) => {
      if (msg.startsWith("[kogoro]")) {
        logLines.push(msg);
      } else {
        errorLines.push(msg);
      }
    });
  }

  afterEach(() => {
    logLines.length = 0;
    errorLines.length = 0;
  });

  test("downloads cover and returns summary", async () => {
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
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      const result = await handlers.process(dir, {}, makeLogger());

      expect(result.total).toBe(1);
      expect(result.downloaded).toBe(1);
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    });
  });

  test("returns noArtwork when DB has no covers", async () => {
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
        primaryDb: createArtworkDb([]),
        cache,
      });

      const result = await handlers.process(dir, {}, makeLogger());

      expect(result.total).toBe(1);
      expect(result.noArtwork).toBe(1);
      expect(result.downloaded).toBe(0);
    });
  });
});
