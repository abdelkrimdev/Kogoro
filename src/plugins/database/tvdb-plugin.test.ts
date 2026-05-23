import { describe, expect, test } from "bun:test";
import { createCallCounter, toUrlString } from "../../test-fixtures";
import type { DatabasePlugin } from "./plugin";
import { TVDBPlugin } from "./tvdb-plugin";
import type { AnimeResult } from "./types";

function mockFetch(
  data: unknown,
  status = 200,
  loginToken = "mock-token",
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (url: string | URL, _init?: RequestInit) => {
    const urlStr = toUrlString(url);
    if (urlStr.includes("/login")) {
      return new Response(JSON.stringify({ data: { token: loginToken } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function mockFetchFailure(
  status = 401,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function mockFetchWithRoutes(
  routes: Record<string, unknown>,
  loginToken = "mock-token",
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (url: string | URL, _init?: RequestInit) => {
    const urlStr = toUrlString(url);
    if (urlStr.includes("/login")) {
      return new Response(JSON.stringify({ data: { token: loginToken } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    for (const [path, data] of Object.entries(routes)) {
      if (urlStr.includes(path)) {
        return new Response(JSON.stringify({ data }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
  };
}

describe("TVDBPlugin", () => {
  test("satisfies DatabasePlugin contract", () => {
    const plugin: DatabasePlugin = new TVDBPlugin({ apiKey: "test-key" });
    expect(plugin.searchAnime).toBeInstanceOf(Function);
    expect(plugin.getEpisodes).toBeInstanceOf(Function);
    expect(plugin.getArtwork).toBeInstanceOf(Function);
  });

  describe("searchAnime", () => {
    test("returns AnimeResult array from TVDB search API", async () => {
      const searchResponse = [
        {
          id: 12345,
          slug: "jujutsu-kaisen",
          name: "Jujutsu Kaisen",
          aliases: ["咒術廻戦", "Jujutsu Kaisen (呪術廻戦)"],
          image: "https://artworks.thetvdb.com/series/12345/poster.jpg",
          year: "2020",
          overview: "A boy fights curses.",
          status: "Continuing",
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(searchResponse),
      });
      const results: AnimeResult[] = await plugin.searchAnime("Jujutsu Kaisen");

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("12345");
      expect(results[0]?.titleEn).toBe("Jujutsu Kaisen");
      expect(results[0]?.slug).toBe("jujutsu-kaisen");
      expect(results[0]?.overview).toBe("A boy fights curses.");
      expect(results[0]?.year).toBe(2020);
      expect(results[0]?.image).toBe("https://artworks.thetvdb.com/series/12345/poster.jpg");
      expect(results[0]?.status).toBe("Continuing");
      expect(results[0]?.entryType).toBe("tv");
    });

    test("returns empty array for no results", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await plugin.searchAnime("Nonexistent Anime");
      expect(results).toEqual([]);
    });

    test("populates titleJa from aliases", async () => {
      const searchResponse = [
        {
          id: 54321,
          name: "Attack on Titan",
          aliases: ["進撃の巨人", "Shingeki no Kyojin"],
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(searchResponse),
      });
      const results = await plugin.searchAnime("Attack on Titan");
      expect(results[0]?.titleJa).toBe("進撃の巨人");
    });
  });

  describe("getEpisodes", () => {
    test("returns EpisodeResult array from TVDB episodes API", async () => {
      const episodesResponse = {
        series: { id: 12345, name: "Jujutsu Kaisen" },
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "Ryomen Sukuna",
            overview: "A boy swallows a cursed finger.",
            aired: "2020-10-03",
            image: "https://artworks.thetvdb.com/episodes/1001.jpg",
            type: "series",
          },
          {
            id: 1002,
            seasonNumber: 1,
            number: 2,
            name: "For Myself",
            overview: "Yuji enrolls at Jujutsu High.",
            aired: "2020-10-10",
            type: "series",
          },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/translations": [],
        }),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(2);
      expect(results[0]?.animeId).toBe("12345");
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
      expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(results[0]?.airDate).toBe("2020-10-03");
      expect(results[0]?.entryType).toBe("tv");
      expect(results[1]?.entryType).toBe("tv");
    });

    test("returns empty array when no episodes exist", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch({ series: { id: 99999, name: "Unknown" } }),
      });
      const results = await plugin.getEpisodes("99999");
      expect(results).toEqual([]);
    });

    test("maps TVDB episode types to EntryType correctly", async () => {
      const episodesResponse = {
        series: { id: 100, name: "Test" },
        episodes: [
          { id: 1, seasonNumber: 1, number: 1, name: "TV Eps", type: "series" },
          { id: 2, seasonNumber: 1, number: 1, name: "Movie", type: "movie" },
          { id: 3, seasonNumber: 1, number: 1, name: "OVA", type: "ova" },
          { id: 4, seasonNumber: 1, number: 1, name: "Special", type: "special" },
          { id: 5, seasonNumber: 1, number: 1, name: "Short", type: "short" },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/episodes/official/jpn": { episodes: [] },
        }),
      });
      const results = await plugin.getEpisodes("100");

      expect(results.find((e) => e.titleEn === "TV Eps")?.entryType).toBe("tv");
      expect(results.find((e) => e.titleEn === "Movie")?.entryType).toBe("movie");
      expect(results.find((e) => e.titleEn === "OVA")?.entryType).toBe("ova");
      expect(results.find((e) => e.titleEn === "Special")?.entryType).toBe("special");
      expect(results.find((e) => e.titleEn === "Short")?.entryType).toBe("special");
    });
  });

  describe("getArtwork", () => {
    test("returns artwork filtered by type", async () => {
      const artworkResponse = [
        { id: 1, image: "https://example.com/poster1.jpg", type: 1 },
        { id: 2, image: "https://example.com/poster2.jpg", type: 14 },
        { id: 3, image: "https://example.com/fanart.jpg", type: 2 },
        { id: 4, image: "https://example.com/banner.jpg", type: 3 },
        { id: 5, image: "https://example.com/thumb.jpg", type: 99 },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(artworkResponse),
      });
      const results = await plugin.getArtwork("12345", "poster");

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe("1");
      expect(results[0]?.type).toBe("poster");
      expect(results[0]?.url).toBe("https://example.com/poster1.jpg");
      expect(results[1]?.id).toBe("2");
      expect(results[1]?.type).toBe("poster");
    });

    test("returns empty array when no matching artwork type", async () => {
      const artworkResponse = [{ id: 1, image: "https://example.com/banner.jpg", type: 3 }];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(artworkResponse),
      });
      const results = await plugin.getArtwork("12345", "fanart");
      expect(results).toEqual([]);
    });

    test("includes width and height in artwork results", async () => {
      const artworkResponse = [
        { id: 1, image: "https://example.com/poster.jpg", type: 1, width: 680, height: 1000 },
        { id: 2, image: "https://example.com/poster2.jpg", type: 14, width: 900, height: 1280 },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(artworkResponse),
      });
      const results = await plugin.getArtwork("12345", "poster");
      expect(results).toHaveLength(2);
      expect(results[0]?.width).toBe(680);
      expect(results[0]?.height).toBe(1000);
      expect(results[1]?.width).toBe(900);
      expect(results[1]?.height).toBe(1280);
    });

    test("returns empty array when no artwork exists", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await plugin.getArtwork("12345", "poster");
      expect(results).toEqual([]);
    });
  });

  describe("getTranslations", () => {
    test("returns translation map from TVDB translations API", async () => {
      const translationsResponse = [
        { language: "jpn", name: "呪術廻戦", overview: "呪いを払う少年の物語" },
        { language: "eng", name: "Jujutsu Kaisen", overview: "A boy fights curses." },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(translationsResponse),
      });
      const results = await plugin.getTranslations?.("12345");

      expect(results).toEqual({
        jpn: "呪術廻戦",
        eng: "Jujutsu Kaisen",
      });
    });

    test("returns empty object when no translations exist", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await plugin.getTranslations?.("99999");
      expect(results).toEqual({});
    });

    test("getTranslations is an optional method on DatabasePlugin", () => {
      const plugin: DatabasePlugin = new TVDBPlugin({ apiKey: "test-key" });
      expect(plugin.getTranslations).toBeInstanceOf(Function);
    });
  });

  describe("getEpisodes with translations", () => {
    test("populates titleEn and titleJa on episodes from translations", async () => {
      const episodesResponse = {
        series: { id: 12345, name: "Jujutsu Kaisen" },
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "Ryomen Sukuna",
            overview: "A boy swallows a cursed finger.",
            aired: "2020-10-03",
            type: "series",
          },
        ],
      };

      const jpnEpisodesResponse = {
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "両面宿儺",
            overview: "",
            type: "series",
          },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/episodes/official/jpn": jpnEpisodesResponse,
        }),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(1);
      expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(results[0]?.titleJa).toBe("両面宿儺");
    });
  });

  describe("getAnime", () => {
    test("returns AnimeResult from TVDB series API for a valid ID", async () => {
      const seriesResponse = {
        id: 12345,
        slug: "jujutsu-kaisen",
        name: "Jujutsu Kaisen",
        aliases: [{ name: "呪術廻戦", lang: "jpn" }],
        image: "https://artworks.thetvdb.com/series/12345/poster.jpg",
        year: "2020",
        overview: "A boy fights curses.",
        status: "Continuing",
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetch(seriesResponse),
      });
      const result = await plugin.getAnime("12345");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("12345");
      expect(result?.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.slug).toBe("jujutsu-kaisen");
      expect(result?.overview).toBe("A boy fights curses.");
      expect(result?.year).toBe(2020);
      expect(result?.entryType).toBe("tv");
    });

    test("returns null when anime ID does not exist", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        fetch: mockFetchFailure(404),
      });
      const result = await plugin.getAnime("99999");
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    test("returns empty array on login failure", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "bad-key",
        fetch: mockFetchFailure(401),
      });
      const results = await plugin.searchAnime("Jujutsu Kaisen");
      expect(results).toEqual([]);
    });

    test("returns empty array on API failure after login", async () => {
      const fetchCalls = createCallCounter();
      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        fetchCalls.inc();
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = new TVDBPlugin({ apiKey: "test-key", fetch });
      const searchResults = await plugin.searchAnime("Unknown");
      expect(searchResults).toEqual([]);
      expect(fetchCalls.get()).toBe(2);
    });

    test("caches login token across multiple API calls", async () => {
      const loginCalls = createCallCounter();
      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          loginCalls.inc();
          return new Response(JSON.stringify({ data: { token: "cached-token" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = new TVDBPlugin({ apiKey: "test-key", fetch });
      await plugin.searchAnime("One");
      await plugin.searchAnime("Two");
      expect(loginCalls.get()).toBe(1);
    });
  });
});
