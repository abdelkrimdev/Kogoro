import { describe, expect, test } from "bun:test";
import { Matcher } from "./matcher";
import { OverrideStore } from "./override-store";
import type { ParsedResult } from "./parser";
import type { DatabasePlugin } from "./plugins/database/plugin";
import { withTempDir } from "./test-helpers";

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
    async getAnime() {
      return null;
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
      async getAnime() {
        return null;
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

  describe("matchBatch", () => {
    test("deduplicates searchAnime calls for duplicate titles and getEpisodes for duplicate anime IDs", async () => {
      let searchCallCount = 0;
      let episodesCallCount = 0;
      const searchTitles: string[] = [];
      const episodesIds: string[] = [];

      const trackingDb: DatabasePlugin = {
        async searchAnime(title: string) {
          searchCallCount++;
          searchTitles.push(title);
          if (title === "Jujutsu Kaisen") {
            return [{ id: "1", title: "Jujutsu Kaisen", entryType: "tv" }];
          }
          return [{ id: "2", title: "One Piece", entryType: "tv" }];
        },
        async getEpisodes(animeId: string) {
          episodesCallCount++;
          episodesIds.push(animeId);
          if (animeId === "1") {
            return [
              { id: "101", animeId: "1", season: 1, episode: 1, title: "Ep 1", entryType: "tv" },
              { id: "102", animeId: "1", season: 1, episode: 2, title: "Ep 2", entryType: "tv" },
            ];
          }
          return [
            {
              id: "201",
              animeId: "2",
              season: 1,
              episode: 1,
              title: "One Piece Ep 1",
              entryType: "tv",
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

      const matcher = new Matcher({ database: trackingDb });

      const parsedList: ParsedResult[] = [
        {
          title: "Jujutsu Kaisen",
          season: 1,
          episode: 1,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        },
        {
          title: "Jujutsu Kaisen",
          season: 1,
          episode: 2,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        },
        {
          title: "One Piece",
          season: 1,
          episode: 1,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        },
      ];

      const results = await matcher.matchBatch(parsedList);

      expect(results).toHaveLength(3);
      expect(searchCallCount).toBe(2); // once per unique title
      expect(searchTitles).toEqual(["Jujutsu Kaisen", "One Piece"]);
      expect(episodesCallCount).toBe(2); // once per unique anime ID
      expect(episodesIds).toEqual(["1", "2"]);

      // First two results should be Jujutsu Kaisen episodes
      expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
      expect(results[0]?.episode?.episode).toBe(1);
      expect(results[1]?.anime.title).toBe("Jujutsu Kaisen");
      expect(results[1]?.episode?.episode).toBe(2);

      // Third result should be One Piece
      expect(results[2]?.anime.title).toBe("One Piece");
      expect(results[2]?.episode?.episode).toBe(1);
    });

    test("handles empty input", async () => {
      const db = createMockDb([{ animeId: "1", title: "Test", episodes: [] }]);

      const matcher = new Matcher({ database: db });
      const results = await matcher.matchBatch([]);
      expect(results).toEqual([]);
    });

    test("handles titles with no episode number gracefully", async () => {
      let searchCallCount = 0;

      const trackingDb: DatabasePlugin = {
        async searchAnime(title: string) {
          searchCallCount++;
          return [{ id: "1", title, entryType: "movie" }];
        },
        async getEpisodes() {
          return [];
        },
        async getArtwork() {
          return [];
        },
        async getAnime() {
          return null;
        },
      };

      const matcher = new Matcher({ database: trackingDb });
      const parsedList: ParsedResult[] = [
        {
          title: "Movie Title",
          season: null,
          episode: null,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        },
      ];

      const results = await matcher.matchBatch(parsedList);
      expect(results).toHaveLength(1);
      expect(results[0]?.anime.title).toBe("Movie Title");
      expect(results[0]?.episode).toBeUndefined();
      expect(searchCallCount).toBe(1);
    });
  });

  describe("with OverrideStore", () => {
    test("returns override match when override exists for file hash", async () => {
      await withTempDir("matcher-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        overrideStore.set("abc123", {
          animeId: "tvdb-99",
          episodeId: "ep-5",
          entryType: "special",
        });

        const db = createMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed: ParsedResult = {
          title: "Jujutsu Kaisen",
          season: null,
          episode: null,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        };
        const results = await matcher.match(parsed, "abc123");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("tvdb-99");
        expect(results[0]?.anime.title).toBeTruthy();
        expect(results[0]?.episode?.id).toBe("ep-5");
        expect(results[0]?.score).toBe(1);
        expect(results[0]?.failureReason).toBeUndefined();
      });
    });

    test("falls through to DB when no override exists for hash", async () => {
      await withTempDir("matcher-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        overrideStore.set("other-hash", { animeId: "tvdb-99" });

        const db = createMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed: ParsedResult = {
          title: "Jujutsu Kaisen",
          season: 1,
          episode: 1,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        };
        const results = await matcher.match(parsed, "nonexistent-hash");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("1");
        expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
        expect(results[0]?.episode?.id).toBe("101");
        expect(results[0]?.score).toBeGreaterThan(0);
      });
    });

    test("falls through to DB when no OverrideStore provided", async () => {
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
      const results = await matcher.match(parsed, "abc123");

      expect(results).toHaveLength(1);
      expect(results[0]?.anime.id).toBe("1");
    });

    test("override with animeId only returns anime match without episode", async () => {
      await withTempDir("matcher-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        overrideStore.set("abc123", { animeId: "tvdb-99" });

        const db = createMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed: ParsedResult = {
          title: "Jujutsu Kaisen",
          season: 1,
          episode: 1,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        };
        const results = await matcher.match(parsed, "abc123");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("tvdb-99");
        expect(results[0]?.episode).toBeUndefined();
        expect(results[0]?.score).toBe(1);
      });
    });

    test("entryType-only override queries DB then overrides entryType in results", async () => {
      await withTempDir("matcher-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        overrideStore.set("abc123", { entryType: "special" });

        const db = createMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed: ParsedResult = {
          title: "Jujutsu Kaisen",
          season: 1,
          episode: 1,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        };
        const results = await matcher.match(parsed, "abc123");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("1");
        expect(results[0]?.anime.entryType).toBe("special");
        expect(results[0]?.episode?.entryType).toBe("special");
      });
    });
  });
});
