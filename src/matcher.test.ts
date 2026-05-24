import { describe, expect, test } from "bun:test";
import {
  Matcher,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
} from "./matcher";
import { OverrideStore } from "./override-store";
import type { DatabasePlugin } from "./plugins/database/plugin";
import {
  createCallCounter,
  createDataMockDb,
  createMockDb,
  makeParsedResult,
  withTempDir,
} from "./test-fixtures";

describe("Matcher", () => {
  test("returns match when anime found and episode number matches", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen",
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.titleEn).toBe("Jujutsu Kaisen");
    expect(results[0]?.episode?.episode).toBe(1);
    expect(results[0]?.episode?.season).toBe(1);
    expect(typeof results[0]?.score).toBe("number");
  });

  test("returns match without episode when parsed has no episode number", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Jujutsu Kaisen 0");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(1);
    expect(results[0]?.anime.titleEn).toBe("Jujutsu Kaisen 0");
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
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Romance Dawn" }],
      },
      {
        animeId: "2",
        title: "One Piece: Movie 1",
        episodes: [{ id: "201", season: 1, episode: 1, titleEn: "Movie" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("One Piece");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.titleEn).toBe("One Piece");
    expect(results[1]?.anime.titleEn).toBe("One Piece: Movie 1");
  });

  test("returns movie candidate when no episode number parsed", async () => {
    const db = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen 0",
        entryType: "movie",
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Jujutsu Kaisen 0 Movie" }],
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
        episodes: [{ id: "201", season: 1, episode: 1, titleEn: "Special" }],
      },
      {
        animeId: "1",
        title: "Solo Leveling",
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Episode 1" }],
      },
    ]);

    const matcher = new Matcher({ database: db });
    const parsed = makeParsedResult("Solo Leveling");
    const results = await matcher.match(parsed);

    expect(results).toHaveLength(2);
    expect(results[0]?.anime.titleEn).toBe("Solo Leveling");
    const scoreA = results[0]?.score ?? 0;
    const scoreB = results[1]?.score ?? 0;
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  test("uses the injected DatabasePlugin to resolve matches", async () => {
    const tvDb = createDataMockDb([
      {
        animeId: "1",
        title: "Jujutsu Kaisen",
        episodes: [{ id: "101", season: 1, episode: 1, titleEn: "TVDB Ep" }],
      },
    ]);
    const movieDb: DatabasePlugin = {
      async searchAnime() {
        return [{ id: "99", titleEn: "Jujutsu Kaisen", entryType: "movie" as const }];
      },
      async getEpisodes() {
        return [
          {
            id: "901",
            animeId: "99",
            season: 1,
            episode: 1,
            titleEn: "MovieDB Ep",
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
    expect(tvResult[0]?.episode?.titleEn).toBe("TVDB Ep");
    expect(movieResult[0]?.anime.entryType).toBe("movie");
    expect(movieResult[0]?.episode?.titleEn).toBe("MovieDB Ep");
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

  test("skips fetching episodes for low-similarity search results", async () => {
    const episodeCalls = createCallCounter();

    const trackingDb: DatabasePlugin = {
      async searchAnime() {
        return [
          { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          { id: "2", titleEn: "Totally Unrelated Series XYZ", entryType: "tv" },
        ];
      },
      async getEpisodes(animeId: string) {
        episodeCalls.inc();
        return animeId === "1"
          ? [{ id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" }]
          : [];
      },
      async getArtwork() {
        return [];
      },
      async getAnime() {
        return null;
      },
    };

    const matcher = new Matcher({ database: trackingDb });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
    const results = await matcher.match(parsed);

    expect(episodeCalls.get()).toBe(1);
    expect(results[0]?.anime.id).toBe("1");
    expect(results[0]?.episode?.episode).toBe(1);
  });

  test("shares episode cache with matchBatch", async () => {
    const episodeCalls = createCallCounter();

    const trackingDb: DatabasePlugin = {
      async searchAnime() {
        return [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }];
      },
      async getEpisodes() {
        episodeCalls.inc();
        return [
          { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
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
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

    await matcher.match(parsed);
    expect(episodeCalls.get()).toBe(1);

    await matcher.matchBatch([parsed]);
    expect(episodeCalls.get()).toBe(1);
  });

  test("shares search cache between match and matchBatch", async () => {
    const searchCalls = createCallCounter();

    const trackingDb = createMockDb({
      searchAnime(title: string) {
        searchCalls.inc();
        return [{ id: "1", titleEn: title, entryType: "tv" }];
      },
      getEpisodes() {
        return [
          { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
        ];
      },
    });

    const matcher = new Matcher({ database: trackingDb });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

    await matcher.match(parsed);
    expect(searchCalls.get()).toBe(1);

    await matcher.matchBatch([parsed]);
    expect(searchCalls.get()).toBe(1);
  });

  describe("findMatchingEpisode (season preference)", () => {
    test("prefers season > 0 over season 0 (special) when parsed season is null", async () => {
      const db = createMockDb({
        searchAnime: () => [{ id: "1", titleEn: "Oshi no Ko", entryType: "tv" }],
        getEpisodes: () => [
          {
            id: "s1",
            animeId: "1",
            season: 0,
            episode: 1,
            titleEn: "Special Retrospective Vol.1",
            entryType: "special",
          },
          {
            id: "s2",
            animeId: "1",
            season: 0,
            episode: 2,
            titleEn: "Special Retrospective Vol.2",
            entryType: "special",
          },
          {
            id: "e1",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Mother and Children",
            entryType: "tv",
          },
          {
            id: "e2",
            animeId: "1",
            season: 1,
            episode: 2,
            titleEn: "A Three-Year-Old's Melody",
            entryType: "tv",
          },
        ],
      });

      const matcher = new Matcher({ database: db });
      const result = await matcher.match(makeParsedResult("Oshi no Ko", null, 1));
      const result2 = await matcher.match(makeParsedResult("Oshi no Ko", null, 2));

      expect(result[0]?.episode?.id).toBe("e1");
      expect(result[0]?.episode?.season).toBe(1);
      expect(result[0]?.episode?.entryType).toBe("tv");
      expect(result[0]?.episode?.titleEn).toBe("Mother and Children");

      expect(result2[0]?.episode?.id).toBe("e2");
      expect(result2[0]?.episode?.season).toBe(1);
      expect(result2[0]?.episode?.entryType).toBe("tv");
      expect(result2[0]?.episode?.titleEn).toBe("A Three-Year-Old's Melody");
    });

    test("falls back to season 0 (special) when no regular season episode exists", async () => {
      const db = createMockDb({
        searchAnime: () => [{ id: "1", titleEn: "Oshi no Ko", entryType: "tv" }],
        getEpisodes: () => [
          {
            id: "s3",
            animeId: "1",
            season: 0,
            episode: 3,
            titleEn: "Special Vol.3",
            entryType: "special",
          },
        ],
      });

      const matcher = new Matcher({ database: db });
      const result = await matcher.match(makeParsedResult("Oshi no Ko", null, 3));

      expect(result[0]?.episode?.id).toBe("s3");
      expect(result[0]?.episode?.season).toBe(0);
      expect(result[0]?.episode?.entryType).toBe("special");
    });

    test("respects explicit season when provided", async () => {
      const db = createMockDb({
        searchAnime: () => [{ id: "1", titleEn: "Oshi no Ko", entryType: "tv" }],
        getEpisodes: () => [
          {
            id: "s1",
            animeId: "1",
            season: 0,
            episode: 1,
            titleEn: "Special Vol.1",
            entryType: "special",
          },
          {
            id: "e1",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Mother and Children",
            entryType: "tv",
          },
        ],
      });

      const matcher = new Matcher({ database: db });
      const result = await matcher.match(makeParsedResult("Oshi no Ko", 0, 1));

      expect(result[0]?.episode?.id).toBe("s1");
      expect(result[0]?.episode?.season).toBe(0);
      expect(result[0]?.episode?.entryType).toBe("special");
    });
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
            return [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }];
          }
          return [{ id: "2", titleEn: "One Piece", entryType: "tv" }];
        },
        async getEpisodes(animeId: string) {
          episodeCalls.inc();
          episodesIds.push(animeId);
          if (animeId === "1") {
            return [
              { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
              { id: "102", animeId: "1", season: 1, episode: 2, titleEn: "Ep 2", entryType: "tv" },
            ];
          }
          return [
            {
              id: "201",
              animeId: "2",
              season: 1,
              episode: 1,
              titleEn: "One Piece Ep 1",
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

      expect(results[0]?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(results[0]?.episode?.episode).toBe(1);
      expect(results[1]?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(results[1]?.episode?.episode).toBe(2);

      expect(results[2]?.anime.titleEn).toBe("One Piece");
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
          return [{ id: "1", titleEn: title, entryType: "movie" }];
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
      expect(results[0]?.anime.titleEn).toBe("Movie Title");
      expect(results[0]?.episode).toBeUndefined();
      expect(searchCalls.get()).toBe(1);
    });

    test("caches episodes across repeated matchBatch calls", async () => {
      const episodeCalls = createCallCounter();

      const trackingDb: DatabasePlugin = {
        async searchAnime() {
          return [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }];
        },
        async getEpisodes() {
          episodeCalls.inc();
          return [
            { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
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
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      await matcher.matchBatch([parsed]);
      expect(episodeCalls.get()).toBe(1);

      await matcher.matchBatch([parsed]);
      expect(episodeCalls.get()).toBe(1);
    });

    test("populates cache that match reads from", async () => {
      const episodeCalls = createCallCounter();

      const trackingDb: DatabasePlugin = {
        async searchAnime() {
          return [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }];
        },
        async getEpisodes() {
          episodeCalls.inc();
          return [
            { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
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
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      await matcher.matchBatch([parsed]);
      expect(episodeCalls.get()).toBe(1);

      await matcher.match(parsed);
      expect(episodeCalls.get()).toBe(1);
    });

    test("skips fetching episodes for low-similarity search results", async () => {
      const episodeCalls = createCallCounter();

      const trackingDb: DatabasePlugin = {
        async searchAnime() {
          return [
            { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
            { id: "2", titleEn: "Totally Unrelated Series XYZ", entryType: "tv" },
          ];
        },
        async getEpisodes(animeId: string) {
          episodeCalls.inc();
          if (animeId === "1") {
            return [
              {
                id: "101",
                animeId: "1",
                season: 1,
                episode: 1,
                titleEn: "Ep 1",
                entryType: "tv",
              },
            ];
          }
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
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      const results = await matcher.matchBatch([parsed]);

      expect(episodeCalls.get()).toBe(1);
      expect(results[0]?.anime.id).toBe("1");
      expect(results[0]?.episode?.episode).toBe(1);
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
            episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen");
        const results = await matcher.match(parsed, "abc123");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("tvdb-99");
        expect(results[0]?.anime.titleEn).toBeTruthy();
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
            episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
          },
        ]);

        const matcher = new Matcher({ database: db, overrideStore });
        const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
        const results = await matcher.match(parsed, "nonexistent-hash");

        expect(results).toHaveLength(1);
        expect(results[0]?.anime.id).toBe("1");
        expect(results[0]?.anime.titleEn).toBe("Jujutsu Kaisen");
        expect(results[0]?.episode?.id).toBe("101");
        expect(results[0]?.score).toBeGreaterThan(0);
      });
    });

    test("falls through to DB when no OverrideStore provided", async () => {
      const db = createDataMockDb([
        {
          animeId: "1",
          title: "Jujutsu Kaisen",
          episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
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
            episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
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
            episodes: [{ id: "101", season: 1, episode: 1, titleEn: "Ryomen Sukuna" }],
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

  describe("matchResultFromOverride", () => {
    test("returns match with overridden data when animeId and episodeId provided", () => {
      const result = matchResultFromOverride({
        animeId: "tvdb-99",
        episodeId: "ep-5",
        entryType: "special",
      });

      expect(result.anime.id).toBe("tvdb-99");
      expect(result.anime.titleEn).toBe("(overridden)");
      expect(result.anime.entryType).toBe("special");
      expect(result.episode?.id).toBe("ep-5");
      expect(result.episode?.animeId).toBe("tvdb-99");
      expect(result.episode?.season).toBe(0);
      expect(result.episode?.episode).toBe(0);
      expect(result.episode?.titleEn).toBe("(overridden)");
      expect(result.score).toBe(1);
    });

    test("returns anime-only match when only animeId provided", () => {
      const result = matchResultFromOverride({ animeId: "tvdb-99" });

      expect(result.anime.id).toBe("tvdb-99");
      expect(result.episode).toBeUndefined();
      expect(result.score).toBe(1);
    });

    test("returns empty anime when no fields provided", () => {
      const result = matchResultFromOverride({});

      expect(result.anime.id).toBe("");
      expect(result.anime.entryType).toBe("tv");
      expect(result.episode).toBeUndefined();
      expect(result.score).toBe(1);
    });

    test("does not attach episode when episodeId is undefined even if animeId present", () => {
      const result = matchResultFromOverride({
        animeId: "tvdb-99",
        entryType: "movie",
      });

      expect(result.anime.id).toBe("tvdb-99");
      expect(result.anime.entryType).toBe("movie");
      expect(result.episode).toBeUndefined();
    });
  });

  describe("matchResultFromCache", () => {
    test("returns match with episode when cached data has episodeId and episode number", () => {
      const result = matchResultFromCache({
        animeId: "1",
        animeTitle: "Anime Title",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 5,
        title: "Episode Title",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(result.anime.id).toBe("1");
      expect(result.anime.titleEn).toBe("Anime Title");
      expect(result.anime.entryType).toBe("tv");
      expect(result.episode?.id).toBe("101");
      expect(result.episode?.animeId).toBe("1");
      expect(result.episode?.season).toBe(1);
      expect(result.episode?.episode).toBe(5);
      expect(result.episode?.titleEn).toBe("Episode Title");
      expect(result.score).toBe(1);
    });

    test("returns anime-only match when episodeId is null", () => {
      const result = matchResultFromCache({
        animeId: "1",
        animeTitle: "Movie Title",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(result.anime.id).toBe("1");
      expect(result.anime.titleEn).toBe("Movie Title");
      expect(result.episode).toBeUndefined();
      expect(result.score).toBe(1);
    });

    test("defaults null season to 1 when episode is present", () => {
      const result = matchResultFromCache({
        animeId: "1",
        episodeId: "101",
        entryType: "tv",
        season: null,
        episode: 3,
        title: "Ep 3",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(result.episode?.season).toBe(1);
      expect(result.episode?.episode).toBe(3);
    });

    test("defaults null title to empty string", () => {
      const result = matchResultFromCache({
        animeId: "1",
        episodeId: null,
        entryType: "tv",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      expect(result.anime.titleEn).toBe("");
    });
  });

  describe("matchResultFromManual", () => {
    test("returns match with manual data using EntryType", () => {
      const result = matchResultFromManual("99", 5, "special");

      expect(result.anime.id).toBe("99");
      expect(result.anime.titleEn).toBe("");
      expect(result.anime.entryType).toBe("special");
      expect(result.episode?.id).toBe("");
      expect(result.episode?.animeId).toBe("99");
      expect(result.episode?.season).toBe(1);
      expect(result.episode?.episode).toBe(5);
      expect(result.episode?.titleEn).toBe("");
      expect(result.episode?.entryType).toBe("special");
      expect(result.score).toBe(1);
    });

    test("accepts tv entryType", () => {
      const result = matchResultFromManual("1", 1, "tv");

      expect(result.anime.entryType).toBe("tv");
      expect(result.episode?.entryType).toBe("tv");
    });
  });
});
