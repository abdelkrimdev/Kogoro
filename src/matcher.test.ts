import { describe, expect, test } from "bun:test";
import {
  Matcher,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
} from "./matcher";
import type { OverrideData } from "./override-store";
import { OverrideStore } from "./override-store";
import type { DatabasePlugin } from "./plugins/database/plugin";
import {
  createCallCounter,
  createDataMockDb,
  makeCachedMatch,
  makeParsedResult,
  withTempDir,
} from "./test-fixtures";

describe("matchResultFromCache", () => {
  const baseCached = makeCachedMatch({
    animeId: "anime-1",
    animeTitle: "Jujutsu Kaisen",
    episodeId: "ep-101",
    season: 1,
    episode: 1,
    title: "Ryomen Sukuna",
  });

  test("returns anime and episode from cache", () => {
    const result = matchResultFromCache(baseCached);

    expect(result.anime.id).toBe("anime-1");
    expect(result.anime.title).toBe("Jujutsu Kaisen");
    expect(result.anime.entryType).toBe("tv");
    expect(result.episode?.id).toBe("ep-101");
    expect(result.episode?.animeId).toBe("anime-1");
    expect(result.episode?.season).toBe(1);
    expect(result.episode?.episode).toBe(1);
    expect(result.episode?.title).toBe("Ryomen Sukuna");
    expect(result.score).toBe(1);
    expect(result.failureReason).toBeUndefined();
  });

  test("returns no episode when episodeId is null", () => {
    const cached = { ...baseCached, episodeId: null, episode: null };
    const result = matchResultFromCache(cached);

    expect(result.anime.id).toBe("anime-1");
    expect(result.episode).toBeUndefined();
    expect(result.score).toBe(1);
  });

  test("returns no episode when episode is null", () => {
    const cached = { ...baseCached, episode: null };
    const result = matchResultFromCache(cached);

    expect(result.episode).toBeUndefined();
  });

  test("falls back to empty string when animeTitle is undefined", () => {
    const cached = { ...baseCached, animeTitle: undefined };
    const result = matchResultFromCache(cached);

    expect(result.anime.title).toBe("");
  });

  test("has score of 1", () => {
    const result = matchResultFromCache(baseCached);

    expect(result.score).toBe(1);
  });
});

describe("matchResultFromOverride", () => {
  test("returns anime and episode from full override", () => {
    const override: OverrideData = {
      animeId: "tvdb-99",
      episodeId: "ep-5",
      entryType: "special",
    };
    const result = matchResultFromOverride(override);

    expect(result.anime.id).toBe("tvdb-99");
    expect(result.anime.title).toBe("(overridden)");
    expect(result.anime.entryType).toBe("special");
    expect(result.episode?.id).toBe("ep-5");
    expect(result.episode?.animeId).toBe("tvdb-99");
    expect(result.episode?.season).toBe(0);
    expect(result.episode?.episode).toBe(0);
    expect(result.episode?.title).toBe("(overridden)");
    expect(result.score).toBe(1);
    expect(result.failureReason).toBeUndefined();
  });

  test("returns anime-only match when no episodeId", () => {
    const override: OverrideData = { animeId: "tvdb-99", entryType: "movie" };
    const result = matchResultFromOverride(override);

    expect(result.anime.id).toBe("tvdb-99");
    expect(result.anime.title).toBe("(overridden)");
    expect(result.episode).toBeUndefined();
    expect(result.score).toBe(1);
  });

  test("omits episode when animeId is missing despite episodeId being set", () => {
    const override: OverrideData = { episodeId: "ep-5" };
    const result = matchResultFromOverride(override);

    expect(result.anime.id).toBe("");
    expect(result.episode).toBeUndefined();
    expect(result.score).toBe(1);
  });

  test("defaults entryType to tv", () => {
    const override: OverrideData = { animeId: "tvdb-99" };
    const result = matchResultFromOverride(override);

    expect(result.anime.entryType).toBe("tv");
  });

  test("sets (overridden) title markers", () => {
    const override: OverrideData = { animeId: "tvdb-99", episodeId: "ep-5" };
    const result = matchResultFromOverride(override);

    expect(result.anime.title).toBe("(overridden)");
    expect(result.episode?.title).toBe("(overridden)");
  });
});

describe("matchResultFromManual", () => {
  test("returns match for animeId, episode, and entryType", () => {
    const result = matchResultFromManual("anime-42", 3, "tv");

    expect(result.anime.id).toBe("anime-42");
    expect(result.anime.title).toBe("");
    expect(result.anime.entryType).toBe("tv");
    expect(result.episode?.id).toBe("");
    expect(result.episode?.animeId).toBe("anime-42");
    expect(result.episode?.season).toBe(1);
    expect(result.episode?.episode).toBe(3);
    expect(result.episode?.title).toBe("");
    expect(result.score).toBe(1);
    expect(result.failureReason).toBeUndefined();
  });

  test("accepts movie entryType", () => {
    const result = matchResultFromManual("anime-99", 1, "movie");

    expect(result.anime.entryType).toBe("movie");
    expect(result.episode?.entryType).toBe("movie");
  });

  test("has score of 1", () => {
    const result = matchResultFromManual("anime-1", 5, "ova");

    expect(result.score).toBe(1);
  });
});

