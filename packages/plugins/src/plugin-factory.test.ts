import { describe, expect, mock, test } from "bun:test";
import { createMockKeytar, withMockFetch, withTestConfig } from "@kogoro/core";
import { PluginFactory } from "./plugin-factory";

describe("PluginFactory", () => {
  describe("database", () => {
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
              "tvdb-test",
              async (_dir, config, credentialStore) => {
                const factory = new PluginFactory(config, credentialStore);
                const plugin = await factory.database("tvdb");
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
              "anidb-test",
              async (_dir, config, credentialStore) => {
                const factory = new PluginFactory(config, credentialStore);
                const plugin = await factory.database("anidb");
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
          "external-test",
          async (_dir, config, credentialStore) => {
            const factory = new PluginFactory(config, credentialStore);
            const plugin = await factory.database("myextdb");
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
          "external-cache-test",
          async (_dir, config, credentialStore) => {
            const factory = new PluginFactory(config, credentialStore);
            const first = await factory.database("cached-ext");
            const second = await factory.database("cached-ext");
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
          "external-badctor-test",
          async (_dir, config, credentialStore) => {
            const factory = new PluginFactory(config, credentialStore);
            const plugin = await factory.database("badctorext");
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
          "external-badimpl-test",
          async (_dir, config, credentialStore) => {
            const factory = new PluginFactory(config, credentialStore);
            const plugin = await factory.database("badimpl");
            expect(plugin).toBeUndefined();
          },
          null,
        );
      });
    });
  });

  describe("primaryDatabase", () => {
    test("respects primary-db config setting", async () => {
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
            "primary-db",
            async (_dir, config, credentialStore) => {
              config.set("primary-db", "anidb");
              const factory = new PluginFactory(config, credentialStore);
              const plugin = await factory.primaryDatabase();
              expect(plugin).toBeDefined();
              expect(plugin?.constructor.name).toBe("AniDBPlugin");
            },
            createMockKeytar({ "kogoro:anidb": "testclient:1" }),
          );
        },
      );
    });
  });

  describe("subtitle", () => {
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
            "subtitle-test",
            async (_dir, config, credentialStore) => {
              const factory = new PluginFactory(config, credentialStore);
              const plugin = await factory.subtitle();
              expect(plugin).toBeDefined();
              expect(plugin?.constructor.name).toBe("OpenSubtitlesPlugin");
            },
            createMockKeytar({ "kogoro:opensubtitles": "test-os-key" }),
          );
        },
      );
    });
  });

  describe("disabled plugins", () => {
    test("returns undefined for disabled plugins", async () => {
      await withTestConfig(
        "disabled-test",
        async (_dir, config, credentialStore) => {
          config.set("plugins.tvdb.enabled", "false");
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.database("tvdb");
          expect(plugin).toBeUndefined();
        },
        createMockKeytar({ "kogoro:tvdb": "key" }),
      );
    });
  });
});
