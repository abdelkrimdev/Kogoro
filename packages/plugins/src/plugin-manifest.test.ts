import { describe, expect, test } from "bun:test";
import type { CredentialStore } from "@kogoro/core";
import { getManifestEntry, type PluginLoadContext } from "./plugin-manifest";
import { AniListPlugin } from "./tracker/anilist-plugin";
import { KitsuPlugin } from "./tracker/kitsu-plugin";

function createMockCredentialStore(overrides: Record<string, string> = {}): CredentialStore & {
  getCredentialCalls: string[];
  setCredentialCalls: Array<{ service: string; credential: string }>;
} {
  const store = new Map(Object.entries(overrides));
  const getCredentialCalls: string[] = [];
  const setCredentialCalls: Array<{ service: string; credential: string }> = [];

  return {
    getCredentialCalls,
    setCredentialCalls,
    async getCredential(service: string): Promise<string | undefined> {
      getCredentialCalls.push(service);
      return store.get(service);
    },
    async setCredential(service: string, credential: string): Promise<{ usedKeyring: boolean }> {
      setCredentialCalls.push({ service, credential });
      store.set(service, credential);
      return { usedKeyring: false };
    },
    async deleteCredential(service: string): Promise<void> {
      store.delete(service);
    },
  } as unknown as CredentialStore & {
    getCredentialCalls: string[];
    setCredentialCalls: Array<{ service: string; credential: string }>;
  };
}

describe("plugin-manifest", () => {
  describe("loadKitsu", () => {
    test("returns plugin when credentials are stored", async () => {
      const mockStore = createMockCredentialStore({
        kitsu: "user@example.com:password123",
      });

      const ctx: PluginLoadContext = {
        credentialStore: mockStore,
      };

      const kitsuEntry = getManifestEntry("kitsu");
      expect(kitsuEntry).toBeDefined();

      const plugin = await kitsuEntry?.load(ctx, kitsuEntry);

      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(KitsuPlugin);
    });

    test("returns undefined when no credential is stored", async () => {
      const mockStore = createMockCredentialStore({});

      const ctx: PluginLoadContext = {
        credentialStore: mockStore,
      };

      const kitsuEntry = getManifestEntry("kitsu");
      expect(kitsuEntry).toBeDefined();

      const plugin = await kitsuEntry?.load(ctx, kitsuEntry);

      expect(plugin).toBeUndefined();
    });

    test("handles JSON credentials from previous auth", async () => {
      const jsonCredential = JSON.stringify({
        access_token: "existing-access-token",
        refresh_token: "existing-refresh-token",
        expires_at: Date.now() + 3600000,
      });

      const mockStore = createMockCredentialStore({
        kitsu: jsonCredential,
      });

      const ctx: PluginLoadContext = {
        credentialStore: mockStore,
      };

      const kitsuEntry = getManifestEntry("kitsu");
      const plugin = await kitsuEntry?.load(ctx, kitsuEntry);

      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(KitsuPlugin);
    });

    test("handles legacy username:password format", async () => {
      const mockStore = createMockCredentialStore({
        kitsu: "user@example.com:password123",
      });

      const ctx: PluginLoadContext = {
        credentialStore: mockStore,
      };

      const kitsuEntry = getManifestEntry("kitsu");
      const plugin = await kitsuEntry?.load(ctx, kitsuEntry);

      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(KitsuPlugin);
    });

    test("passes credentialStore to plugin for token refresh", async () => {
      const mockStore = createMockCredentialStore({
        kitsu: "user@example.com:password123",
      });

      const ctx: PluginLoadContext = {
        credentialStore: mockStore,
      };

      const kitsuEntry = getManifestEntry("kitsu");
      const plugin = (await kitsuEntry?.load(ctx, kitsuEntry)) as KitsuPlugin;

      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(KitsuPlugin);

      try {
        await plugin.refreshSession();
      } catch (error) {
        expect((error as Error).message).not.toContain("No credential store available");
      }
    });
  });

  describe("loadAnilist", () => {
    test("extracts access_token from JSON credential blob", async () => {
      const credential = JSON.stringify({
        access_token: "real-anilist-token",
        expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });

      const mockStore = createMockCredentialStore({ anilist: credential });
      const ctx: PluginLoadContext = { credentialStore: mockStore };

      const entry = getManifestEntry("anilist");
      expect(entry).toBeDefined();

      const plugin = (await entry?.load(ctx, entry)) as AniListPlugin;
      expect(plugin).toBeDefined();
      expect(plugin).toBeInstanceOf(AniListPlugin);

      const token = await plugin.authenticate();
      expect(token).toBe("real-anilist-token");
    });

    test("creates plugin with undefined token when no credential is stored", async () => {
      const mockStore = createMockCredentialStore({});
      const ctx: PluginLoadContext = { credentialStore: mockStore };

      const entry = getManifestEntry("anilist");
      const plugin = await entry?.load(ctx, entry);

      expect(plugin).toBeDefined();
    });
  });
});
