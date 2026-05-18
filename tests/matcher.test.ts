import { describe, expect, test } from "bun:test";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { Matcher } from "../src/matcher.ts";
import type { ParsedResult } from "../src/parser.ts";

function createMockDb(
  results: {
    animeId: string;
    title: string;
    episodes: Array<{ id: string; season: number; episode: number; title: string }>;
  }[],
): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return results
        .filter((r) => r.title.toLowerCase().includes(title.toLowerCase()))
        .map((r) => ({ id: r.animeId, title: r.title, entryType: "tv" as const }));
    },
    async getEpisodes(animeId: string) {
      const anime = results.find((r) => r.animeId === animeId);
      return (anime?.episodes ?? []).map((e) => ({
        ...e,
        animeId,
        entryType: "tv" as const,
      }));
    },
    async getArtwork() {
      return [];
    },
  };
}

describe("Matcher", () => {
  test("returns match when anime found and episode number matches", async () => {
    const db = createMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "Jujutsu Kaisen",
      season: 1,
      episode: 1,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
    expect(results[0]?.episode?.episode).toBe(1);
    expect(results[0]?.episode?.season).toBe(1);
  });

  test("returns match without episode when parsed has no episode number", async () => {
    const db = createMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "Jujutsu Kaisen 0",
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.title).toBe("Jujutsu Kaisen 0");
    expect(results[0]?.episode).toBeUndefined();
  });

  test("returns empty array when no anime found", async () => {
    const db = createMockDb([]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "Nonexistent Anime",
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toEqual([]);
  });

  test("returns multiple candidates when multiple anime match", async () => {
    const db = createMockDb([
      {
        animeId: "1",
        title: "One Piece",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Romance Dawn" }],
      },
      {
        animeId: "2",
        title: "One Piece: Movie 1",
        episodes: [{ id: "201", season: 1, episode: 1, title: "Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "One Piece",
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.title).toBe("One Piece");
    expect(results[1]?.anime.title).toBe("One Piece: Movie 1");
  });

  test("returns empty array when parsed title is null", async () => {
    const db = createMockDb([{ animeId: "1", title: "Some Anime", episodes: [] }]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: null,
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toEqual([]);
  });
});
