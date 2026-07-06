import { describe, expect, test } from "bun:test";
import type { CredentialStore } from "@kogoro/core";
import { TrackerError } from "@kogoro/core";
import { createMockHttpClient, createMockKeytar, withTestConfig } from "@kogoro/core/testing";
import { AniListPlugin } from "./anilist-plugin";

const GRAPHQL_URL = "https://graphql.anilist.co";

function createPlugin(
  credentialStore: CredentialStore,
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>,
): AniListPlugin {
  return new AniListPlugin({
    baseUrl: GRAPHQL_URL,
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    credentialStore,
    httpClient: createMockHttpClient(fetch),
  });
}

describe("AniListPlugin OAuth", () => {
  describe("authenticate", () => {
    test("returns token from credential store when available", async () => {
      const credential = {
        access_token: "test-token",
        expires_at: Date.now() + 3600000 * 24 * 365,
      };

      await withTestConfig(
        "anilist-auth-stored",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("anilist", JSON.stringify(credential));
          const plugin = createPlugin(credentialStore);
          const token = await plugin.authenticate();
          expect(token).toBe("test-token");
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when no token available", async () => {
      await withTestConfig(
        "anilist-auth-no-token",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          await expect(plugin.authenticate()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });

    test("generates auth URL with redirect to callback server", async () => {
      await withTestConfig(
        "anilist-auth-url",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          const authUrl = await plugin.generateAuthUrl();
          const decodedUrl = decodeURIComponent(authUrl);

          expect(decodedUrl).toContain("response_type=code");
          expect(decodedUrl).toContain("redirect_uri=http://localhost:43219/callback/anilist");
        },
        createMockKeytar(),
      );
    });
  });

  describe("exchangeCode", () => {
    test("exchanges authorization code for access token", async () => {
      await withTestConfig(
        "anilist-exchange-code",
        async (_dir, _config, credentialStore) => {
          let capturedUrl = "";
          let capturedBody: Record<string, string> | undefined;

          const mockFetch = async (url: string | URL, init?: RequestInit) => {
            capturedUrl = url.toString();
            capturedBody = JSON.parse(init?.body as string);
            return new Response(
              JSON.stringify({
                access_token: "exchanged-access-token",
                token_type: "Bearer",
                expires_in: 3600 * 24 * 365,
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          const result = await plugin.exchangeCode("test-auth-code");

          expect(result.access_token).toBe("exchanged-access-token");
          expect(result.expires_at).toBeGreaterThan(Date.now());

          expect(capturedUrl).toBe("https://anilist.co/api/v2/oauth/token");
          expect(capturedBody).toEqual({
            grant_type: "authorization_code",
            client_id: "test-client-id",
            client_secret: "test-client-secret",
            redirect_uri: "http://localhost:43219/callback/anilist",
            code: "test-auth-code",
          });

          const stored = await credentialStore.getCredential("anilist");
          expect(stored).toBeDefined();
          const parsed = JSON.parse(stored ?? "{}");
          expect(parsed.access_token).toBe("exchanged-access-token");
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError on exchange failure", async () => {
      await withTestConfig(
        "anilist-exchange-fail",
        async (_dir, _config, credentialStore) => {
          const mockFetch = async () => {
            return new Response(
              JSON.stringify({ error: "invalid_grant", message: "Invalid code" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          await expect(plugin.exchangeCode("bad-code")).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });

  describe("ensureAuthenticated", () => {
    test("uses loadOrRefreshCredential to load token", async () => {
      const credential = {
        access_token: "valid-token",
        expires_at: Date.now() + 3600000 * 24 * 365,
      };

      await withTestConfig(
        "anilist-ensure-auth",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("anilist", JSON.stringify(credential));

          const mockFetch = async () => {
            return new Response(JSON.stringify({ data: { MediaListCollection: { lists: [] } } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          await plugin.ensureAuthenticated();

          const response = await plugin.getUserList();
          expect(response).toEqual([]);
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when no credentials", async () => {
      await withTestConfig(
        "anilist-ensure-auth-missing",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          await expect(plugin.ensureAuthenticated()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError with auth_expired when token expired", async () => {
      const expiredCredential = {
        access_token: "expired-token",
        expires_at: Date.now() - 1000,
      };

      await withTestConfig(
        "anilist-ensure-auth-expired",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("anilist", JSON.stringify(expiredCredential));
          const plugin = createPlugin(credentialStore);

          await expect(plugin.ensureAuthenticated()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });
});
