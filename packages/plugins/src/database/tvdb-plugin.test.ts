import { describe, expect, test } from "bun:test";
import type { AnimeResult, DatabasePlugin } from "@kogoro/core";
import {
  createCallCounter,
  createMockHttpClient,
  mockJsonFetch,
  toUrlString,
} from "@kogoro/core/testing";
import { TVDBPlugin } from "./tvdb-plugin";

const BASE_URL = "https://api4.thetvdb.com/v4";

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
    const plugin: DatabasePlugin = new TVDBPlugin({
      apiKey: "test-key",
      baseUrl: BASE_URL,
    });
    expect(plugin.searchAnime).toBeInstanceOf(Function);
    expect(plugin.getAnime).toBeInstanceOf(Function);
    expect(plugin.getEpisodes).toBeInstanceOf(Function);
    expect(plugin.getArtwork).toBeInstanceOf(Function);
  });

  describe("searchAnime", () => {
    test("returns matching anime results", async () => {
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
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(searchResponse)),
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
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch([])),
      });
      const results = await plugin.searchAnime("Nonexistent Anime");
      expect(results).toEqual([]);
    });

    test("uses English translation name", async () => {
      const searchResponse = [
        {
          id: 281270,
          slug: "barakamon",
          name: "ばらかもん",
          translations: { eng: "Barakamon" },
          name_translated: "Barakamon",
          aliases: ["Barakamon", "ばらかもん"],
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(searchResponse)),
      });
      const results = await plugin.searchAnime("barakamon");
      expect(results[0]?.titleEn).toBe("Barakamon");
    });

    test("includes Japanese title from aliases", async () => {
      const searchResponse = [
        {
          id: 54321,
          name: "Attack on Titan",
          aliases: ["進撃の巨人", "Shingeki no Kyojin"],
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(searchResponse)),
      });
      const results = await plugin.searchAnime("Attack on Titan");
      expect(results[0]?.titleJa).toBe("進撃の巨人");
    });

    test("normalizes series- prefixed IDs", async () => {
      const searchResponse = [
        {
          id: "series-421069",
          name: "Oshi no Ko",
          year: "2023",
          status: "Continuing",
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(searchResponse)),
      });
      const results = await plugin.searchAnime("Oshi no Ko");

      expect(results).toHaveLength(1);
      expect(results[0]?.id).toBe("421069");
    });

    test("prefers numeric tvdb_id over string ID", async () => {
      const searchResponse = [
        {
          id: "series-421069",
          tvdb_id: "999999",
          name: "Oshi no Ko",
        },
      ];

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(searchResponse)),
      });
      const results = await plugin.searchAnime("Oshi no Ko");

      expect(results[0]?.id).toBe("999999");
    });

    test("falls back to shorter query when full title returns no results", async () => {
      const capturedUrls: string[] = [];
      const searchResponse = [
        {
          id: 429310,
          slug: "zom-100-bucket-list-of-the-dead",
          name: "Zom 100: Bucket List of the Dead",
        },
      ];

      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), {
            status: 200,
          });
        }
        capturedUrls.push(urlStr);
        if (urlStr.includes("Zom%20100%20Bucket%20List%20of%20the%20Dead")) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: searchResponse }), { status: 200 });
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });

      const results = await plugin.searchAnime("Zom 100 Bucket List of the Dead");

      expect(results).toHaveLength(1);
      expect(results[0]?.titleEn).toBe("Zom 100: Bucket List of the Dead");
      expect(capturedUrls).toHaveLength(2);
      expect(capturedUrls[0]).toContain("Zom%20100%20Bucket%20List%20of%20the%20Dead");
      expect(capturedUrls[1]).toContain("Zom%20100");
    });
  });

  describe("getEpisodes", () => {
    test("returns episode results", async () => {
      const episodesResponse = {
        id: 12345,
        name: "Jujutsu Kaisen",
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "Ryomen Sukuna",
            overview: "A boy swallows a cursed finger.",
            aired: "2020-10-03",
            image: "https://artworks.thetvdb.com/episodes/1001.jpg",
            isMovie: 0,
          },
          {
            id: 1002,
            seasonNumber: 1,
            number: 2,
            name: "For Myself",
            overview: "Yuji enrolls at Jujutsu High.",
            aired: "2020-10-10",
            isMovie: 0,
          },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(
          mockFetchWithRoutes({
            "/episodes/default/eng": episodesResponse,
            "/episodes/default/jpn": { id: 12345, episodes: [] },
          }),
        ),
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
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch({ id: 99999, name: "Unknown" })),
      });
      const results = await plugin.getEpisodes("99999");
      expect(results).toEqual([]);
    });

    test("derives movie, tv, and special entry types", async () => {
      const episodesResponse = {
        id: 100,
        name: "Test",
        episodes: [
          { id: 1, seasonNumber: 1, number: 1, name: "TV Eps", isMovie: 0 },
          { id: 2, seasonNumber: 1, number: 1, name: "Movie", isMovie: 1 },
          { id: 3, seasonNumber: 0, number: 1, name: "Special", isMovie: 0 },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(
          mockFetchWithRoutes({
            "/episodes/default/eng": episodesResponse,
            "/episodes/default/jpn": { id: 100, episodes: [] },
          }),
        ),
      });
      const results = await plugin.getEpisodes("100");

      expect(results.find((e) => e.titleEn === "TV Eps")?.entryType).toBe("tv");
      expect(results.find((e) => e.titleEn === "Movie")?.entryType).toBe("movie");
      expect(results.find((e) => e.titleEn === "Special")?.entryType).toBe("special");
    });

    test("fetches all pages of episodes", async () => {
      const page0Response = {
        data: {
          episodes: [
            {
              id: 1,
              seasonNumber: 1,
              number: 1,
              name: "Episode 1",
              isMovie: 0,
            },
          ],
        },
        links: { next: "/series/12345/episodes/default/eng?page=1" },
      };

      const page1Response = {
        data: {
          episodes: [
            {
              id: 2,
              seasonNumber: 1,
              number: 2,
              name: "Episode 2",
              isMovie: 0,
            },
          ],
        },
        links: { next: null },
      };

      const emptyResponse = { data: { episodes: [] } };

      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), { status: 200 });
        }
        if (urlStr.includes("/eng?page=0")) {
          return new Response(JSON.stringify(page0Response), { status: 200 });
        }
        if (urlStr.includes("/eng?page=1")) {
          return new Response(JSON.stringify(page1Response), { status: 200 });
        }
        if (urlStr.includes("/jpn")) {
          return new Response(JSON.stringify(emptyResponse), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(2);
      expect(results[0]?.episode).toBe(1);
      expect(results[0]?.titleEn).toBe("Episode 1");
      expect(results[1]?.episode).toBe(2);
      expect(results[1]?.titleEn).toBe("Episode 2");
    });

    test("stops fetching when a page has no episodes", async () => {
      const pageWithEpisodes = {
        data: {
          episodes: [
            {
              id: 1,
              seasonNumber: 1,
              number: 1,
              name: "Episode 1",
              isMovie: 0,
            },
          ],
        },
        links: { next: "/series/12345/episodes/default/eng?page=1" },
      };

      const emptyPage = {
        data: { episodes: [] as never[] },
        links: { next: "/series/12345/episodes/default/eng?page=2" },
      };

      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), { status: 200 });
        }
        if (urlStr.includes("/eng?page=0")) {
          return new Response(JSON.stringify(pageWithEpisodes), { status: 200 });
        }
        if (urlStr.includes("/eng?page=1")) {
          return new Response(JSON.stringify(emptyPage), { status: 200 });
        }
        if (urlStr.includes("/jpn")) {
          return new Response(JSON.stringify({ data: { episodes: [] } }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(1);
      expect(results[0]?.episode).toBe(1);
    });

    test("stops fetching when last page reached", async () => {
      const singlePage = {
        data: {
          episodes: [
            {
              id: 1,
              seasonNumber: 1,
              number: 1,
              name: "Episode 1",
              isMovie: 0,
            },
          ],
        },
        links: { next: null },
      };

      let enCallCount = 0;
      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), { status: 200 });
        }
        if (urlStr.includes("/eng")) {
          enCallCount++;
          return new Response(JSON.stringify(singlePage), { status: 200 });
        }
        if (urlStr.includes("/jpn")) {
          return new Response(JSON.stringify({ data: { episodes: [] } }), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(1);
      expect(enCallCount).toBe(1);
    });

    test("merges Japanese episode titles into results", async () => {
      const engEpisodesResponse = {
        id: 12345,
        name: "Jujutsu Kaisen",
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "Ryomen Sukuna",
            overview: "A boy swallows a cursed finger.",
            aired: "2020-10-03",
            isMovie: 0,
          },
        ],
      };

      const jpnEpisodesResponse = {
        id: 12345,
        name: "呪術廻戦",
        episodes: [
          {
            id: 1001,
            seasonNumber: 1,
            number: 1,
            name: "両面宿儺",
            overview: "",
            isMovie: 0,
          },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(
          mockFetchWithRoutes({
            "/episodes/default/eng": engEpisodesResponse,
            "/episodes/default/jpn": jpnEpisodesResponse,
          }),
        ),
      });
      const results = await plugin.getEpisodes("12345");

      expect(results).toHaveLength(1);
      expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
      expect(results[0]?.titleJa).toBe("両面宿儺");
    });
  });

  describe("getArtwork", () => {
    test("returns artwork filtered by type", async () => {
      const artworkResponse = {
        artworks: [
          { id: 1, image: "https://example.com/poster1.jpg", type: 1 },
          { id: 2, image: "https://example.com/poster2.jpg", type: 14 },
          { id: 3, image: "https://example.com/fanart.jpg", type: 2 },
          { id: 4, image: "https://example.com/banner.jpg", type: 3 },
          { id: 5, image: "https://example.com/thumb.jpg", type: 99 },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(artworkResponse)),
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
      const artworkResponse = {
        artworks: [{ id: 1, image: "https://example.com/banner.jpg", type: 3 }],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(artworkResponse)),
      });
      const results = await plugin.getArtwork("12345", "fanart");
      expect(results).toEqual([]);
    });

    test("includes width and height in artwork results", async () => {
      const artworkResponse = {
        artworks: [
          { id: 1, image: "https://example.com/poster.jpg", type: 1, width: 680, height: 1000 },
          { id: 2, image: "https://example.com/poster2.jpg", type: 14, width: 900, height: 1280 },
        ],
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch(artworkResponse)),
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
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockFetch({ artworks: [] })),
      });
      const results = await plugin.getArtwork("12345", "poster");
      expect(results).toEqual([]);
    });
  });

  describe("getAnime", () => {
    test("returns anime details with translated names", async () => {
      const seriesResponse = {
        id: 12345,
        slug: "jujutsu-kaisen",
        name: "呪術廻戦",
        aliases: [
          { name: "Jujutsu Kaisen", lang: "eng" },
          { name: "呪術廻戦", lang: "jpn" },
        ],
        image: "https://artworks.thetvdb.com/series/12345/poster.jpg",
        year: "2020",
        overview: "呪術廻戦の概要",
        status: "Continuing",
      };

      const enTranslation = {
        name: "Jujutsu Kaisen",
        overview: "A boy fights curses.",
        language: "eng",
      };

      const jpnTranslation = { name: "呪術廻戦", language: "jpn" };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(
          mockFetchWithRoutes({
            "/series/12345/translations/eng": enTranslation,
            "/series/12345/translations/jpn": jpnTranslation,
            "/series/12345": seriesResponse,
          }),
        ),
      });
      const result = await plugin.getAnime("12345");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("12345");
      expect(result?.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.titleJa).toBe("呪術廻戦");
      expect(result?.slug).toBe("jujutsu-kaisen");
      expect(result?.overview).toBe("A boy fights curses.");
      expect(result?.year).toBe(2020);
      expect(result?.image).toBe("https://artworks.thetvdb.com/series/12345/poster.jpg");
      expect(result?.status).toBe("Continuing");
      expect(result?.entryType).toBe("tv");
    });

    test("uses alias names when translations unavailable", async () => {
      const seriesResponse = {
        id: 12345,
        slug: "jujutsu-kaisen",
        name: "呪術廻戦",
        aliases: [
          { name: "Jujutsu Kaisen", lang: "eng" },
          { name: "呪術廻戦", lang: "jpn" },
        ],
        image: "https://artworks.thetvdb.com/series/12345/poster.jpg",
        year: "2020",
        overview: "A boy fights curses.",
        status: "Continuing",
      };

      const fetch = async (url: string | URL, _init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock-token" } }), {
            status: 200,
          });
        }
        if (urlStr.includes("/translations")) {
          return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
        }
        return new Response(JSON.stringify({ data: seriesResponse }), { status: 200 });
      };

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      const result = await plugin.getAnime("12345");

      expect(result).not.toBeNull();
      expect(result?.titleEn).toBe("Jujutsu Kaisen");
      expect(result?.titleJa).toBe("呪術廻戦");
      expect(result?.overview).toBe("A boy fights curses.");
    });

    test("returns null when anime ID does not exist", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockJsonFetch({ error: "Unauthorized" }, 404)),
      });
      const result = await plugin.getAnime("99999");
      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    test("returns empty array on login failure", async () => {
      const plugin = new TVDBPlugin({
        apiKey: "bad-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(mockJsonFetch({ error: "Unauthorized" }, 401)),
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

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      const searchResults = await plugin.searchAnime("Unknown");
      expect(searchResults).toEqual([]);
      expect(fetchCalls.get()).toBe(2);
    });

    test("reuses login token across requests", async () => {
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

      const plugin = new TVDBPlugin({
        apiKey: "test-key",
        baseUrl: BASE_URL,
        httpClient: createMockHttpClient(fetch),
      });
      await plugin.searchAnime("One");
      await plugin.searchAnime("Two");
      expect(loginCalls.get()).toBe(1);
    });
  });
});
