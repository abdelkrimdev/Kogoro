import { describe, expect, test } from "bun:test";
import type { DatabasePlugin } from "../../plugins/database/plugin";
import type { AnimeResult, EpisodeResult } from "../../plugins/database/types";
import {
  createMockDb as _createMockDb,
  createLogCapture,
  makeThrowingDb,
} from "../../test-fixtures";
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
  test("db search outputs anime results as JSON", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const log = createLogCapture();
    await commands.search("Jujutsu Kaisen", log.onLog, () => {});
    const parsed = JSON.parse(log.output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.titleEn).toBe("Jujutsu Kaisen");
  });

  test("db search outputs empty array for no results", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const log = createLogCapture();
    await commands.search("Unknown", log.onLog, () => {});
    expect(JSON.parse(log.output)).toEqual([]);
  });

  test("db episodes outputs episode results as JSON", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const log = createLogCapture();
    await commands.episodes("12345", log.onLog, () => {});
    const parsed = JSON.parse(log.output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.titleEn).toBe("Ryomen Sukuna");
  });

  test("db episodes outputs empty array for unknown ID", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const log = createLogCapture();
    await commands.episodes("99999", log.onLog, () => {});
    expect(JSON.parse(log.output)).toEqual([]);
  });

  test("db search handles plugin error gracefully", async () => {
    const failingPlugin = makeThrowingDb();
    const commands = createDatabaseHandlers(failingPlugin);
    const log = createLogCapture();
    await commands.search("Anything", () => {}, log.onError);
    expect(log.errorOutput).toBe("Search failed");
  });
});
