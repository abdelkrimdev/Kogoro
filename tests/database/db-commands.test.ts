import { describe, expect, test } from "bun:test";
import { createDbHandlers } from "../../src/cli/db-commands.ts";
import type { DatabasePlugin } from "../../src/database/types.ts";

class MockAdapter implements DatabasePlugin {
  async searchAnime(title: string) {
    return [{ id: "1", title }];
  }

  async getEpisodes(_animeId: string) {
    return [
      {
        id: "1",
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Episode 1",
        entryType: "TV" as const,
      },
    ];
  }

  async getArtwork() {
    return [];
  }
}

describe("db CLI commands", () => {
  test("search returns formatted JSON output", async () => {
    const handlers = createDbHandlers({ adapter: new MockAdapter() });
    const output = await handlers.search("Jujutsu Kaisen");
    expect(output).toContain("Jujutsu Kaisen");
    expect(output).toContain('"id": "1"');
  });

  test("episodes returns formatted JSON output", async () => {
    const handlers = createDbHandlers({ adapter: new MockAdapter() });
    const output = await handlers.episodes("123");
    expect(output).toContain("Episode 1");
    expect(output).toContain("TV");
  });
});
