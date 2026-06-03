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
import { makeMockLogger } from "../fixtures";
import { createArtworkHandlers } from "./handlers";

describe("artwork CLI commands", () => {
  const mock = makeMockLogger();

  afterEach(() => {
    mock.infoLines.length = 0;
    mock.errorLines.length = 0;
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

      const result = await handlers.process(dir, {}, mock.logger);

      expect(result.total).toBe(1);
      expect(result.downloaded).toBe(1);
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
    });
  });

  test("returns nothing when database has no artwork", async () => {
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

      const result = await handlers.process(dir, {}, mock.logger);

      expect(result.total).toBe(1);
      expect(result.noArtwork).toBe(1);
      expect(result.downloaded).toBe(0);
    });
  });
});