describe("Matcher", () => {
  test("returns match when anime found and episode number matches", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
    expect(results[0]?.episode?.episode).toBe(1);
    expect(results[0]?.episode?.season).toBe(1);
    expect(typeof results[0]?.score).toBe("number");
  });

  test("returns match without episode when parsed has no episode number", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Jujutsu Kaisen 0");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.title).toBe("Jujutsu Kaisen 0");
    expect(results[0]?.episode).toBeUndefined();
  });

  test("returns failure reason when no anime found", async () => {
    const db = createDataMockDb([]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Nonexistent Anime");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.failureReason).toBe("No anime found");
    expect(results[0]?.score).toBe(0);
  });

  test("returns multiple candidates when multiple anime match", async () => {
    const db = createDataMockDb([
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
    const parsed = makeParsedResult("One Piece");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.title).toBe("One Piece");
    expect(results[1]?.anime.title).toBe("One Piece: Movie 1");
  });

  test("returns movie candidate when no episode number parsed", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        entryType: "movie",
        episodes: [{ id: "101", season: 1, episode: 1, title: "Jujutsu Kaisen 0 Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Jujutsu Kaisen 0");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.entryType).toBe("movie");
    expect(results[0]?.episode).toBeUndefined();
  });

  test("sorts results by score descending", async () => {
    const db = createDataMockDb([
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
    const parsed = makeParsedResult("Solo Leveling");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.title).toBe("Solo Leveling");
    const scoreA = results[0]?.score ?? 0;
    const scoreB = results[1]?.score ?? 0;
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  test("uses the injected DatabasePlugin to resolve matches", async () => {
    const tvDb = createDataMockDb([
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
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

    const tvResult = await tvMatcher.match(parsed);
    const movieResult = await movieMatcher.match(parsed);

    expect(tvResult[0]?.anime.entryType).toBe("tv");
    expect(tvResult[0]?.episode?.title).toBe("TVDB Ep");
    expect(movieResult[0]?.anime.entryType).toBe("movie");
    expect(movieResult[0]?.episode?.title).toBe("MovieDB Ep");
  });

  test("returns failure reason when parsed title is null", async () => {
    const db = createDataMockDb([{ animeId: "1", title: "Some Anime", episodes: [] }]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult(null);
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.failureReason).toBe("No title parsed");
    expect(results[0]?.score).toBe(0);
  });

  describe("matchBatch", () => {
    test("deduplicates searchAnime calls for repeated titles and getEpisodes for repeated anime IDs", async () => {
      const searchCalls = createCallCounter();
      const episodeCalls = createCallCounter();
      const searchTitles: string[] = [];
      const episodesIds: string[] = [];

      const trackingDb: DatabasePlugin = {
        async searchAnime(title: string) {
          searchCalls.inc();
          searchTitles.push(title);
          if (title === "Jujutsu Kaisen") {
            return [{ id: "1", title: "Jujutsu Kaisen", entryType: "tv" }];
          }
          return [{ id: "2", title: "One Piece", entryType: "tv" }];
        },
        async getEpisodes(animeId: string) {
          episodeCalls.inc();
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

      const parsedList = [
        makeParsedResult("Jujutsu Kaisen", 1, 1),
        makeParsedResult("Jujutsu Kaisen", 1, 2),
        makeParsedResult("One Piece", 1, 1),
      ];

      const results = await matcher.matchBatch(parsedList);

      expect(results).toHaveLength(3);
      expect(searchCalls.get()).toBe(2);
      expect(searchTitles).toEqual(["Jujutsu Kaisen", "One Piece"]);
      expect(episodeCalls.get()).toBe(2);
      expect(episodesIds).toEqual(["1", "2"]);

      expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
      expect(results[0]?.episode?.episode).toBe(1);
      expect(results[1]?.anime.title).toBe("Jujutsu Kaisen");
      expect(results[1]?.episode?.episode).toBe(2);

      expect(results[2]?.anime.title).toBe("One Piece");
      expect(results[2]?.episode?.episode).toBe(1);
    });

    test("handles empty input", async () => {
      const db = createDataMockDb([{ animeId: "1", title: "Test", episodes: [] }]);

      const matcher = new Matcher({ database: db });
      const results = await matcher.matchBatch([]);
      expect(results).toEqual([]);
    });

    test("returns match without episode when no episode number in parsed title", async () => {
      const searchCalls = createCallCounter();

      const trackingDb: DatabasePlugin = {
        async searchAnime(title: string) {
          searchCalls.inc();
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
      const parsedList = [makeParsedResult("Movie Title")];

      const results = await matcher.matchBatch(parsedList);
      expect(results).toHaveLength(1);
      expect(results[0]?.anime.title).toBe("Movie Title");
      expect(results[0]?.episode).toBeUndefined();
      expect(searchCalls.get()).toBe(1);
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

        const db = createDataMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen");
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

        const db = createDataMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
        const results = await matcher.match(parsed, "nonexistent-hash");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("1");
        expect(results[0]?.anime.title).toBe("Jujutsu Kaisen");
        expect(results[0]?.episode?.id).toBe("101");
        expect(results[0]?.score).toBeGreaterThan(0);
      });
    });

    test("falls through to DB when no OverrideStore provided", async () => {
      const db = createDataMockDb([
        {
          animeId: "1",
          title: "Jujutsu Kaisen",
          episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
        },
      ]);

      const matcher = new Matcher({ database: db });
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
      const results = await matcher.match(parsed, "abc123");

      expect(results).toHaveLength(1);
      expect(results[0]?.anime.id).toBe("1");
    });

    test("override with animeId only returns anime match without episode", async () => {
      await withTempDir("matcher-override", async (dir) => {
        const overrideStore = new OverrideStore(dir);
        overrideStore.set("abc123", { animeId: "tvdb-99" });

        const db = createDataMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
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

        const db = createDataMockDb([
          {
            animeId: "1",
            title: "Jujutsu Kaisen",
            entryType: "tv",
            episodes: [{ id: "101", season: 1, episode: 1, title: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
        const results = await matcher.match(parsed, "abc123");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("1");
        expect(results[0]?.anime.entryType).toBe("special");
        expect(results[0]?.episode?.entryType).toBe("special");
      });
    });
  });
});
