import { afterEach, describe, expect, mock, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  createArtworkDb,
  createMockClackPrompts,
  createMockHttpClient,
  makeThrowingDb,
  mockFetch,
  seedCacheEntry,
  testImageBytes,
  withTempDir,
} from "@kogoro/core";
import { createArtworkHandlers } from "./handlers";

const { mock: clackMock, captures } = createMockClackPrompts();
mock.module("@clack/prompts", () => clackMock);

describe("artwork CLI commands", () => {
  afterEach(() => {
    captures.reset();
  });

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
        httpClient: createMockHttpClient(mockFetch(testImageBytes)),
      });

      await handlers.process(dir, {});

      const allOutput = captures.logMessage.join("\n");
      expect(allOutput).toContain("1 anime processed");
      expect(allOutput).toContain("1 covers downloaded");
      expect(existsSync(join(animeDir, "cover.jpg"))).toBe(true);
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

      await handlers.process(dir, {});

      const allOutput = captures.logMessage.join("\n");
      expect(allOutput).toContain("no artwork found");
    });
  });
});
