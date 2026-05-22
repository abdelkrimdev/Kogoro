import { describe, expect, test } from "bun:test";
import type { DatabasePlugin } from "../../plugins/database/plugin";
import { createMockDb as _createMockDb, createLogCapture } from "../../test-fixtures";
import { createMatchHandlers } from "./handlers";

function createMockDb(): DatabasePlugin {
  return _createMockDb({
    searchAnime: (title: string) => {
      if (title.toLowerCase().includes("jujutsu")) {
        return [{ id: "12345", title: "Jujutsu Kaisen", entryType: "tv" as const }];
      }
      return [];
    },
    getEpisodes: (_animeId: string) => [
      {
        id: "1001",
        animeId: "12345",
        season: 1,
        episode: 1,
        title: "Ryomen Sukuna",
        airDate: "2020-10-03",
        entryType: "tv" as const,
      },
    ],
  });
}

describe("match CLI commands", () => {
  test("match parses filename and returns JSON with candidates", async () => {
    const handlers = createMatchHandlers({ database: createMockDb() });
    const log = createLogCapture();
    await handlers.match("[Subs] Jujutsu Kaisen - 01.mkv", log.onLog, () => {});
    const parsed = JSON.parse(log.output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.anime.title).toBe("Jujutsu Kaisen");
    expect(typeof parsed[0]?.score).toBe("number");
  });

  test("match returns empty anime results for garbage filename", async () => {
    const handlers = createMatchHandlers({ database: createMockDb() });
    const log = createLogCapture();
    await handlers.match("asdfxyz.mkv", log.onLog, () => {});
    const parsed = JSON.parse(log.output);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.failureReason).toBe("No title parsed");
  });
});
