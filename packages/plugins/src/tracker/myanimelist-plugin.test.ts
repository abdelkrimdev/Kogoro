import { describe, expect, test } from "bun:test";
import type { CredentialStore, TrackerWatchStatus } from "@kogoro/core";
import { TrackerError } from "@kogoro/core";
import { createMockHttpClient, createMockKeytar, withTestConfig } from "@kogoro/core/testing";
import { MyAnimeListPlugin } from "./myanimelist-plugin";

const MAL_BASE_URL = "https://api.myanimelist.net/v2";

function createPlugin(
  credentialStore: CredentialStore,
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>,
): MyAnimeListPlugin {
  return new MyAnimeListPlugin({
    baseUrl: MAL_BASE_URL,
    credentialKey: "mal",
    clientId: "test-client-id",
    credentialStore,
    httpClient: createMockHttpClient(fetch),
  });
}

function makeCredential(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    access_token: "test-token",
    refresh_token: "refresh-token",
    expires_at: Date.now() + 3600000,
    ...overrides,
  });
}

describe("MyAnimeListPlugin", () => {
  describe("authenticate", () => {
    test("returns token from credential store when available", async () => {
      await withTestConfig(
        "mal-auth-stored",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          const token = await plugin.authenticate();
          expect(token).toBe("test-token");
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("throws error when no token available", async () => {
      await withTestConfig("mal-auth-no-token", async (_dir, _config, credentialStore) => {
        const plugin = createPlugin(credentialStore);

        await expect(plugin.authenticate()).rejects.toThrow("mal credentials not found");
      });
    });

    test("authenticates when credential is JSON blob with access_token", async () => {
      await withTestConfig(
        "mal-auth-stored-token",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);

          const token = await plugin.authenticate();

          expect(token).toBe("real-mal-token");
        },
        createMockKeytar({
          "kogoro:mal": JSON.stringify({
            access_token: "real-mal-token",
            refresh_token: "refresh",
            expires_at: Date.now() + 3600000,
          }),
        }),
      );
    });
  });

  describe("getUserList", () => {
    test("returns mapped anime list from MAL API", async () => {
      const mockResponse = {
        data: [
          {
            node: {
              id: 1234,
              title: "Test Anime",
              main_picture: {
                medium: "https://example.com/medium.jpg",
                large: "https://example.com/large.jpg",
              },
              alternative_titles: {
                en: "Test Anime EN",
                ja: "テストアニメ",
              },
              start_date: "2023-01-15",
              media_type: "tv",
              num_episodes: 12,
            },
            list_status: {
              status: "watching",
              score: 8,
              num_episodes_watched: 5,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
        ],
        paging: {},
      };

      await withTestConfig(
        "mal-user-list",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          const list = await plugin.getUserList();

          expect(list).toHaveLength(1);
          expect(list[0]).toEqual({
            source: "mal",
            trackerId: "1234",
            title: "Test Anime",
            alternativeTitles: ["Test Anime EN", "テストアニメ"],
            image: "https://example.com/large.jpg",
            year: 2023,
            entryType: "tv",
            watchStatus: "watching",
            episodesWatched: 5,
            totalEpisodes: 12,
            score: 8,
          });
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("requests alternative_titles in user list fields", async () => {
      const mockResponse = {
        data: [
          {
            node: {
              id: 9999,
              title: "Alt Titles Anime",
              alternative_titles: {
                en: "Alt Titles English",
                ja: "替代タイトル",
              },
              media_type: "tv",
              num_episodes: 6,
            },
            list_status: {
              status: "completed",
              score: 7,
              num_episodes_watched: 6,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
        ],
        paging: {},
      };

      await withTestConfig(
        "mal-user-list-alt-titles",
        async (_dir, _config, credentialStore) => {
          let capturedUrl = "";
          const plugin = createPlugin(credentialStore, async (url) => {
            capturedUrl = url.toString();
            return new Response(JSON.stringify(mockResponse), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });

          await plugin.authenticate();
          const list = await plugin.getUserList();

          expect(list).toHaveLength(1);
          expect(list[0]?.alternativeTitles).toEqual(["Alt Titles English", "替代タイトル"]);
          expect(capturedUrl).toContain(
            "fields=list_status,num_episodes,alternative_titles,media_type",
          );
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("maps media_type to entryType correctly", async () => {
      const mockResponse = {
        data: [
          {
            node: {
              id: 1001,
              title: "OVA Anime",
              media_type: "ova",
              num_episodes: 2,
            },
            list_status: {
              status: "completed",
              score: 7,
              num_episodes_watched: 2,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
          {
            node: {
              id: 1002,
              title: "Movie Anime",
              media_type: "movie",
              num_episodes: 1,
            },
            list_status: {
              status: "completed",
              score: 9,
              num_episodes_watched: 1,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
          {
            node: {
              id: 1003,
              title: "TV Special Anime",
              media_type: "tv_special",
              num_episodes: 1,
            },
            list_status: {
              status: "completed",
              score: 6,
              num_episodes_watched: 1,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
        ],
        paging: {},
      };

      await withTestConfig(
        "mal-media-type-mapping",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          const list = await plugin.getUserList();

          expect(list).toHaveLength(3);
          expect(list[0]?.entryType).toBe("ova");
          expect(list[1]?.entryType).toBe("movie");
          expect(list[2]?.entryType).toBe("tv");
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("fetches across multiple pages", async () => {
      const page1Response = {
        data: [
          {
            node: {
              id: 1,
              title: "Anime 1",
              media_type: "tv",
              num_episodes: 12,
            },
            list_status: {
              status: "completed",
              score: 9,
              num_episodes_watched: 12,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
        ],
        paging: {
          next: "https://api.myanimelist.net/v2/users/@me/animelist?offset=100&limit=100",
        },
      };

      const page2Response = {
        data: [
          {
            node: {
              id: 2,
              title: "Anime 2",
              media_type: "movie",
              num_episodes: 1,
            },
            list_status: {
              status: "plan_to_watch",
              score: 0,
              num_episodes_watched: 0,
              is_rewatching: false,
              updated_at: "2023-06-01T10:00:00+00:00",
            },
          },
        ],
        paging: {},
      };

      let callCount = 0;
      await withTestConfig(
        "mal-pagination",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore, async () => {
            callCount++;
            if (callCount === 1) {
              return new Response(JSON.stringify(page1Response), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify(page2Response), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });

          await plugin.authenticate();
          const list = await plugin.getUserList();

          expect(list).toHaveLength(2);
          expect(list[0]?.trackerId).toBe("1");
          expect(list[1]?.trackerId).toBe("2");
          expect(callCount).toBe(2);
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("maps MAL statuses to Kogoro statuses", async () => {
      const statusTests = [
        { mal: "watching", expected: "watching" },
        { mal: "completed", expected: "completed" },
        { mal: "on_hold", expected: "on-hold" },
        { mal: "dropped", expected: "dropped" },
        { mal: "plan_to_watch", expected: "plan-to-watch" },
      ];

      for (const { mal, expected } of statusTests) {
        const mockResponse = {
          data: [
            {
              node: {
                id: 1,
                title: "Test",
                media_type: "tv",
                num_episodes: 12,
              },
              list_status: {
                status: mal,
                score: 0,
                num_episodes_watched: 0,
                is_rewatching: false,
                updated_at: "2023-06-01T10:00:00+00:00",
              },
            },
          ],
          paging: {},
        };

        await withTestConfig(
          `mal-status-${mal}`,
          async (_dir, _config, credentialStore) => {
            const plugin = createPlugin(
              credentialStore,
              async () =>
                new Response(JSON.stringify(mockResponse), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                }),
            );

            await plugin.authenticate();
            const list = await plugin.getUserList();

            expect(list[0]?.watchStatus).toBe(expected as TrackerWatchStatus);
          },
          createMockKeytar({ "kogoro:mal": makeCredential() }),
        );
      }
    });
  });

  describe("getEntry", () => {
    test("returns mapped entry for given trackerId", async () => {
      const mockResponse = {
        id: 1234,
        title: "Test Anime",
        num_episodes: 12,
        my_list_status: {
          status: "watching",
          score: 8,
          num_episodes_watched: 5,
          is_rewatching: false,
          updated_at: "2023-06-01T10:00:00+00:00",
        },
      };

      await withTestConfig(
        "mal-get-entry",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          const entry = await plugin.getEntry("1234");

          expect(entry).toEqual({
            trackerId: "1234",
            title: "Test Anime",
            watchStatus: "watching",
            episodesWatched: 5,
            totalEpisodes: 12,
            score: 8,
          });
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });
  });

  describe("updateEntry", () => {
    test("sends correct PATCH request with changes", async () => {
      let capturedUrl = "";
      let capturedMethod = "";
      let capturedBody = "";

      await withTestConfig(
        "mal-update-entry",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore, async (url, init) => {
            capturedUrl = url.toString();
            capturedMethod = init?.method || "";
            capturedBody = init?.body as string;
            return new Response(JSON.stringify({}), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          });

          await plugin.authenticate();
          await plugin.updateEntry("1234", {
            watchStatus: "completed",
            episodesWatched: 12,
            score: 9,
          });

          expect(capturedUrl).toContain("/anime/1234/my_list_status");
          expect(capturedMethod).toBe("PATCH");
          expect(capturedBody).toContain("status=completed");
          expect(capturedBody).toContain("num_watched_episodes=12");
          expect(capturedBody).toContain("score=9");
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });
  });

  describe("getAnimeDetails", () => {
    test("returns mapped anime details", async () => {
      const mockResponse = {
        id: 1234,
        title: "Test Anime",
        main_picture: {
          medium: "https://example.com/medium.jpg",
          large: "https://example.com/large.jpg",
        },
        alternative_titles: {
          en: "Test Anime EN",
          ja: "テストアニメ",
        },
        start_date: "2023-01-15",
        media_type: "tv",
        num_episodes: 12,
        synopsis: "A test anime synopsis",
        mean: 8.5,
        genres: [
          { id: 1, name: "Action" },
          { id: 2, name: "Comedy" },
        ],
        studios: [{ id: 1, name: "Test Studio" }],
      };

      await withTestConfig(
        "mal-anime-details",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify(mockResponse), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          const details = await plugin.getAnimeDetails("1234");

          expect(details).toEqual({
            trackerId: "1234",
            title: "Test Anime",
            alternativeTitles: ["Test Anime EN", "テストアニメ"],
            image: "https://example.com/large.jpg",
            year: 2023,
            entryType: "tv",
            synopsis: "A test anime synopsis",
            rating: 8.5,
            genres: ["Action", "Comedy"],
            studio: "Test Studio",
            totalEpisodes: 12,
          });
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });
  });

  describe("error handling", () => {
    test("fetchJson throws TrackerError on non-ok response", async () => {
      await withTestConfig(
        "mal-fetch-json-error",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          await expect(plugin.getUserList()).rejects.toThrow(TrackerError);
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("getEntry throws TrackerError when anime not in user's list", async () => {
      await withTestConfig(
        "mal-get-entry-error",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify({ id: 1234, title: "Test" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          await expect(plugin.getEntry("1234")).rejects.toThrow(TrackerError);
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });

    test("updateEntry throws TrackerError on failure", async () => {
      await withTestConfig(
        "mal-update-entry-error",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(
            credentialStore,
            async () =>
              new Response(JSON.stringify({ error: "Not Found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
              }),
          );

          await plugin.authenticate();
          await expect(plugin.updateEntry("1234", { watchStatus: "completed" })).rejects.toThrow(
            TrackerError,
          );
        },
        createMockKeytar({ "kogoro:mal": makeCredential() }),
      );
    });
  });
});
