import { describe, expect, test } from "bun:test";
import { createDataMockDb, createMockDb, makeParsedResult, makeSeasonEpisodes } from "../fixtures";
import type { DatabasePlugin, EpisodeResult } from "../types";
import {
  Matcher,
  matchResultFromCache,
  matchResultFromManual,
  matchResultFromOverride,
  resolveEpisode,
} from "./matcher";

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
      async validate() {
        return { valid: true };
      },
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
    const mockDb = createMockDb({
      track: true,
      searchAnime: () => [
        { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
        { id: "2", titleEn: "Totally Unrelated Series XYZ", entryType: "tv" },
      ],
      getEpisodes: (animeId) =>
        animeId === "1"
          ? [{ id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" }]
          : [],
    });

    const matcher = new Matcher({ database: mockDb });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);
    const results = await matcher.match(parsed);

    expect(mockDb.tracking?.episodeCalls.get()).toBe(1);
    expect(results[0]?.anime.id).toBe("1");
    expect(results[0]?.episode?.episode).toBe(1);
  });

  test("shares episode cache with matchBatch", async () => {
    const mockDb = createMockDb({
      track: true,
      searchAnime: () => [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }],
      getEpisodes: () => [
        { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
      ],
    });

    const matcher = new Matcher({ database: mockDb });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

    await matcher.match(parsed);
    expect(mockDb.tracking?.episodeCalls.get()).toBe(1);

    await matcher.matchBatch([parsed]);
    expect(mockDb.tracking?.episodeCalls.get()).toBe(1);
  });

  test("shares search cache between match and matchBatch", async () => {
    const mockDb = createMockDb({
      track: true,
      searchAnime: (title) => [{ id: "1", titleEn: title, entryType: "tv" }],
      getEpisodes: () => [
        { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
      ],
    });

    const matcher = new Matcher({ database: mockDb });
    const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

    await matcher.match(parsed);
    expect(mockDb.tracking?.searchCalls.get()).toBe(1);

    await matcher.matchBatch([parsed]);
    expect(mockDb.tracking?.searchCalls.get()).toBe(1);
  });

  describe("episode resolution", () => {
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
      const mockDb = createMockDb({
        track: true,
        searchAnime: (title) => {
          if (title === "Jujutsu Kaisen") {
            return [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }];
          }
          return [{ id: "2", titleEn: "One Piece", entryType: "tv" }];
        },
        getEpisodes: (animeId) => {
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
      });

      const matcher = new Matcher({ database: mockDb });

      const parsedList = [
        makeParsedResult("Jujutsu Kaisen", 1, 1),
        makeParsedResult("Jujutsu Kaisen", 1, 2),
        makeParsedResult("One Piece", 1, 1),
      ];

      const results = await matcher.matchBatch(parsedList);

      expect(results).toHaveLength(3);
      expect(mockDb.tracking?.searchCalls.get()).toBe(2);
      expect(mockDb.tracking?.searchTitles).toEqual(["Jujutsu Kaisen", "One Piece"]);
      expect(mockDb.tracking?.episodeCalls.get()).toBe(2);
      expect(mockDb.tracking?.episodeIds).toEqual(["1", "2"]);

      expect(results[0]?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(results[0]?.episode?.episode).toBe(1);
      expect(results[1]?.anime.titleEn).toBe("Jujutsu Kaisen");
      expect(results[1]?.episode?.episode).toBe(2);

      expect(results[2]?.anime.titleEn).toBe("One Piece");
      expect(results[2]?.episode?.episode).toBe(1);
    });

    test("prefers anime ID with matching season over base title when parsing explicit season", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: (title) => [
          { id: "1", titleEn: title, entryType: "tv" },
          { id: "2", titleEn: `${title}: Season 2`, entryType: "tv" },
        ],
        getEpisodes: (animeId) => {
          if (animeId === "1") {
            return makeSeasonEpisodes(1, 11, { animeId: "1" });
          }
          return Array.from({ length: 13 }, (_, i) => ({
            id: `s2e${i + 1}`,
            animeId: "2",
            season: 2,
            episode: 12 + i,
            titleEn: `S2E${i + 1}`,
            entryType: "tv" as const,
          }));
        },
      });

      const matcher = new Matcher({ database: mockDb });

      const results = await matcher.matchBatch([makeParsedResult("Attack on Titan", 2, 8)]);

      expect(results).toHaveLength(1);
      expect(results[0]?.anime.id).toBe("2");
      expect(results[0]?.episode?.id).toBe("s2e8");
      expect(results[0]?.episode?.episode).toBe(19);
    });

    test("handles empty input", async () => {
      const db = createDataMockDb([{ animeId: "1", title: "Test", episodes: [] }]);

      const matcher = new Matcher({ database: db });
      const results = await matcher.matchBatch([]);
      expect(results).toEqual([]);
    });

    test("returns match without episode when no episode number in parsed title", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: (title) => [{ id: "1", titleEn: title, entryType: "movie" }],
        getEpisodes: () => [],
      });

      const matcher = new Matcher({ database: mockDb });
      const parsedList = [makeParsedResult("Movie Title")];

      const results = await matcher.matchBatch(parsedList);
      expect(results).toHaveLength(1);
      expect(results[0]?.anime.titleEn).toBe("Movie Title");
      expect(results[0]?.episode).toBeUndefined();
      expect(mockDb.tracking?.searchCalls.get()).toBe(1);
    });

    test("caches episodes across repeated matchBatch calls", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: () => [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }],
        getEpisodes: () => [
          { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
        ],
      });

      const matcher = new Matcher({ database: mockDb });
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      await matcher.matchBatch([parsed]);
      expect(mockDb.tracking?.episodeCalls.get()).toBe(1);

      await matcher.matchBatch([parsed]);
      expect(mockDb.tracking?.episodeCalls.get()).toBe(1);
    });

    test("populates cache that match reads from", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: () => [{ id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" }],
        getEpisodes: () => [
          { id: "101", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
        ],
      });

      const matcher = new Matcher({ database: mockDb });
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      await matcher.matchBatch([parsed]);
      expect(mockDb.tracking?.episodeCalls.get()).toBe(1);

      await matcher.match(parsed);
      expect(mockDb.tracking?.episodeCalls.get()).toBe(1);
    });

    test("skips fetching episodes for low-similarity search results", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: () => [
          { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
          { id: "2", titleEn: "Totally Unrelated Series XYZ", entryType: "tv" },
        ],
        getEpisodes: (animeId) => {
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
      });

      const matcher = new Matcher({ database: mockDb });
      const parsed = makeParsedResult("Jujutsu Kaisen", 1, 1);

      const results = await matcher.matchBatch([parsed]);

      expect(mockDb.tracking?.episodeCalls.get()).toBe(1);
      expect(results[0]?.anime.id).toBe("1");
      expect(results[0]?.episode?.episode).toBe(1);
    });

    test("word-level scoring makes 'Oshi no Ko' beat 'Hoshi no Koe' with clear margin", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: () => [
          { id: "1", titleEn: "Oshi no Ko", entryType: "tv" },
          { id: "2", titleEn: "Hoshi no Koe", entryType: "tv" },
        ],
        getEpisodes: (animeId) => {
          if (animeId === "1") {
            return makeSeasonEpisodes(1, 11, { animeId: "1" });
          }
          return [
            {
              id: "101",
              animeId: "2",
              season: 0,
              episode: 1,
              titleEn: "OVA",
              entryType: "ova",
            },
          ];
        },
      });

      const matcher = new Matcher({ database: mockDb });

      // "Oshi No Ko" shares all 3 words with "Oshi no Ko" but only 1/3 with "Hoshi no Koe".
      // The word-level boost breaks the dice-similarity tie, giving a clear winner.
      const results = await matcher.matchBatch([makeParsedResult("Oshi No Ko", null, 1)]);

      expect(results).toHaveLength(1);
      expect(results[0]?.anime.id).toBe("1");
      expect(results[0]?.failureReason).toBeUndefined();
    });

    test("single clear winner passes through matchBatch without ambiguity", async () => {
      const mockDb = createMockDb({
        track: true,
        searchAnime: () => [
          { id: "1", titleEn: "One Piece", entryType: "tv" },
          { id: "2", titleEn: "One Punch Man", entryType: "tv" },
        ],
        getEpisodes: (animeId) => [
          {
            id: "101",
            animeId,
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
        ],
      });

      const matcher = new Matcher({ database: mockDb });
      // "One Piece" vs "One Punch Man" have sufficiently different bigram profiles
      const results = await matcher.matchBatch([makeParsedResult("One Piece", null, 1)]);

      expect(results).toHaveLength(1);
      expect(results[0]?.failureReason).toBeUndefined();
      expect(results[0]?.anime.titleEn).toBe("One Piece");
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

  describe("resolveEpisode", () => {
    function makeEpisodeResults(): EpisodeResult[] {
      return [
        {
          id: "s1",
          animeId: "1",
          season: 0,
          episode: 1,
          titleEn: "Special Vol.1",
          entryType: "special",
        },
        {
          id: "s2",
          animeId: "1",
          season: 0,
          episode: 2,
          titleEn: "Special Vol.2",
          entryType: "special",
        },
        { id: "e1", animeId: "1", season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" },
        { id: "e2", animeId: "1", season: 1, episode: 2, titleEn: "Ep 2", entryType: "tv" },
        { id: "e3", animeId: "1", season: 2, episode: 13, titleEn: "Ep 13", entryType: "tv" },
        { id: "e4", animeId: "1", season: 2, episode: 14, titleEn: "Ep 14", entryType: "tv" },
      ];
    }

    test("prefers regular season over specials when season is null", () => {
      const episodes = makeEpisodeResults();
      expect(resolveEpisode(episodes, null, 1)?.id).toBe("e1");
      expect(resolveEpisode(episodes, null, 2)?.id).toBe("e2");
    });

    test("returns undefined for nonexistent episode when season is null", () => {
      const episodes = makeEpisodeResults();
      const result = resolveEpisode(episodes, null, 3);
      expect(result).toBeUndefined();
    });

    test("falls back to specials when no regular season has the episode", () => {
      const episodes = [
        {
          id: "s3",
          animeId: "1",
          season: 0,
          episode: 3,
          titleEn: "Special Vol.3",
          entryType: "special" as const,
        },
      ];
      expect(resolveEpisode(episodes, null, 3)?.id).toBe("s3");
      expect(resolveEpisode(episodes, null, 3)?.season).toBe(0);
    });

    test("returns episode for explicit season and episode number", () => {
      const episodes = makeEpisodeResults();
      expect(resolveEpisode(episodes, 0, 1)?.id).toBe("s1");
      expect(resolveEpisode(episodes, 1, 1)?.id).toBe("e1");
      expect(resolveEpisode(episodes, 2, 1)?.id).toBe("e3");
    });

    test("resolves relative episode number within season", () => {
      const episodes = [
        ...makeSeasonEpisodes(1, 11, { animeId: "1" }),
        ...makeSeasonEpisodes(2, 13, { animeId: "1", startEpisode: 12 }),
      ];
      expect(resolveEpisode(episodes, 2, 4)?.id).toBe("s2e4");
      expect(resolveEpisode(episodes, 2, 4)?.episode).toBe(15);
    });

    test("falls back to absolute matching for single-season data when parsed season not found", () => {
      const episodes = makeSeasonEpisodes(1, 11, { animeId: "1" });
      expect(resolveEpisode(episodes, 3, 4)?.id).toBe("s1e4");
    });

    test("returns undefined for nonexistent season in multi-season data", () => {
      const episodes = [
        { id: "e1", animeId: "1", season: 1, episode: 1, titleEn: "E1", entryType: "tv" as const },
        { id: "e2", animeId: "1", season: 2, episode: 13, titleEn: "E2", entryType: "tv" as const },
      ];
      expect(resolveEpisode(episodes, 3, 1)).toBeUndefined();
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
