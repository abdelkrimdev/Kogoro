import { describe, expect, test } from "bun:test";
import type { TrackerPlugin } from "@kogoro/core";
import { createMockHttpClient, toUrlString } from "@kogoro/core/testing";
import { KitsuPlugin } from "./kitsu-plugin";

const BASE_URL = "https://kitsu.io/api/edge";
const OAUTH_URL = "https://kitsu.io/api/oauth";

function mockFetchWithRoutes(
  routes: Record<string, { data: unknown; status?: number }>,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (url: string | URL, _init?: RequestInit) => {
    const urlStr = toUrlString(url);
    for (const [path, { data, status = 200 }] of Object.entries(routes)) {
      if (urlStr.includes(path)) {
        return new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/vnd.api+json" },
        });
      }
    }
    return new Response(JSON.stringify({ errors: [{ title: "Not Found" }] }), {
      status: 404,
      headers: { "Content-Type": "application/vnd.api+json" },
    });
  };
}

describe("KitsuPlugin", () => {
  test("satisfies TrackerPlugin contract", () => {
    const plugin: TrackerPlugin = new KitsuPlugin({
      baseUrl: BASE_URL,
      oauthUrl: OAUTH_URL,
    });
    expect(plugin.authenticate).toBeInstanceOf(Function);
    expect(plugin.getUserList).toBeInstanceOf(Function);
    expect(plugin.getEntry).toBeInstanceOf(Function);
    expect(plugin.updateEntry).toBeInstanceOf(Function);
    expect(plugin.getAnimeDetails).toBeInstanceOf(Function);
  });

  describe("authenticate", () => {
    test("exchanges credentials for access token", async () => {
      const oauthResponse = {
        access_token: "test-access-token-abc",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "test-refresh-token",
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: oauthResponse },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "user@example.com",
        password: "secret123",
      });

      const token = await plugin.authenticate();
      expect(token).toBe("test-access-token-abc");
    });

    test("throws on invalid credentials", async () => {
      const fetch = mockFetchWithRoutes({
        "/oauth/token": {
          data: {
            error: "invalid_grant",
            error_description: "The resource owner or authorization server denied the request.",
          },
          status: 401,
        },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "bad@example.com",
        password: "wrong",
      });

      await expect(plugin.authenticate()).rejects.toThrow();
    });
  });

  describe("getUserList", () => {
    test("returns mapped TrackerAnime from library entries", async () => {
      const userResponse = {
        data: [
          {
            id: "42",
            type: "users",
            attributes: { name: "TestUser" },
          },
        ],
      };

      const libraryResponse = {
        data: [
          {
            id: "1001",
            type: "libraryEntries",
            attributes: {
              status: "current",
              progress: 12,
              ratingTwenty: 8,
            },
            relationships: {
              anime: {
                data: { type: "anime", id: "678" },
              },
            },
          },
          {
            id: "1002",
            type: "libraryEntries",
            attributes: {
              status: "completed",
              progress: 24,
              ratingTwenty: 10,
            },
            relationships: {
              anime: {
                data: { type: "anime", id: "679" },
              },
            },
          },
        ],
        included: [
          {
            id: "678",
            type: "anime",
            attributes: {
              canonicalTitle: "Jujutsu Kaisen",
              episodeCount: 24,
              startDate: "2020-10-03",
              subtype: "tv",
              posterImage: { original: "https://example.com/jjk.jpg" },
            },
          },
          {
            id: "679",
            type: "anime",
            attributes: {
              canonicalTitle: "Attack on Titan",
              episodeCount: 87,
              startDate: "2013-04-07",
              subtype: "tv",
              posterImage: { original: "https://example.com/aot.jpg" },
            },
          },
        ],
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: { access_token: "token-123" } },
        "filter[self]=true": { data: userResponse },
        "library-entries": { data: libraryResponse },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "user@example.com",
        password: "pass",
      });

      await plugin.authenticate();
      const list = await plugin.getUserList();

      expect(list).toHaveLength(2);
      expect(list[0]?.trackerId).toBe("1001");
      expect(list[0]?.title).toBe("Jujutsu Kaisen");
      expect(list[0]?.watchStatus).toBe("watching");
      expect(list[0]?.episodesWatched).toBe(12);
      expect(list[0]?.totalEpisodes).toBe(24);
      expect(list[0]?.score).toBe(4);
      expect(list[0]?.entryType).toBe("tv");
      expect(list[0]?.image).toBe("https://example.com/jjk.jpg");

      expect(list[1]?.trackerId).toBe("1002");
      expect(list[1]?.title).toBe("Attack on Titan");
      expect(list[1]?.watchStatus).toBe("completed");
      expect(list[1]?.episodesWatched).toBe(24);
      expect(list[1]?.totalEpisodes).toBe(87);
    });

    test("maps all Kitsu statuses to domain statuses", async () => {
      const statusMap = [
        { kitsu: "current", domain: "watching" },
        { kitsu: "completed", domain: "completed" },
        { kitsu: "on_hold", domain: "on-hold" },
        { kitsu: "dropped", domain: "dropped" },
        { kitsu: "planned", domain: "plan-to-watch" },
      ] as const;

      for (const { kitsu, domain } of statusMap) {
        const userResponse = {
          data: [{ id: "1", type: "users", attributes: { name: "u" } }],
        };

        const libraryResponse = {
          data: [
            {
              id: "e1",
              type: "libraryEntries",
              attributes: { status: kitsu, progress: 0, ratingTwenty: null },
              relationships: { anime: { data: { type: "anime", id: "a1" } } },
            },
          ],
          included: [
            {
              id: "a1",
              type: "anime",
              attributes: {
                canonicalTitle: "Test",
                subtype: "tv",
                episodeCount: 12,
              },
            },
          ],
        };

        const fetch = mockFetchWithRoutes({
          "/oauth/token": { data: { access_token: "t" } },
          "filter[self]=true": { data: userResponse },
          "library-entries": { data: libraryResponse },
        });

        const plugin = new KitsuPlugin({
          baseUrl: BASE_URL,
          oauthUrl: OAUTH_URL,
          httpClient: createMockHttpClient(fetch),
          username: "u",
          password: "p",
        });

        await plugin.authenticate();
        const list = await plugin.getUserList();
        expect(list[0]?.watchStatus).toBe(domain);
      }
    });

    test("converts Kitsu integer IDs to strings", async () => {
      const userResponse = {
        data: [{ id: 42, type: "users", attributes: { name: "u" } }],
      };

      const libraryResponse = {
        data: [
          {
            id: 12345,
            type: "libraryEntries",
            attributes: { status: "current", progress: 1, ratingTwenty: null },
            relationships: { anime: { data: { type: "anime", id: 67890 } } },
          },
        ],
        included: [
          {
            id: 67890,
            type: "anime",
            attributes: { canonicalTitle: "Test", subtype: "tv", episodeCount: 1 },
          },
        ],
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: { access_token: "t" } },
        "filter[self]=true": { data: userResponse },
        "library-entries": { data: libraryResponse },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "u",
        password: "p",
      });

      await plugin.authenticate();
      const list = await plugin.getUserList();
      expect(list[0]?.trackerId).toBe("12345");
    });
  });

  describe("getEntry", () => {
    test("returns single library entry", async () => {
      const entryResponse = {
        data: {
          id: "1001",
          type: "libraryEntries",
          attributes: {
            status: "current",
            progress: 5,
            ratingTwenty: 6,
            notes: "Great show",
          },
          relationships: {
            anime: { data: { type: "anime", id: "678" } },
          },
        },
        included: [
          {
            id: "678",
            type: "anime",
            attributes: {
              canonicalTitle: "Spy x Family",
              episodeCount: 37,
              subtype: "tv",
            },
          },
        ],
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: { access_token: "t" } },
        "library-entries/1001": { data: entryResponse },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "u",
        password: "p",
      });

      await plugin.authenticate();
      const entry = await plugin.getEntry("1001");

      expect(entry.trackerId).toBe("1001");
      expect(entry.title).toBe("Spy x Family");
      expect(entry.watchStatus).toBe("watching");
      expect(entry.episodesWatched).toBe(5);
      expect(entry.totalEpisodes).toBe(37);
      expect(entry.score).toBe(3);
      expect(entry.notes).toBe("Great show");
    });
  });

  describe("updateEntry", () => {
    test("PATCHes status and progress", async () => {
      let patchBody: string | undefined;
      let patchUrl: string | undefined;

      const fetch = async (url: string | URL, init?: RequestInit) => {
        const urlStr = toUrlString(url);
        if (urlStr.includes("/oauth/token")) {
          return new Response(JSON.stringify({ access_token: "t" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (init?.method === "PATCH") {
          patchBody = init.body as string;
          patchUrl = urlStr;
          return new Response(JSON.stringify({ data: { id: "1001", type: "libraryEntries" } }), {
            status: 200,
            headers: { "Content-Type": "application/vnd.api+json" },
          });
        }
        return new Response(JSON.stringify({ errors: [{ title: "Not Found" }] }), { status: 404 });
      };

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "u",
        password: "p",
      });

      await plugin.authenticate();
      await plugin.updateEntry("1001", {
        watchStatus: "completed",
        episodesWatched: 24,
      });

      expect(patchUrl).toContain("/library-entries/1001");
      const body = JSON.parse(patchBody ?? "{}") as {
        data: { attributes: { status: string; progress: number } };
      };
      expect(body.data.attributes.status).toBe("completed");
      expect(body.data.attributes.progress).toBe(24);
    });
  });

  describe("getAnimeDetails", () => {
    test("returns enriched anime details with synopsis and rating", async () => {
      const animeResponse = {
        data: {
          id: "678",
          type: "anime",
          attributes: {
            canonicalTitle: "Jujutsu Kaisen",
            titles: { en_jp: "Jujutsu Kaisen", ja_jp: "呪術廻戦" },
            episodeCount: 24,
            startDate: "2020-10-03",
            subtype: "tv",
            synopsis: "A boy swallows a cursed finger.",
            averageRating: "85.2",
            posterImage: { original: "https://example.com/jjk.jpg" },
          },
        },
        included: [
          {
            id: "cat1",
            type: "categories",
            attributes: { title: "Action" },
          },
          {
            id: "cat2",
            type: "categories",
            attributes: { title: "Supernatural" },
          },
        ],
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: { access_token: "t" } },
        "anime/678": { data: animeResponse },
      });

      const plugin = new KitsuPlugin({
        baseUrl: BASE_URL,
        oauthUrl: OAUTH_URL,
        httpClient: createMockHttpClient(fetch),
        username: "u",
        password: "p",
      });

      await plugin.authenticate();
      const details = await plugin.getAnimeDetails("678");

      expect(details.trackerId).toBe("678");
      expect(details.title).toBe("Jujutsu Kaisen");
      expect(details.synopsis).toBe("A boy swallows a cursed finger.");
      expect(details.rating).toBe(85.2);
      expect(details.genres).toEqual(["Action", "Supernatural"]);
      expect(details.totalEpisodes).toBe(24);
      expect(details.image).toBe("https://example.com/jjk.jpg");
      expect(details.entryType).toBe("tv");
    });
  });
});
