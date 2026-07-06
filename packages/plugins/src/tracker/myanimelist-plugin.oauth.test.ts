import { describe, expect, test } from "bun:test";
import type { CredentialStore } from "@kogoro/core";
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

describe("MyAnimeListPlugin OAuth", () => {
  describe("authenticate", () => {
    test("returns token from credential store when available", async () => {
      const credential = {
        access_token: "test-token",
        refresh_token: "refresh-token",
        expires_at: Date.now() + 3600000,
      };

      await withTestConfig(
        "mal-auth-stored",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("mal", JSON.stringify(credential));
          const plugin = createPlugin(credentialStore);
          const token = await plugin.authenticate();
          expect(token).toBe("test-token");
        },
        createMockKeytar(),
      );
    });

    test("generates auth URL with plain PKCE challenge", async () => {
      await withTestConfig(
        "mal-auth-url",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);

          const authUrl = await plugin.generateAuthUrl();
          expect(authUrl).toContain("code_challenge_method=plain");
          expect(authUrl).toContain("response_type=code");
        },
        createMockKeytar(),
      );
    });

    test("stores code verifier in credential store", async () => {
      await withTestConfig(
        "mal-auth-verifier",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);

          await plugin.generateAuthUrl();

          const verifier = await credentialStore.getCredential("mal_code_verifier");
          expect(verifier).toBeDefined();
          expect(verifier?.length).toBeGreaterThan(0);
        },
        createMockKeytar(),
      );
    });
  });

  describe("exchangeCode", () => {
    test("exchanges authorization code for tokens", async () => {
      await withTestConfig(
        "mal-exchange-code",
        async (_dir, _config, credentialStore) => {
          let capturedUrl = "";
          let capturedBody = "";

          const mockFetch = async (url: string | URL, init?: RequestInit) => {
            capturedUrl = url.toString();
            capturedBody = init?.body as string;
            return new Response(
              JSON.stringify({
                access_token: "new-access-token",
                refresh_token: "new-refresh-token",
                expires_in: 3600,
                token_type: "Bearer",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          await credentialStore.setCredential("mal_code_verifier", "test-verifier");

          const result = await plugin.exchangeCode("test-auth-code");

          expect(result.access_token).toBe("new-access-token");
          expect(result.refresh_token).toBe("new-refresh-token");
          expect(result.expires_at).toBeGreaterThan(Date.now());

          expect(capturedUrl).toContain("https://myanimelist.net/v1/oauth2/token");
          expect(capturedBody).toContain("grant_type=authorization_code");
          expect(capturedBody).toContain("code=test-auth-code");
          expect(capturedBody).toContain("code_verifier=test-verifier");

          const stored = await credentialStore.getCredential("mal");
          expect(stored).toBeDefined();
          const parsed = JSON.parse(stored ?? "{}");
          expect(parsed.access_token).toBe("new-access-token");
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError on exchange failure", async () => {
      await withTestConfig(
        "mal-exchange-fail",
        async (_dir, _config, credentialStore) => {
          const mockFetch = async () => {
            return new Response(
              JSON.stringify({ error: "invalid_grant", message: "Invalid code" }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          await credentialStore.setCredential("mal_code_verifier", "test-verifier");

          await expect(plugin.exchangeCode("bad-code")).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });

  describe("refreshSession", () => {
    test("refreshes expired token and updates keyring", async () => {
      await withTestConfig(
        "mal-refresh-token",
        async (_dir, _config, credentialStore) => {
          const expiredCredential = {
            access_token: "old-token",
            refresh_token: "refresh-token",
            expires_at: Date.now() - 1000,
          };
          await credentialStore.setCredential("mal", JSON.stringify(expiredCredential));

          const mockFetch = async (_url: string | URL, init?: RequestInit) => {
            const body = init?.body as string;
            if (body.includes("refresh_token")) {
              return new Response(
                JSON.stringify({
                  access_token: "refreshed-token",
                  refresh_token: "new-refresh-token",
                  expires_in: 3600,
                  token_type: "Bearer",
                }),
                { status: 200, headers: { "Content-Type": "application/json" } },
              );
            }
            return new Response("Unauthorized", { status: 401 });
          };

          const plugin = createPlugin(credentialStore, mockFetch);
          const result = await plugin.refreshSession();

          expect(result.access_token).toBe("refreshed-token");
          expect(result.refresh_token).toBe("new-refresh-token");

          const stored = await credentialStore.getCredential("mal");
          const parsed = JSON.parse(stored ?? "{}");
          expect(parsed.access_token).toBe("refreshed-token");
        },
        createMockKeytar(),
      );
    });

    test("throws TrackerError when refresh fails", async () => {
      await withTestConfig(
        "mal-refresh-fail",
        async (_dir, _config, credentialStore) => {
          const expiredCredential = {
            access_token: "old-token",
            refresh_token: "refresh-token",
            expires_at: Date.now() - 1000,
          };
          await credentialStore.setCredential("mal", JSON.stringify(expiredCredential));

          const mockFetch = async () => {
            return new Response(JSON.stringify({ error: "invalid_grant" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          };

          const plugin = createPlugin(credentialStore, mockFetch);
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
        expires_at: Date.now() + 3600000,
      };

      await withTestConfig(
        "mal-ensure-auth",
        async (_dir, _config, credentialStore) => {
          await credentialStore.setCredential("mal", JSON.stringify(credential));

          const mockFetch = async () => {
            return new Response(JSON.stringify({ data: [], paging: {} }), {
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
        "mal-ensure-auth-missing",
        async (_dir, _config, credentialStore) => {
          const plugin = createPlugin(credentialStore);
          await expect(plugin.ensureAuthenticated()).rejects.toThrow(TrackerError);
        },
        createMockKeytar(),
      );
    });
  });
});
