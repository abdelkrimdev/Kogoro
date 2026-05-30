import { describe, expect, test } from "bun:test";
import { createMockDb as _createMockDb, makeThrowingDb } from "@kogoro/core";
import type { AnimeResult, DatabasePlugin, EpisodeResult } from "@kogoro/plugins";
import { createDatabaseHandlers } from "./handlers";

function createMockPlugin(): DatabasePlugin {
  return _createMockDb({
    searchAnime: (title: string): AnimeResult[] => {
      if (title === "Jujutsu Kaisen") {
        return [
          {
            id: "12345",
            titleEn: "Jujutsu Kaisen",
            titleJa: "呪術廻戦",
            overview: "A boy fights curses.",
            year: 2020,
            entryType: "tv",
          },
        ];
      }
      return [];
    },
    getEpisodes: (animeId: string): EpisodeResult[] => {
      if (animeId === "12345") {
        return [
          {
            id: "1001",
            animeId: "12345",
            season: 1,
            episode: 1,
            titleEn: "Ryomen Sukuna",
            airDate: "2020-10-03",
            entryType: "tv",
          },
        ];
      }
      return [];
    },
  });
}

describe("DB CLI commands", () => {
  test("db search returns anime results directly", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.search("Jujutsu Kaisen");
    expect(results).toHaveLength(1);
    expect(results[0]?.titleEn).toBe("Jujutsu Kaisen");
  });

  test("db search returns empty array for no results", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.search("Unknown");
    expect(results).toEqual([]);
  });

  test("db episodes returns episode results directly", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.episodes("12345");
    expect(results).toHaveLength(1);
    expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
  });

  test("db episodes returns empty array for unknown ID", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.episodes("99999");
    expect(results).toEqual([]);
  });

  test("db search propagates errors to caller", async () => {
    const failingPlugin = makeThrowingDb();
    const commands = createDatabaseHandlers(failingPlugin);
    await expect(commands.search("Anything")).rejects.toThrow("Should not be called");
  });
});
