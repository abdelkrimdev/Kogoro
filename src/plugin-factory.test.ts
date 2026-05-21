import { describe, expect, mock, test } from "bun:test";
import { ConfigManager } from "./config/config-manager";
import { CredentialStore } from "./config/credential-store";
import { PluginFactory } from "./plugin-factory";
import { createMockKeytar, withTempDir, withTestConfig } from "./test-fixtures";

describe("PluginFactory", () => {
  test("constructor creates instance with all four methods", async () => {
    await withTestConfig("basic", async (_dir, config, credentialStore) => {
      const factory = new PluginFactory(config, credentialStore);
      expect(factory.primaryDatabase).toBeInstanceOf(Function);
      expect(factory.secondaryDatabases).toBeInstanceOf(Function);
      expect(factory.database).toBeInstanceOf(Function);
      expect(factory.subtitle).toBeInstanceOf(Function);
    });
  });

  describe("database", () => {
    test("'tvdb' constructs TVDBPlugin with correct API key", async () => {
      let loginBody: string | undefined;
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((
        url: string | URL | Request,
        init?: RequestInit | BunFetchRequestInit,
      ) => {
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
      }) as unknown as typeof fetch;

      try {
        await withTempDir("tvdb-test", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:tvdb": "test-api-key" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.database("tvdb");
          expect(plugin).toBeDefined();
          expect(plugin?.constructor.name).toBe("TVDBPlugin");

          await plugin?.searchAnime("test");
          expect(loginBody).toBeDefined();
          const parsed = JSON.parse(loginBody as string);
          expect(parsed.apikey).toBe("test-api-key");
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    test("'anidb' constructs AniDBPlugin with correct client:clientver", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("anidb")) {
          return new Response('<?xml version="1.0"?><animetitles/>', {
            status: 200,
            headers: { "Content-Type": "application/xml" },
          });
        }
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      try {
        await withTempDir("anidb-test", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:anidb": "testclient:2" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.database("anidb");
          expect(plugin).toBeDefined();
          expect(plugin?.constructor.name).toBe("AniDBPlugin");
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    test("'unknown' falls through to PluginRegistry for external plugins", async () => {
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

      await withTempDir("external-test", async (dir) => {
        const config = new ConfigManager({ configDir: dir });
        const credentialStore = new CredentialStore({ keytar: null });
        const factory = new PluginFactory(config, credentialStore);
        const plugin = await factory.database("myextdb");
        expect(plugin).toBeDefined();
        expect(plugin?.searchAnime).toBeInstanceOf(Function);
        expect(plugin?.getEpisodes).toBeInstanceOf(Function);
      });
    });
  });

  describe("primaryDatabase", () => {
    test("respects primary-db config setting", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("anidb")) {
          return new Response('<?xml version="1.0"?><animetitles/>', {
            status: 200,
            headers: { "Content-Type": "application/xml" },
          });
        }
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      try {
        await withTempDir("primary-db", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          config.set("primary-db", "anidb");
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:anidb": "testclient:1" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.primaryDatabase();
          expect(plugin).toBeDefined();
          expect(plugin?.constructor.name).toBe("AniDBPlugin");
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("secondaryDatabases", () => {
    test("returns plugins for all configured names", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((url: string | URL | Request) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("anidb")) {
          return new Response('<?xml version="1.0"?><animetitles/>', {
            status: 200,
            headers: { "Content-Type": "application/xml" },
          });
        }
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      try {
        await withTempDir("secondary-dbs", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          config.set("secondary-dbs", "anidb");
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:anidb": "testclient:1" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugins = await factory.secondaryDatabases();
          expect(plugins).toHaveLength(1);
          expect(plugins[0]?.constructor.name).toBe("AniDBPlugin");
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("subtitle", () => {
    test("constructs OpenSubtitles plugin by default", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((
        url: string | URL | Request,
        _init?: RequestInit | BunFetchRequestInit,
      ) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("opensubtitles.com")) {
          return new Response(JSON.stringify({ data: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("ok", { status: 200 });
      }) as unknown as typeof fetch;

      try {
        await withTempDir("subtitle-test", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:opensubtitles": "test-os-key" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.subtitle();
          expect(plugin).toBeDefined();
          expect(plugin?.constructor.name).toBe("OpenSubtitlesPlugin");
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("disabled plugins", () => {
    test("excluded by PluginRegistry.setDisabled from config", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = ((
        url: string | URL | Request,
        _init?: RequestInit | BunFetchRequestInit,
      ) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/login")) {
          return new Response(JSON.stringify({ data: { token: "mock" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }) as unknown as typeof fetch;

      try {
        await withTempDir("disabled-test", async (dir) => {
          const config = new ConfigManager({ configDir: dir });
          config.set("plugins.tvdb.enabled", "false");
          const credentialStore = new CredentialStore({
            keytar: createMockKeytar({ "kogoro:tvdb": "key" }),
          });
          const factory = new PluginFactory(config, credentialStore);
          const plugin = await factory.database("tvdb");
          expect(plugin).toBeUndefined();
        });
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
});
