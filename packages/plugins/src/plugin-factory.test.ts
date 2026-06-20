import { describe, expect, mock, test } from "bun:test";
import { createMockKeytar, withMockFetch, withTestConfig } from "@kogoro/core/testing";
import { PluginFactory } from "./plugin-factory";

describe("PluginFactory", () => {
  describe("database", () => {
    describe("tvdb", () => {
      test("constructs TVDBPlugin with the provided API key", async () => {
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

      test("caches built-in plugin instance across calls", async () => {
        await withMockFetch(
          (() =>
            new Response(JSON.stringify({ data: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })) as unknown as typeof fetch,
          async () => {
            await withTestConfig(
              "tvdb-cache-test",
              async (_dir, config, credentialStore) => {
                const factory = new PluginFactory(config, credentialStore);
                const first = await factory.database("tvdb");
                const second = await factory.database("tvdb");
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
      test("constructs AniDBPlugin with the provided client:clientver", async () => {
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

    describe("external plugin", () => {
      test("loads external database plugin via dynamic import", async () => {
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
              config.set("primaryDb", "anidb");
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

  describe("tracker", () => {
    test("loads external tracker plugin via kogoro-plugin-* prefix", async () => {
      mock.module("kogoro-plugin-myanimelist", () => ({
        default: class ExternalTrackerPlugin {
          async authenticate() {
            return "token";
          }
          async getUserList() {
            return [];
          }
          async getEntry() {
            return {
              trackerId: "1",
              title: "Test",
              watchStatus: "watching",
              episodesWatched: 0,
              totalEpisodes: 0,
            };
          }
          async updateEntry() {}
          async getAnimeDetails() {
            return { trackerId: "1", title: "Test", entryType: "tv" };
          }
        },
      }));

      await withTestConfig(
        "factory-tracker-test",
        async (_dir, config, credentialStore) => {
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.tracker("mal");
          expect(plugin).toBeDefined();
          expect(plugin?.authenticate).toBeInstanceOf(Function);
          expect(plugin?.getUserList).toBeInstanceOf(Function);
          expect(plugin?.getEntry).toBeInstanceOf(Function);
          expect(plugin?.updateEntry).toBeInstanceOf(Function);
          expect(plugin?.getAnimeDetails).toBeInstanceOf(Function);
        },
        null,
      );
    });

    test("returns undefined for disabled tracker plugins", async () => {
      await withTestConfig(
        "factory-tracker-disabled",
        async (_dir, config, credentialStore) => {
          config.set("plugins.mal.enabled", "false");
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.tracker("mal");
          expect(plugin).toBeUndefined();
        },
        null,
      );
    });

    test("caches external tracker plugin instance", async () => {
      mock.module("kogoro-plugin-cached-ftrk", () => ({
        default: class CachedTrackerPlugin {
          id = Math.random();
          async authenticate() {
            return "token";
          }
          async getUserList() {
            return [];
          }
          async getEntry() {
            return {
              trackerId: "1",
              title: "Test",
              watchStatus: "watching",
              episodesWatched: 0,
              totalEpisodes: 0,
            };
          }
          async updateEntry() {}
          async getAnimeDetails() {
            return { trackerId: "1", title: "Test", entryType: "tv" };
          }
        },
      }));

      await withTestConfig(
        "factory-tracker-cache",
        async (_dir, config, credentialStore) => {
          const factory = new PluginFactory(config, credentialStore);
          const first = await factory.tracker("cached-ftrk");
          const second = await factory.tracker("cached-ftrk");
          expect(first).toBe(second);
        },
        null,
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

  describe("list", () => {
    test("returns built-in database plugins", async () => {
      await withTestConfig(
        "list-builtin-db",
        async (_dir, config, credentialStore) => {
          const factory = new PluginFactory(config, credentialStore);
          const plugins = factory.list();
          const dbPlugins = plugins.filter((p) => p.type === "database");
          expect(dbPlugins.some((p) => p.name === "tvdb")).toBe(true);
          expect(dbPlugins.some((p) => p.name === "anidb")).toBe(true);
        },
        null,
      );
    });

    test("returns built-in subtitle plugin", async () => {
      await withTestConfig(
        "list-builtin-sub",
        async (_dir, config, credentialStore) => {
          const factory = new PluginFactory(config, credentialStore);
          const plugins = factory.list();
          const subPlugins = plugins.filter((p) => p.type === "subtitle");
          expect(subPlugins.some((p) => p.name === "opensubtitles")).toBe(true);
        },
        null,
      );
    });

    test("marks disabled plugins in list", async () => {
      await withTestConfig(
        "list-disabled",
        async (_dir, config, credentialStore) => {
          config.set("plugins.tvdb.enabled", "false");
          const factory = new PluginFactory(config, credentialStore);
          const plugins = factory.list();
          const tvdb = plugins.find((p) => p.name === "tvdb");
          expect(tvdb?.enabled).toBe(false);
          const anidb = plugins.find((p) => p.name === "anidb");
          expect(anidb?.enabled).toBe(true);
        },
        null,
      );
    });

    test("all plugins enabled by default", async () => {
      await withTestConfig(
        "list-all-enabled",
        async (_dir, config, credentialStore) => {
          const factory = new PluginFactory(config, credentialStore);
          const plugins = factory.list();
          for (const p of plugins) {
            expect(p.enabled).toBe(true);
          }
        },
        null,
      );
    });
  });
});
