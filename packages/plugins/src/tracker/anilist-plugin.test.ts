import { describe, expect, test } from "bun:test";
import type { EntryType, TrackerPlugin, TrackerWatchStatus } from "@kogoro/core";
import { CredentialStore, TrackerError } from "@kogoro/core";
import {
  createMockHttpClient,
  createMockKeytar,
  toUrlString,
  withTestConfig,
} from "@kogoro/core/testing";
import { AniListPlugin } from "./anilist-plugin";

const GRAPHQL_URL = "https://graphql.anilist.co";

function createPlugin(
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>,
  token?: string,
): AniListPlugin {
  return new AniListPlugin({
    baseUrl: GRAPHQL_URL,
    token,
    httpClient: createMockHttpClient(fetch),
  });
}

function mockGraphQLFetch(
  resolver: (body: { query: string; variables?: Record<string, unknown> }) => unknown,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (url: string | URL, init?: RequestInit) => {
    const urlStr = toUrlString(url);
    if (urlStr !== GRAPHQL_URL) {
      return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    }
    const body = JSON.parse(init?.body as string) as {
      query: string;
      variables?: Record<string, unknown>;
    };
    try {
      const data = resolver(body);
      return new Response(JSON.stringify({ data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ errors: [{ message: String(err) }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

function mockGraphQLFetchWithViewer(
  viewerId: number,
  resolver: (body: { query: string; variables?: Record<string, unknown> }) => unknown,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  const baseFetch = mockGraphQLFetch(resolver);
  return async (url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { query: string };
    if (body.query.includes("Viewer")) {
      return new Response(JSON.stringify({ data: { Viewer: { id: viewerId } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return baseFetch(url, init);
  };
}

describe("AniListPlugin", () => {
  test("satisfies TrackerPlugin contract", () => {
    const plugin: TrackerPlugin = createPlugin(mockGraphQLFetch(() => ({})));
    expect(plugin.authenticate).toBeInstanceOf(Function);
    expect(plugin.getUserList).toBeInstanceOf(Function);
    expect(plugin.getEntry).toBeInstanceOf(Function);
    expect(plugin.updateEntry).toBeInstanceOf(Function);
    expect(plugin.getAnimeDetails).toBeInstanceOf(Function);
  });

  describe("authenticate", () => {
    test("returns stored token from credential store", async () => {
      const plugin = createPlugin(
        mockGraphQLFetch(() => ({})),
        "stored-anilist-token",
      );
      const token = await plugin.authenticate();
      expect(token).toBe("stored-anilist-token");
    });

    test("throws when no token is available", async () => {
      const plugin = createPlugin(mockGraphQLFetch(() => ({})));
      await expect(plugin.authenticate()).rejects.toThrow(TrackerError);
    });

    test("includes Authorization header when token is set", async () => {
      let capturedHeaders: Record<string, string> = {};

      const baseFetch = mockGraphQLFetchWithViewer(1, () => ({
        MediaListCollection: { lists: [] },
      }));
      const fetch: typeof baseFetch = async (url, init) => {
        capturedHeaders = Object.fromEntries(new Headers(init?.headers).entries());
        return baseFetch(url, init);
      };

      const plugin = createPlugin(fetch, "my-anilist-token");
      await plugin.getUserList();

      expect(capturedHeaders["authorization"]).toBe("Bearer my-anilist-token");
    });

    test("throws when making request without token", async () => {
      const plugin = createPlugin(mockGraphQLFetch(() => ({})));
      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });
  });

  describe("exchangeCode", () => {
    test("exchanges OAuth pin/code for access token and stores it", async () => {
      await withTestConfig("anilist-exchange-code", async (_dir, _config, credentialStore) => {
        let capturedUrl = "";
        let capturedBody: Record<string, string> | undefined;

        const mockFetch = async (url: string | URL, init?: RequestInit) => {
          capturedUrl = toUrlString(url);
          capturedBody = JSON.parse(init?.body as string);
          return new Response(
            JSON.stringify({
              access_token: "exchanged-access-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        };

        const plugin = new AniListPlugin({
          baseUrl: GRAPHQL_URL,
          clientId: "my-client-id",
          clientSecret: "my-client-secret",
          credentialStore,
          httpClient: createMockHttpClient(mockFetch),
        });

        const result = await plugin.exchangeCode("my-pin-code");
        expect(result.access_token).toBe("exchanged-access-token");
        expect(capturedUrl).toBe("https://anilist.co/api/v2/oauth/token");
        expect(capturedBody).toEqual({
          grant_type: "authorization_code",
          client_id: "my-client-id",
          client_secret: "my-client-secret",
          redirect_uri: "http://localhost:43219/callback/anilist",
          code: "my-pin-code",
        });

        const storedToken = await credentialStore.getCredential("anilist");
        expect(storedToken).toBeDefined();
        const parsed = JSON.parse(storedToken ?? "{}");
        expect(parsed.access_token).toBe("exchanged-access-token");
      });
    });

    test("throws meaningful error on exchange failure", async () => {
      await withTestConfig("anilist-exchange-fail", async (_dir, _config, credentialStore) => {
        const mockFetch = async () => {
          return new Response(
            JSON.stringify({ error: "invalid_grant", message: "Invalid authorization code" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        };

        const plugin = new AniListPlugin({
          baseUrl: GRAPHQL_URL,
          clientId: "my-client-id",
          clientSecret: "my-client-secret",
          credentialStore,
          httpClient: createMockHttpClient(mockFetch),
        });

        await expect(plugin.exchangeCode("bad-pin")).rejects.toThrow(TrackerError);
      });
    });
  });

  describe("getUserList", () => {
    test("returns mapped TrackerAnime array from user list", async () => {
      const listResponse = {
        MediaListCollection: {
          lists: [
            {
              entries: [
                {
                  mediaId: 12345,
                  status: "CURRENT",
                  score: 8,
                  progress: 12,
                  media: {
                    title: {
                      romaji: "Shingeki no Kyojin",
                      english: "Attack on Titan",
                      native: "進撃の巨人",
                    },
                    coverImage: {
                      large:
                        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx12345-abc.jpg",
                    },
                    startDate: { year: 2013 },
                    format: "TV",
                    episodes: 25,
                    synonyms: ["AoT"],
                  },
                },
                {
                  mediaId: 67890,
                  status: "COMPLETED",
                  score: 9,
                  progress: 24,
                  media: {
                    title: {
                      romaji: "Fullmetal Alchemist: Brotherhood",
                      english: "Fullmetal Alchemist: Brotherhood",
                      native: "鋼の錬金術師 FULLMETAL ALCHEMIST",
                    },
                    coverImage: {
                      large:
                        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx67890-def.jpg",
                    },
                    startDate: { year: 2009 },
                    format: "TV",
                    episodes: 64,
                    synonyms: [],
                  },
                },
              ],
            },
          ],
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetchWithViewer(12345, () => listResponse),
        "test-token",
      );
      const results = await plugin.getUserList();

      expect(results).toHaveLength(2);

      expect(results[0]?.trackerId).toBe("12345");
      expect(results[0]?.title).toBe("Attack on Titan");
      expect(results[0]?.alternativeTitles).toContain("Shingeki no Kyojin");
      expect(results[0]?.alternativeTitles).toContain("AoT");
      expect(results[0]?.image).toBe(
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx12345-abc.jpg",
      );
      expect(results[0]?.year).toBe(2013);
      expect(results[0]?.entryType).toBe("tv");
      expect(results[0]?.watchStatus).toBe("watching");
      expect(results[0]?.episodesWatched).toBe(12);
      expect(results[0]?.totalEpisodes).toBe(25);
      expect(results[0]?.score).toBe(8);

      expect(results[1]?.trackerId).toBe("67890");
      expect(results[1]?.title).toBe("Fullmetal Alchemist: Brotherhood");
      expect(results[1]?.watchStatus).toBe("completed");
      expect(results[1]?.episodesWatched).toBe(24);
      expect(results[1]?.totalEpisodes).toBe(64);
      expect(results[1]?.score).toBe(9);
    });

    test("maps all AniList statuses to domain types", async () => {
      const statusMap: Array<[string, TrackerWatchStatus]> = [
        ["CURRENT", "watching"],
        ["COMPLETED", "completed"],
        ["PLANNING", "plan-to-watch"],
        ["PAUSED", "on-hold"],
        ["DROPPED", "dropped"],
      ];

      for (const [anilistStatus, expectedStatus] of statusMap) {
        const listResponse = {
          MediaListCollection: {
            lists: [
              {
                entries: [
                  {
                    mediaId: 1,
                    status: anilistStatus,
                    score: 0,
                    progress: 0,
                    media: {
                      title: { romaji: "Test", english: null, native: null },
                      coverImage: { large: null },
                      startDate: { year: null },
                      format: "TV",
                      episodes: 12,
                      synonyms: [],
                    },
                  },
                ],
              },
            ],
          },
        };

        const plugin = createPlugin(
          mockGraphQLFetchWithViewer(1, () => listResponse),
          "test-token",
        );
        const results = await plugin.getUserList();
        expect(results[0]?.watchStatus).toBe(expectedStatus);
      }
    });

    test("maps AniList formats to domain entry types", async () => {
      const formatMap: Array<[string, EntryType]> = [
        ["TV", "tv"],
        ["MOVIE", "movie"],
        ["OVA", "ova"],
        ["SPECIAL", "special"],
      ];

      for (const [format, expectedType] of formatMap) {
        const listResponse = {
          MediaListCollection: {
            lists: [
              {
                entries: [
                  {
                    mediaId: 1,
                    status: "CURRENT",
                    score: 0,
                    progress: 0,
                    media: {
                      title: { romaji: "Test", english: null, native: null },
                      coverImage: { large: null },
                      startDate: { year: null },
                      format,
                      episodes: 12,
                      synonyms: [],
                    },
                  },
                ],
              },
            ],
          },
        };

        const plugin = createPlugin(
          mockGraphQLFetchWithViewer(1, () => listResponse),
          "test-token",
        );
        const results = await plugin.getUserList();
        expect(results[0]?.entryType).toBe(expectedType);
      }
    });

    test("returns empty array when user has no entries", async () => {
      const listResponse = {
        MediaListCollection: {
          lists: [],
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetchWithViewer(1, () => listResponse),
        "test-token",
      );
      const results = await plugin.getUserList();
      expect(results).toEqual([]);
    });

    test("returns empty array on GraphQL error", async () => {
      const plugin = createPlugin(
        mockGraphQLFetchWithViewer(1, () => {
          throw new Error("Not Authenticated");
        }),
        "test-token",
      );

      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });

    test("collects entries from multiple lists", async () => {
      const listResponse = {
        MediaListCollection: {
          lists: [
            {
              entries: [
                {
                  mediaId: 1,
                  status: "CURRENT",
                  score: 8,
                  progress: 5,
                  media: {
                    title: { romaji: "Watching", english: null, native: null },
                    coverImage: { large: null },
                    startDate: { year: 2024 },
                    format: "TV",
                    episodes: 12,
                    synonyms: [],
                  },
                },
              ],
            },
            {
              entries: [
                {
                  mediaId: 2,
                  status: "COMPLETED",
                  score: 10,
                  progress: 24,
                  media: {
                    title: { romaji: "Completed", english: null, native: null },
                    coverImage: { large: null },
                    startDate: { year: 2023 },
                    format: "TV",
                    episodes: 24,
                    synonyms: [],
                  },
                },
              ],
            },
          ],
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetchWithViewer(1, () => listResponse),
        "test-token",
      );
      const results = await plugin.getUserList();
      expect(results).toHaveLength(2);
      expect(results[0]?.title).toBe("Watching");
      expect(results[1]?.title).toBe("Completed");
    });

    test("returns empty array when getUserList receives non-ok response", async () => {
      const fetch = async () => {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "bad-token");

      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });
  });

  describe("getEntry", () => {
    test("returns TrackerEntry for a given mediaListEntry id", async () => {
      const entryResponse = {
        MediaList: {
          id: 999,
          mediaId: 12345,
          status: "CURRENT",
          score: 8,
          progress: 12,
          media: {
            title: {
              romaji: "Shingeki no Kyojin",
              english: "Attack on Titan",
            },
            episodes: 25,
          },
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => entryResponse),
        "test-token",
      );
      const entry = await plugin.getEntry("999");

      expect(entry.trackerId).toBe("999");
      expect(entry.title).toBe("Attack on Titan");
      expect(entry.watchStatus).toBe("watching");
      expect(entry.episodesWatched).toBe(12);
      expect(entry.totalEpisodes).toBe(25);
      expect(entry.score).toBe(8);
    });

    test("uses english title when available", async () => {
      const entryResponse = {
        MediaList: {
          id: 1,
          mediaId: 100,
          status: "COMPLETED",
          score: 9,
          progress: 24,
          media: {
            title: {
              romaji: "日本語タイトル",
              english: "English Title",
            },
            episodes: 24,
          },
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => entryResponse),
        "test-token",
      );
      const entry = await plugin.getEntry("1");
      expect(entry.title).toBe("English Title");
    });

    test("falls back to romaji title when english is null", async () => {
      const entryResponse = {
        MediaList: {
          id: 1,
          mediaId: 100,
          status: "CURRENT",
          score: 0,
          progress: 5,
          media: {
            title: {
              romaji: "Romaji Only",
              english: null,
            },
            episodes: 12,
          },
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => entryResponse),
        "test-token",
      );
      const entry = await plugin.getEntry("1");
      expect(entry.title).toBe("Romaji Only");
    });

    test("maps privateNotes to notes field", async () => {
      const entryResponse = {
        MediaList: {
          id: 1,
          mediaId: 100,
          status: "CURRENT",
          score: 0,
          progress: 5,
          privateNotes: "my note",
          media: {
            title: { romaji: "Test", english: null },
            episodes: 12,
          },
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => entryResponse),
        "test-token",
      );
      const entry = await plugin.getEntry("1");
      expect(entry.notes).toBe("my note");
    });

    test("maps null privateNotes to undefined notes", async () => {
      const entryResponse = {
        MediaList: {
          id: 1,
          mediaId: 100,
          status: "CURRENT",
          score: 0,
          progress: 5,
          privateNotes: null,
          media: {
            title: { romaji: "Test", english: null },
            episodes: 12,
          },
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => entryResponse),
        "test-token",
      );
      const entry = await plugin.getEntry("1");
      expect(entry.notes).toBeUndefined();
    });
  });

  describe("updateEntry", () => {
    test("sends SaveMediaListEntry mutation with status", async () => {
      let capturedBody: string | undefined;

      const fetch = async (_url: string | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            data: {
              SaveMediaListEntry: {
                id: 999,
                status: "COMPLETED",
                score: 9,
                progress: 25,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const plugin = createPlugin(fetch, "test-token");

      await plugin.updateEntry("999", {
        watchStatus: "completed",
        episodesWatched: 25,
        score: 9,
      });

      expect(capturedBody).toBeDefined();
      const body = JSON.parse(capturedBody as string);
      expect(body.query).toContain("SaveMediaListEntry");
      expect(body.variables.id).toBe(999);
      expect(body.variables.status).toBe("COMPLETED");
      expect(body.variables.progress).toBe(25);
      expect(body.variables.scoreRaw).toBe(900);
    });

    test("sends only provided fields", async () => {
      let capturedBody: string | undefined;

      const fetch = async (_url: string | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(
          JSON.stringify({
            data: {
              SaveMediaListEntry: {
                id: 999,
                status: "CURRENT",
                progress: 13,
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      };

      const plugin = createPlugin(fetch, "test-token");

      await plugin.updateEntry("999", { episodesWatched: 13 });

      const body = JSON.parse(capturedBody as string);
      expect(body.variables.id).toBe(999);
      expect(body.variables.progress).toBe(13);
      expect(body.variables).not.toHaveProperty("status");
      expect(body.variables).not.toHaveProperty("scoreRaw");
    });

    test("maps domain watch status to AniList status", async () => {
      const statusMap: Array<[string, string]> = [
        ["watching", "CURRENT"],
        ["completed", "COMPLETED"],
        ["plan-to-watch", "PLANNING"],
        ["on-hold", "PAUSED"],
        ["dropped", "DROPPED"],
      ];

      for (const [domainStatus, anilistStatus] of statusMap) {
        let capturedBody: string | undefined;
        const fetch = async (_url: string | URL, init?: RequestInit) => {
          capturedBody = init?.body as string;
          return new Response(JSON.stringify({ data: { SaveMediaListEntry: { id: 1 } } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        };

        const plugin = createPlugin(fetch, "test-token");

        await plugin.updateEntry("1", { watchStatus: domainStatus as TrackerWatchStatus });
        const body = JSON.parse(capturedBody as string);
        expect(body.variables.status).toBe(anilistStatus);
      }
    });

    test("multiplies score by 100 for AniList scoreRaw", async () => {
      let capturedBody: string | undefined;
      const fetch = async (_url: string | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ data: { SaveMediaListEntry: { id: 1 } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await plugin.updateEntry("1", { score: 7 });
      const body = JSON.parse(capturedBody as string);
      expect(body.variables.scoreRaw).toBe(700);
    });

    test("sends privateNotes when notes is provided", async () => {
      let capturedBody: string | undefined;
      const fetch = async (_url: string | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ data: { SaveMediaListEntry: { id: 1 } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await plugin.updateEntry("1", { notes: "my note" });
      const body = JSON.parse(capturedBody as string);
      expect(body.variables.privateNotes).toBe("my note");
    });

    test("sends privateNotes alongside other fields", async () => {
      let capturedBody: string | undefined;
      const fetch = async (_url: string | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return new Response(JSON.stringify({ data: { SaveMediaListEntry: { id: 1 } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await plugin.updateEntry("1", {
        watchStatus: "completed",
        episodesWatched: 25,
        notes: "finale was great",
      });
      const body = JSON.parse(capturedBody as string);
      expect(body.variables.status).toBe("COMPLETED");
      expect(body.variables.progress).toBe(25);
      expect(body.variables.privateNotes).toBe("finale was great");
    });
  });

  describe("getAnimeDetails", () => {
    test("returns mapped TrackerAnimeDetails from Media query", async () => {
      const mediaResponse = {
        Media: {
          id: 12345,
          title: {
            romaji: "Shingeki no Kyojin",
            english: "Attack on Titan",
            native: "進撃の巨人",
          },
          synonyms: ["AoT", "Attack on Titan (anime)"],
          description: "Centuries ago, mankind was slaughtered...",
          averageScore: 85,
          genres: ["Action", "Drama", "Fantasy"],
          studios: {
            nodes: [{ name: "MAPPA" }, { name: "Wit Studio" }],
          },
          coverImage: {
            large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx12345-abc.jpg",
          },
          startDate: { year: 2013 },
          format: "TV",
          episodes: 25,
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => mediaResponse),
        "test-token",
      );
      const details = await plugin.getAnimeDetails("12345");

      expect(details.trackerId).toBe("12345");
      expect(details.title).toBe("Attack on Titan");
      expect(details.alternativeTitles).toContain("Shingeki no Kyojin");
      expect(details.alternativeTitles).toContain("AoT");
      expect(details.image).toBe(
        "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx12345-abc.jpg",
      );
      expect(details.year).toBe(2013);
      expect(details.entryType).toBe("tv");
      expect(details.synopsis).toBe("Centuries ago, mankind was slaughtered...");
      expect(details.rating).toBe(85);
      expect(details.genres).toEqual(["Action", "Drama", "Fantasy"]);
      expect(details.studio).toBe("MAPPA");
      expect(details.totalEpisodes).toBe(25);
    });

    test("uses first studio name", async () => {
      const mediaResponse = {
        Media: {
          id: 1,
          title: { romaji: "Test", english: null, native: null },
          synonyms: [],
          description: "Test description",
          averageScore: 70,
          genres: ["Action"],
          studios: {
            nodes: [{ name: "Studio A" }, { name: "Studio B" }],
          },
          coverImage: { large: null },
          startDate: { year: 2020 },
          format: "MOVIE",
          episodes: 1,
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => mediaResponse),
        "test-token",
      );
      const details = await plugin.getAnimeDetails("1");
      expect(details.studio).toBe("Studio A");
      expect(details.entryType).toBe("movie");
    });

    test("handles missing optional fields", async () => {
      const mediaResponse = {
        Media: {
          id: 1,
          title: { romaji: "Minimal", english: null, native: null },
          synonyms: [],
          description: null,
          averageScore: null,
          genres: [],
          studios: { nodes: [] },
          coverImage: { large: null },
          startDate: { year: null },
          format: "TV",
          episodes: null,
        },
      };

      const plugin = createPlugin(
        mockGraphQLFetch(() => mediaResponse),
        "test-token",
      );
      const details = await plugin.getAnimeDetails("1");

      expect(details.trackerId).toBe("1");
      expect(details.title).toBe("Minimal");
      expect(details.synopsis).toBeUndefined();
      expect(details.rating).toBeUndefined();
      expect(details.genres).toEqual([]);
      expect(details.studio).toBeUndefined();
      expect(details.totalEpisodes).toBeUndefined();
      expect(details.image).toBeUndefined();
      expect(details.year).toBeUndefined();
    });
  });

  describe("refreshSession", () => {
    test("throws TrackerError indicating re-authentication is required", async () => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const expiredCredential = JSON.stringify({
        access_token: "expired-token",
        expires_at: Date.now() - 1000, // Expired
      });
      await store.setCredential("anilist", expiredCredential);

      const plugin = new AniListPlugin({
        baseUrl: GRAPHQL_URL,
        credentialStore: store,
        httpClient: createMockHttpClient(async () => new Response("{}", { status: 200 })),
      });

      await expect(plugin.refreshSession?.()).rejects.toThrow(TrackerError);
      await expect(plugin.refreshSession?.()).rejects.toThrow("re-authenticate");
    });

    test("authenticate throws TrackerError for expired token", async () => {
      const store = new CredentialStore({ keytar: createMockKeytar() });
      const expiredCredential = JSON.stringify({
        access_token: "expired-token",
        expires_at: Date.now() - 1000, // Expired
      });
      await store.setCredential("anilist", expiredCredential);

      const plugin = new AniListPlugin({
        baseUrl: GRAPHQL_URL,
        credentialStore: store,
        httpClient: createMockHttpClient(async () => new Response("{}", { status: 200 })),
      });

      await expect(plugin.authenticate()).rejects.toThrow(TrackerError);
    });
  });

  describe("graphql error handling", () => {
    test("throws TrackerError with rate_limited type for 429 responses", async () => {
      const fetch = async () => {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await expect(plugin.getUserList()).rejects.toThrow(
        expect.objectContaining({ type: "rate_limited" }),
      );
    });

    test("throws TrackerError for 500 server errors", async () => {
      const fetch = async () => {
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });

    test("throws TrackerError for 403 forbidden errors", async () => {
      const fetch = async () => {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      };

      const plugin = createPlugin(fetch, "test-token");

      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });

    test("throws TrackerError when response is 200 but GraphQL errors are present", async () => {
      const fetch = async () => {
        return new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: "Not authenticated" }],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      };

      const plugin = createPlugin(fetch, "bad-token");

      await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
    });
  });
});
