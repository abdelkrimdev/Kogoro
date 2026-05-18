import { describe, expect, test } from "bun:test";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { Matcher } from "../src/matcher.ts";
import type { ParsedResult } from "../src/parser.ts";

interface MockAnime {
  animeId: string;
  title: string;
  entryType?: "tv" | "movie" | "ova" | "special";
  episodes: Array<{ id: string; season: number; episode: number; title: string }>;
}

function createMockDb(results: MockAnime[]): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return results
        .filter((r) => r.title.toLowerCase().includes(title.toLowerCase()))
        .map((r) => ({ id: r.animeId, title: r.title, entryType: r.entryType ?? "tv" }));
    },
    async getEpisodes(animeId: string) {
      const anime = results.find((r) => r.animeId === animeId);
      return (anime?.episodes ?? []).map((e) => ({
        ...e,
        animeId,
        entryType: anime?.entryType ?? "tv",
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
    expect(typeof results[0]?.score).toBe("number");
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

  test("returns failure reason when no anime found", async () => {
    const db = createMockDb([]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "Nonexistent Anime",
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.failureReason).toBe("No anime found");
    expect(results[0]?.score).toBe(0);
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

  test("returns movie candidate when no episode number parsed", async () => {
    const db = createMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        entryType: "movie",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Jujutsu Kaisen 0 Movie" }],
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
    expect(results[0]?.anime.entryType).toBe("movie");
    expect(results[0]?.episode).toBeUndefined();
  });

  test("sorts results by score descending", async () => {
    const db = createMockDb([
      {
        animeId: "2",
        title: "Solo Leveling: Special",
        episodes: [{ id: "201", season: 1, episode: 1, title: "Special" }],
      },
      {
        animeId: "1",
        title: "Solo Leveling",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Episode 1" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: "Solo Leveling",
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.title).toBe("Solo Leveling");
    const scoreA = results[0]?.score ?? 0;
    const scoreB = results[1]?.score ?? 0;
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  test("applies whichever DatabasePlugin is injected (config-driven selection)", async () => {
    const tvDb = createMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen",
        episodes: [{ id: "101", season: 1, episode: 1, title: "TVDB Ep" }],
      },
    ]);
    const movieDb: DatabasePlugin = {
      async searchAnime() {
        return [{ id: "99", title: "Jujutsu Kaisen", entryType: "movie" as const }];
      },
      async getEpisodes() {
        return [
          {
            id: "901",
            animeId: "99",
            season: 1,
            episode: 1,
            title: "MovieDB Ep",
            entryType: "movie" as const,
          },
        ];
      },
      async getArtwork() {
        return [];
      },
    };

    const tvMatcher = new Matcher({ database: tvDb });
    const movieMatcher = new Matcher({ database: movieDb });
    const parsed: ParsedResult = {
      title: "Jujutsu Kaisen",
      season: 1,
      episode: 1,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };

    const tvResult = await tvMatcher.match(parsed);
    const movieResult = await movieMatcher.match(parsed);

    expect(tvResult[0]?.anime.entryType).toBe("tv");
    expect(tvResult[0]?.episode?.title).toBe("TVDB Ep");
    expect(movieResult[0]?.anime.entryType).toBe("movie");
    expect(movieResult[0]?.episode?.title).toBe("MovieDB Ep");
  });

  test("returns failure reason when parsed title is null", async () => {
    const db = createMockDb([{ animeId: "1", title: "Some Anime", episodes: [] }]);

    const matcher = new Matcher({ database: db });
    const parsed: ParsedResult = {
      title: null,
      season: null,
      episode: null,
      tags: { group: null, resolution: null, source: null, codec: null, audio: null },
    };
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.failureReason).toBe("No title parsed");
    expect(results[0]?.score).toBe(0);
  });
});
