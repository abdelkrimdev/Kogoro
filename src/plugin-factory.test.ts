import { describe, expect, test } from "bun:test";
import { ConfigManager } from "./config/config-manager";
import { CredentialStore } from "./config/credential-store";
import { PluginFactory } from "./plugin-factory";
import { withTempDir } from "./test-fixtures";

describe("PluginFactory", () => {
  test("primaryDatabase returns TVDBPlugin when primary-db is tvdb", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      config.set("primary-db", "tvdb");
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("tvdb", "test-api-key");
      const factory = new PluginFactory({ config, credentialStore });
      const db = await factory.primaryDatabase();
      expect(db).toBeDefined();
      expect(db?.constructor.name).toBe("TVDBPlugin");
      // biome-ignore lint/complexity/useLiteralKeys: env var set by credential store
      delete process.env["KOGORO_TVDB_KEY"];
    });
  });

  test("database('anidb') returns AniDBPlugin with valid credentials", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("anidb", "testclient:1");
      const factory = new PluginFactory({ config, credentialStore });
      const db = await factory.database("anidb");
      expect(db).toBeDefined();
      expect(db?.constructor.name).toBe("AniDBPlugin");
      // biome-ignore lint/complexity/useLiteralKeys: env var set by credential store
      delete process.env["KOGORO_ANIDB_KEY"];
    });
  });

  test("subtitle returns OpenSubtitlesPlugin with valid credentials", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("opensubtitles", "test-api-key");
      const factory = new PluginFactory({ config, credentialStore });
      const sub = await factory.subtitle();
      expect(sub).toBeDefined();
      expect(sub?.constructor.name).toBe("OpenSubtitlesPlugin");
      // biome-ignore lint/complexity/useLiteralKeys: env var set by credential store
      delete process.env["KOGORO_OPENSUBTITLES_KEY"];
    });
  });

  test("secondaryDatabases returns configured databases", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      config.set("secondary-dbs", "anidb,tvdb");
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("anidb", "testclient:1");
      await credentialStore.setCredential("tvdb", "test-api-key");
      const factory = new PluginFactory({ config, credentialStore });
      const dbs = await factory.secondaryDatabases();
      expect(dbs).toHaveLength(2);
      expect(dbs[0]?.constructor.name).toBe("AniDBPlugin");
      expect(dbs[1]?.constructor.name).toBe("TVDBPlugin");
      // biome-ignore lint/complexity/useLiteralKeys: env vars set by credential store
      delete process.env["KOGORO_ANIDB_KEY"];
      // biome-ignore lint/complexity/useLiteralKeys: env vars set by credential store
      delete process.env["KOGORO_TVDB_KEY"];
    });
  });

  test("database returns undefined when credentials are missing", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const factory = new PluginFactory({ config, credentialStore });
      const db = await factory.database("tvdb");
      expect(db).toBeUndefined();
    });
  });

  test("primaryDatabase returns AniDBPlugin when primary-db is anidb", async () => {
    await withTempDir("plugin-factory", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      config.set("primary-db", "anidb");
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("anidb", "testclient:1");
      const factory = new PluginFactory({ config, credentialStore });
      const db = await factory.primaryDatabase();
      expect(db).toBeDefined();
      expect(db?.constructor.name).toBe("AniDBPlugin");
      // biome-ignore lint/complexity/useLiteralKeys: env var set by credential store
      delete process.env["KOGORO_ANIDB_KEY"];
    });
  });
});
