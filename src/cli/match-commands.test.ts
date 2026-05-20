import { describe, expect, test } from "bun:test";
import { createMatchHandlers } from "../cli/match-commands";
import type { DatabasePlugin } from "../plugins/database/plugin";

function createMockDb(): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      if (title.toLowerCase().includes("jujutsu")) {
        return [{ id: "12345", title: "Jujutsu Kaisen", entryType: "tv" as const }];
      }
      return [];
    },
    async getEpisodes(_animeId: string) {
      return [
        {
          id: "1001",
          animeId: "12345",
          season: 1,
          episode: 1,
          title: "Ryomen Sukuna",
          airDate: "2020-10-03",
          entryType: "tv" as const,
        },
      ];
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

describe("match CLI commands", () => {
  test("match parses filename and returns JSON with candidates", async () => {
    const handlers = createMatchHandlers({ database: createMockDb() });
    let output = "";
    await handlers.match(
      "[Subs] Jujutsu Kaisen - 01.mkv",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.anime.title).toBe("Jujutsu Kaisen");
    expect(typeof parsed[0]?.score).toBe("number");
  });

  test("match returns empty anime results for garbage filename", async () => {
    const handlers = createMatchHandlers({ database: createMockDb() });
    let output = "";
    await handlers.match(
      "asdfxyz.mkv",
      (msg) => {
        output = msg;
      },
      () => {},
    );
    const parsed = JSON.parse(output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.failureReason).toBe("No title parsed");
  });
});
