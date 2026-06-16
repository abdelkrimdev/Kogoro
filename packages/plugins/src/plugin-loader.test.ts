import { describe, expect, mock, test } from "bun:test";
import { createMockKeytar, withMockFetch, withTestConfig } from "@kogoro/core/testing";
import { PluginLoader } from "./plugin-loader";

describe("PluginLoader", () => {
  describe("loadDatabase", () => {
    describe("tvdb", () => {
      test("constructs TVDBPlugin with correct API key", async () => {
        let loginBody: string | undefined;

        await withMockFetch(
          ((url: string | URL | Request, init?: RequestInit | BunFetchRequestInit) => {
            const urlStr = typeof url === "string" ? url : url.toString();
            if (urlStr.includes("/login")) {
              loginBody = typeof init?.body === "string" ? init.body : undefined;
              return new Response(JSON.stringify({ data: { token: "mock-token" } }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
            return new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }) as unknown as typeof fetch,
          async () => {
            await withTestConfig(
              "loader-tvdb",
              async (_dir, config, credentialStore) => {
                const loader = new PluginLoader();
                const plugin = await loader.loadDatabase("tvdb", config, credentialStore);
                expect(plugin).toBeDefined();
                expect(plugin?.constructor.name).toBe("TVDBPlugin");

                await plugin?.searchAnime("test");
                expect(loginBody).toBeDefined();
                const parsed = JSON.parse(loginBody as string);
                expect(parsed.apikey).toBe("test-api-key");
              },
              createMockKeytar({ "kogoro:tvdb": "test-api-key" }),
            );
          },
        );
      });

      test("caches built-in plugin instance across calls", async () => {
        await withMockFetch(
          (() =>
            new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })) as unknown as typeof fetch,
          async () => {
            await withTestConfig(
              "loader-tvdb-cache",
              async (_dir, config, credentialStore) => {
                const loader = new PluginLoader();
                const first = await loader.loadDatabase("tvdb", config, credentialStore);
                const second = await loader.loadDatabase("tvdb", config, credentialStore);
                expect(first).toBeDefined();
                expect(first).toBe(second);
              },
              createMockKeytar({ "kogoro:tvdb": "test-api-key" }),
            );
          },
        );
      });
    });

    describe("anidb", () => {
      test("constructs AniDBPlugin with correct client:clientver", async () => {
        await withMockFetch(
          ((url: string | URL | Request) => {
            const urlStr = typeof url === "string" ? url : url.toString();
            if (urlStr.includes("anidb")) {
              return new Response('<?xml version="1.0"?><animetitles/>', {
                status: 200,
                headers: { "Content-Type": "application/xml" },
              });
            }
            return new Response("ok", { status: 200 });
          }) as unknown as typeof fetch,
          async () => {
            await withTestConfig(
              "loader-anidb",
              async (_dir, config, credentialStore) => {
                const loader = new PluginLoader();
                const plugin = await loader.loadDatabase("anidb", config, credentialStore);
                expect(plugin).toBeDefined();
                expect(plugin?.constructor.name).toBe("AniDBPlugin");
              },
              createMockKeytar({ "kogoro:anidb": "testclient:2" }),
            );
          },
        );
      });
    });

    describe("unknown plugin name", () => {
      test("loads external plugin via dynamic import", async () => {
        mock.module("kogoro-plugin-myextdb", () => ({
          default: class ExternalPlugin {
            async searchAnime() {
              return [];
            }
            async getEpisodes() {
              return [];
            }
            async getArtwork() {
              return [];
            }
            async getAnime() {
              return null;
            }
          },
        }));

        await withTestConfig(
          "loader-external",
          async (_dir, config, credentialStore) => {
            const loader = new PluginLoader();
            const plugin = await loader.loadDatabase("myextdb", config, credentialStore);
            expect(plugin).toBeDefined();
            expect(plugin?.searchAnime).toBeInstanceOf(Function);
            expect(plugin?.getEpisodes).toBeInstanceOf(Function);
          },
          null,
        );
      });

      test("caches external plugin instance", async () => {
        mock.module("kogoro-plugin-cached-ext", () => ({
          default: class CachedPlugin {
            id = Math.random();
            async searchAnime() {
              return [];
            }
            async getEpisodes() {
              return [];
            }
            async getArtwork() {
              return [];
            }
            async getAnime() {
              return null;
            }
          },
        }));

        await withTestConfig(
          "loader-external-cache",
          async (_dir, config, credentialStore) => {
            const loader = new PluginLoader();
            const first = await loader.loadDatabase("cached-ext", config, credentialStore);
            const second = await loader.loadDatabase("cached-ext", config, credentialStore);
            expect(first).toBe(second);
          },
          null,
        );
      });

      test("returns undefined when default export is not a constructor", async () => {
        mock.module("kogoro-plugin-badctorext", () => ({
          default: "not a constructor",
        }));

        await withTestConfig(
          "loader-bad-ctor",
          async (_dir, config, credentialStore) => {
            const loader = new PluginLoader();
            const plugin = await loader.loadDatabase("badctorext", config, credentialStore);
            expect(plugin).toBeUndefined();
          },
          null,
        );
      });

      test("returns undefined when plugin does not implement DatabasePlugin", async () => {
        mock.module("kogoro-plugin-badimpl", () => ({
          default: class BadPlugin {
            async searchAnime() {
              return [];
            }
          },
        }));

        await withTestConfig(
          "loader-bad-impl",
          async (_dir, config, credentialStore) => {
            const loader = new PluginLoader();
            const plugin = await loader.loadDatabase("badimpl", config, credentialStore);
            expect(plugin).toBeUndefined();
          },
          null,
        );
      });
    });

    describe("disabled plugins", () => {
      test("returns undefined for disabled plugins", async () => {
        await withTestConfig(
          "loader-disabled",
          async (_dir, config, credentialStore) => {
            config.set("plugins.tvdb.enabled", "false");
            const loader = new PluginLoader();
            const plugin = await loader.loadDatabase("tvdb", config, credentialStore);
            expect(plugin).toBeUndefined();
          },
          createMockKeytar({ "kogoro:tvdb": "key" }),
        );
      });
    });
  });

  describe("loadSubtitle", () => {
    test("constructs OpenSubtitles plugin by default", async () => {
      await withMockFetch(
        ((url: string | URL | Request) => {
          const urlStr = typeof url === "string" ? url : url.toString();
          if (urlStr.includes("opensubtitles.com")) {
            return new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response("ok", { status: 200 });
        }) as unknown as typeof fetch,
        async () => {
          await withTestConfig(
            "loader-subtitle",
            async (_dir, _config, credentialStore) => {
              const loader = new PluginLoader();
              const plugin = await loader.loadSubtitle("opensubtitles", credentialStore);
              expect(plugin).toBeDefined();
              expect(plugin?.constructor.name).toBe("OpenSubtitlesPlugin");
            },
            createMockKeytar({ "kogoro:opensubtitles": "test-os-key" }),
          );
        },
      );
    });
  });
});
