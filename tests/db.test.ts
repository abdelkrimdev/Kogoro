import { describe, expect, test } from "bun:test";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";
import { TVDBAdapter } from "../src/db/tvdb-adapter.ts";
import type { AnimeResult } from "../src/db/types.ts";

function toUrlString(url: string | URL): string {
  return typeof url === "string" ? url : url.toString();
}

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

describe("DatabasePlugin interface", () => {
  test("interface is defined", () => {
    const adapter: DatabasePlugin = new TVDBAdapter({ apiKey: "test-key" });
    expect(adapter.searchAnime).toBeInstanceOf(Function);
    expect(adapter.getEpisodes).toBeInstanceOf(Function);
    expect(adapter.getArtwork).toBeInstanceOf(Function);
  });
});

describe("TVDBAdapter", () => {
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

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch(searchResponse),
      });
      const results: AnimeResult[] = await adapter.searchAnime("Jujutsu Kaisen");

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("12345");
      expect(results[0]?.title).toBe("Jujutsu Kaisen");
      expect(results[0]?.slug).toBe("jujutsu-kaisen");
      expect(results[0]?.overview).toBe("A boy fights curses.");
      expect(results[0]?.year).toBe(2020);
      expect(results[0]?.image).toBe("https://artworks.thetvdb.com/series/12345/poster.jpg");
      expect(results[0]?.status).toBe("Continuing");
      expect(results[0]?.entryType).toBe("tv");
    });

    test("returns empty array for no results", async () => {
      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await adapter.searchAnime("Nonexistent Anime");
      expect(results).toEqual([]);
    });

    test("populates originalTitle from aliases", async () => {
      const searchResponse = [
        {
          id: 54321,
          name: "Attack on Titan",
          aliases: ["進撃の巨人", "Shingeki no Kyojin"],
        },
      ];

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch(searchResponse),
      });
      const results = await adapter.searchAnime("Attack on Titan");
      expect(results[0]?.originalTitle).toBe("進撃の巨人");
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

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/translations": [],
        }),
      });
      const results = await adapter.getEpisodes("12345");

      expect(results).toHaveLength(2);
      expect(results[0]?.animeId).toBe("12345");
      expect(results[0]?.season).toBe(1);
      expect(results[0]?.episode).toBe(1);
      expect(results[0]?.title).toBe("Ryomen Sukuna");
      expect(results[0]?.airDate).toBe("2020-10-03");
      expect(results[0]?.entryType).toBe("tv");
      expect(results[1]?.entryType).toBe("tv");
    });

    test("returns empty array when no episodes exist", async () => {
      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch({ series: { id: 99999, name: "Unknown" } }),
      });
      const results = await adapter.getEpisodes("99999");
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

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/translations": [],
        }),
      });
      const results = await adapter.getEpisodes("100");

      expect(results.find((e) => e.title === "TV Eps")?.entryType).toBe("tv");
      expect(results.find((e) => e.title === "Movie")?.entryType).toBe("movie");
      expect(results.find((e) => e.title === "OVA")?.entryType).toBe("ova");
      expect(results.find((e) => e.title === "Special")?.entryType).toBe("special");
      expect(results.find((e) => e.title === "Short")?.entryType).toBe("special");
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

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch(artworkResponse),
      });
      const results = await adapter.getArtwork("12345", "poster");

      expect(results).toHaveLength(2);
      expect(results[0]?.id).toBe("1");
      expect(results[0]?.type).toBe("poster");
      expect(results[0]?.url).toBe("https://example.com/poster1.jpg");
      expect(results[1]?.id).toBe("2");
      expect(results[1]?.type).toBe("poster");
    });

    test("returns empty array when no matching artwork type", async () => {
      const artworkResponse = [{ id: 1, image: "https://example.com/banner.jpg", type: 3 }];

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch(artworkResponse),
      });
      const results = await adapter.getArtwork("12345", "fanart");
      expect(results).toEqual([]);
    });

    test("returns empty array when no artwork exists", async () => {
      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await adapter.getArtwork("12345", "poster");
      expect(results).toEqual([]);
    });
  });

  describe("getTranslations", () => {
    test("returns translation map from TVDB translations API", async () => {
      const translationsResponse = [
        { language: "jpn", name: "呪術廻戦", overview: "呪いを払う少年の物語" },
        { language: "eng", name: "Jujutsu Kaisen", overview: "A boy fights curses." },
      ];

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch(translationsResponse),
      });
      const results = await adapter.getTranslations?.("12345");

      expect(results).toEqual({
        jpn: "呪術廻戦",
        eng: "Jujutsu Kaisen",
      });
    });

    test("returns empty object when no translations exist", async () => {
      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetch([]),
      });
      const results = await adapter.getTranslations?.("99999");
      expect(results).toEqual({});
    });

    test("getTranslations is an optional method on DatabasePlugin", () => {
      const adapter: DatabasePlugin = new TVDBAdapter({ apiKey: "test-key" });
      expect(adapter.getTranslations).toBeInstanceOf(Function);
    });
  });

  describe("translations integration with getEpisodes", () => {
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

      const translationsResponse = [
        { language: "jpn", name: "呪術廻戦", overview: "" },
        { language: "eng", name: "Jujutsu Kaisen", overview: "" },
      ];

      const adapter = new TVDBAdapter({
        apiKey: "test-key",
        fetch: mockFetchWithRoutes({
          "/episodes/default": episodesResponse,
          "/translations": translationsResponse,
        }),
      });
      const results = await adapter.getEpisodes("12345");

      expect(results).toHaveLength(1);
      expect(results[0]?.titleEn).toBe("Jujutsu Kaisen");
      expect(results[0]?.titleJa).toBe("呪術廻戦");
    });
  });

  describe("error handling", () => {
    test("returns empty array on login failure", async () => {
      const adapter = new TVDBAdapter({
        apiKey: "bad-key",
        fetch: mockFetchFailure(401),
      });
      const results = await adapter.searchAnime("Jujutsu Kaisen");
      expect(results).toEqual([]);
    });

    test("returns empty array on API failure after login", async () => {
      let callCount = 0;
      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        callCount++;
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

      const adapter = new TVDBAdapter({ apiKey: "test-key", fetch });
      const searchResults = await adapter.searchAnime("Unknown");
      expect(searchResults).toEqual([]);
      expect(callCount).toBe(2);
    });

    test("caches login token across multiple API calls", async () => {
      let loginCount = 0;
      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          loginCount++;
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

      const adapter = new TVDBAdapter({ apiKey: "test-key", fetch });
      await adapter.searchAnime("One");
      await adapter.searchAnime("Two");
      expect(loginCount).toBe(1);
    });
  });
});
