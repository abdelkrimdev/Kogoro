import { describe, expect, test } from "bun:test";
import { createDBCommands } from "../src/cli/db-commands.ts";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import type { AnimeResult, ArtworkResult, EpisodeResult } from "../src/db/types.ts";

function createMockAdapter(): DatabasePlugin {
  return {
    async searchAnime(title: string): Promise<AnimeResult[]> {
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
    async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
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
    async getArtwork(): Promise<ArtworkResult[]> {
      return [];
    },
    async getAnime(): Promise<AnimeResult | null> {
      return null;
    },
  };
}

describe("DB CLI commands", () => {
  test("db search outputs anime results as JSON", async () => {
    const adapter = createMockAdapter();
    const commands = createDBCommands(adapter);
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
    const adapter = createMockAdapter();
    const commands = createDBCommands(adapter);
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
    const adapter = createMockAdapter();
    const commands = createDBCommands(adapter);
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
    const adapter = createMockAdapter();
    const commands = createDBCommands(adapter);
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

  test("db search handles adapter error gracefully", async () => {
    const failingAdapter: DatabasePlugin = {
      async searchAnime(): Promise<AnimeResult[]> {
        throw new Error("API Error");
      },
      async getEpisodes(): Promise<EpisodeResult[]> {
        throw new Error("API Error");
      },
      async getArtwork(): Promise<ArtworkResult[]> {
        throw new Error("API Error");
      },
      async getAnime(): Promise<AnimeResult | null> {
        throw new Error("API Error");
      },
    };
    const commands = createDBCommands(failingAdapter);
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
