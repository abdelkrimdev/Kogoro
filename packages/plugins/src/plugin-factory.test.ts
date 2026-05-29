import { describe, expect, mock, test } from "bun:test";
import { createMockKeytar, withMockFetch, withTestConfig } from "@kogoro/core";
import { PluginFactory } from "./plugin-factory";

describe("PluginFactory", () => {
  test("has four public methods", async () => {
    await withTestConfig("basic", async (_dir, config, credentialStore) => {
      const factory = new PluginFactory(config, credentialStore);
      expect(factory.primaryDatabase).toBeInstanceOf(Function);
      expect(factory.secondaryDatabases).toBeInstanceOf(Function);
      expect(factory.database).toBeInstanceOf(Function);
      expect(factory.subtitle).toBeInstanceOf(Function);
    });
  });

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
      test("falls through to PluginRegistry for external plugins", async () => {
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

  describe("secondaryDatabases", () => {
    test("returns plugins for all configured names", async () => {
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
            "secondary-dbs",
            async (_dir, config, credentialStore) => {
              config.set("secondary-dbs", "anidb");
              const factory = new PluginFactory(config, credentialStore);
              const plugins = await factory.secondaryDatabases();
              expect(plugins).toHaveLength(1);
              expect(plugins[0]?.constructor.name).toBe("AniDBPlugin");
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
