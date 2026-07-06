import { describe, expect, test } from "bun:test";
import type { CredentialStore } from "@kogoro/core";
import { TrackerError } from "@kogoro/core";
import { createMockHttpClient, createMockKeytar, withTestConfig } from "@kogoro/core/testing";
import { KitsuPlugin } from "./kitsu-plugin";

const BASE_URL = "https://kitsu.io/api/edge";
const OAUTH_URL = "https://kitsu.io/api/oauth";

function createPlugin(
  credentialStore: CredentialStore,
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>,
): KitsuPlugin {
  return new KitsuPlugin({
    baseUrl: BASE_URL,
    oauthUrl: OAUTH_URL,
    credentialStore,
    httpClient: createMockHttpClient(fetch),
    username: "user@example.com",
    password: "password123",
  });
}

function mockFetchWithRoutes(
  routes: Record<string, { data: unknown; status?: number }>,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (url: string | URL, _init?: RequestInit) => {
    const urlStr = url.toString();
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

describe("KitsuPlugin OAuth", () => {
  describe("authenticate", () => {
    test("returns token from credential store when available", async () => {
      const credential = {
        access_token: "test-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() + 3600000 * 30,
      };

      await withTestConfig(
        "kitsu-auth-stored",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(credential));
          const plugin = createPlugin(credentialStore);
          const token = await plugin.authenticate();
          expect(token).toBe("test-token");
        },
        createMockKeytar(),
      );
    });

    test("authenticates with username/password and stores credential", async () => {
      const oauthResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
        expires_in: 3600 * 24 * 30,
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: oauthResponse },
      });

      await withTestConfig(
        "kitsu-auth-new",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore, fetch);
          const token = await plugin.authenticate();

          expect(token).toBe("new-access-token");

          const stored = await credentialStore.getCredential("kitsu");
          expect(stored).toBeDefined();
          const parsed = JSON.parse(stored ?? "{}");
          expect(parsed.access_token).toBe("new-access-token");
          expect(parsed.refresh_token).toBe("new-refresh-token");
          expect(parsed.expires_at).toBeGreaterThan(Date.now());
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError on authentication failure", async () => {
      const fetch = mockFetchWithRoutes({
        "/oauth/token": {
          data: {
            error: "invalid_grant",
            error_description: "The resource owner or authorization server denied the request.",
          },
          status: 401,
        },
      });

      await withTestConfig(
        "kitsu-auth-fail",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore, fetch);
          await expect(plugin.authenticate()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });

  describe("refreshSession", () => {
    test("refreshes expired token and updates keyring", async () => {
      const expiredCredential = {
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() - 1000,
      };

      const refreshResponse = {
        access_token: "refreshed-token",
        refresh_token: "new-refresh-token",
        token_type: "Bearer",
        expires_in: 3600 * 24 * 30,
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": { data: refreshResponse },
      });

      await withTestConfig(
        "kitsu-refresh-token",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(expiredCredential));
          const plugin = createPlugin(credentialStore, fetch);
          const result = await plugin.refreshSession();

          expect(result.access_token).toBe("refreshed-token");
          expect(result.refresh_token).toBe("new-refresh-token");

          const stored = await credentialStore.getCredential("kitsu");
          const parsed = JSON.parse(stored ?? "{}");
          expect(parsed.access_token).toBe("refreshed-token");
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when refresh fails", async () => {
      const expiredCredential = {
        access_token: "old-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() - 1000,
      };

      const fetch = mockFetchWithRoutes({
        "/oauth/token": {
          data: { error: "invalid_grant" },
          status: 401,
        },
      });

      await withTestConfig(
        "kitsu-refresh-fail",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(expiredCredential));
          const plugin = createPlugin(credentialStore, fetch);
          await expect(plugin.refreshSession()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when no refresh token available", async () => {
      const credentialWithoutRefresh = {
        access_token: "old-token",
        expires_at: Date.now() - 1000,
      };

      await withTestConfig(
        "kitsu-refresh-no-token",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(credentialWithoutRefresh));
          const plugin = createPlugin(credentialStore);
          await expect(plugin.refreshSession()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });

  describe("ensureAuthenticated", () => {
    test("uses loadOrRefreshCredential to load token", async () => {
      const credential = {
        access_token: "valid-token",
        expires_at: Date.now() + 3600000 * 30,
      };

      await withTestConfig(
        "kitsu-ensure-auth",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(credential));

          const userResponse = {
            data: [{ id: "42", type: "users", attributes: { name: "TestUser" } }],
          };

          const libraryResponse = {
            data: [],
            included: [],
          };

          const fetch = mockFetchWithRoutes({
            "filter[self]=true": { data: userResponse },
            "library-entries": { data: libraryResponse },
          });

          const plugin = createPlugin(credentialStore, fetch);
          await plugin.ensureAuthenticated();

          const response = await plugin.getUserList();
          expect(response).toEqual([]);
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when no credentials", async () => {
      await withTestConfig(
        "kitsu-ensure-auth-missing",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          await expect(plugin.ensureAuthenticated()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError with auth_expired when token expired and no refresh", async () => {
      const expiredCredential = {
        access_token: "expired-token",
        expires_at: Date.now() - 1000,
      };

      await withTestConfig(
        "kitsu-ensure-auth-expired",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("kitsu", JSON.stringify(expiredCredential));
          const plugin = createPlugin(credentialStore);

          await expect(plugin.ensureAuthenticated()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });
});
