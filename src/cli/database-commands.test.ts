import { describe, expect, test } from "bun:test";
import { createDatabaseCommands } from "../cli/database-commands";
import type { DatabasePlugin } from "../plugins/database/plugin";
import type { AnimeResult, EpisodeResult } from "../plugins/database/types";
import { createMockDb as _createMockDb, makeThrowingDb } from "../test-helpers";

function createMockPlugin(): DatabasePlugin {
  return _createMockDb({
    searchAnime: (title: string): AnimeResult[] => {
      if (title === "Jujutsu Kaisen") {
        return [
          {
            id: "12345",
            title: "Jujutsu Kaisen",
            originalTitle: "呪術廻戦",
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
            title: "Ryomen Sukuna",
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
  test("db search outputs anime results as JSON", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseCommands(plugin);
    let output = "";
    await commands.search(
      "Jujutsu Kaisen",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("Jujutsu Kaisen");
  });

  test("db search outputs empty array for no results", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseCommands(plugin);
    let output = "";
    await commands.search(
      "Unknown",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    expect(JSON.parse(output)).toEqual([]);
  });

  test("db episodes outputs episode results as JSON", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseCommands(plugin);
    let output = "";
    await commands.episodes(
      "12345",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.title).toBe("Ryomen Sukuna");
  });

  test("db episodes outputs empty array for unknown ID", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseCommands(plugin);
    let output = "";
    await commands.episodes(
      "99999",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    expect(JSON.parse(output)).toEqual([]);
  });

  test("db search handles plugin error gracefully", async () => {
    const failingPlugin = makeThrowingDb();
    const commands = createDatabaseCommands(failingPlugin);
    let errorOutput = "";
    await commands.search(
      "Anything",
      () => {},
      (msg) => {
        errorOutput = msg;
      },
    );
    expect(errorOutput).toBe("Search failed");
  });
});
