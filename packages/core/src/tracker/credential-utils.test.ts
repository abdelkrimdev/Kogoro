import { describe, expect, test } from "bun:test";
import { createHttpResponse, createMockKeytar, withTestConfig } from "@kogoro/core/testing";
import { isAuthError, TrackerError, type TrackerErrorType } from "../types";
import {
  buildCredentialFromToken,
  loadOrRefreshCredential,
  type RefreshFn,
  throwHttpError,
} from "./credential-utils";

describe("TrackerError", () => {
  test("constructs with type, message, and optional tracker", () => {
    const error = new TrackerError("auth_expired", "Token expired", "mal");
    expect(error.name).toBe("TrackerError");
    expect(error.type).toBe("auth_expired");
    expect(error.message).toBe("Token expired");
    expect(error.tracker).toBe("mal");
  });

  test("constructs without tracker", () => {
    const error = new TrackerError("network", "Connection failed");
    expect(error.tracker).toBeUndefined();
  });

  test("is instance of Error", () => {
    const error = new TrackerError("unknown", "Unknown error");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("isAuthError", () => {
  test("returns true for auth_expired errors", () => {
    const error = new TrackerError("auth_expired", "Token expired");
    expect(isAuthError(error)).toBe(true);
  });

  test("returns true for auth_invalid errors", () => {
    const error = new TrackerError("auth_invalid", "Invalid credentials");
    expect(isAuthError(error)).toBe(true);
  });

  test("returns false for other TrackerError types", () => {
    const error = new TrackerError("rate_limited", "Too many requests");
    expect(isAuthError(error)).toBe(false);
  });

  test("returns false for non-TrackerError", () => {
    const error = new Error("Regular error");
    expect(isAuthError(error)).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isAuthError("string")).toBe(false);
    expect(isAuthError(null)).toBe(false);
    expect(isAuthError(undefined)).toBe(false);
  });
});

describe("buildCredentialFromToken", () => {
  test("sets expires_at from expiresIn", () => {
    const before = Date.now();
    const result = buildCredentialFromToken("token", 3600);
    const after = Date.now();

    expect(result.access_token).toBe("token");
    expect(result.expires_at).toBeGreaterThanOrEqual(before + 3600000);
    expect(result.expires_at).toBeLessThanOrEqual(after + 3600000);
    expect(result.refresh_token).toBeUndefined();
  });

  test("sets expires_at to undefined when expiresIn is not provided", () => {
    const result = buildCredentialFromToken("token");
    expect(result.access_token).toBe("token");
    expect(result.expires_at).toBeUndefined();
    expect(result.refresh_token).toBeUndefined();
  });

  test("includes refresh_token when provided", () => {
    const result = buildCredentialFromToken("token", 3600, "refresh-value");
    expect(result.refresh_token).toBe("refresh-value");
  });
});

describe("loadOrRefreshCredential", () => {
  test("loads valid credential from store", async () => {
    const credential = {
      access_token: "test-token",
      refresh_token: "refresh-token",
      expires_at: Date.now() + 3600000,
    };

    await withTestConfig(
      "load-valid-credential",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(credential));
        const result = await loadOrRefreshCredential(credentialStore, "mal");
        expect(result).toEqual(credential);
      },
      createMockKeytar(),
    );
  });

  test("throws auth_invalid when credential not found", async () => {
    await withTestConfig(
      "load-missing-credential",
      async (_dir, _config, credentialStore) => {
        await expect(loadOrRefreshCredential(credentialStore, "mal")).rejects.toThrow(TrackerError);
      },
      createMockKeytar(),
    );
  });

  test("throws auth_invalid when credential format is invalid", async () => {
    await withTestConfig(
      "load-invalid-format",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", "not-json");
        await expect(loadOrRefreshCredential(credentialStore, "mal")).rejects.toThrow(TrackerError);
      },
      createMockKeytar(),
    );
  });

  test("returns credential when not expired", async () => {
    const credential = {
      access_token: "test-token",
      expires_at: Date.now() + 3600000,
    };

    await withTestConfig(
      "load-not-expired",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(credential));
        const result = await loadOrRefreshCredential(credentialStore, "mal");
        expect(result.access_token).toBe("test-token");
      },
      createMockKeytar(),
    );
  });

  test("calls refreshFn when token expired", async () => {
    const expiredCredential = {
      access_token: "old-token",
      refresh_token: "refresh-token",
      expires_at: Date.now() - 1000,
    };

    const newCredential = {
      access_token: "new-token",
      refresh_token: "new-refresh",
      expires_at: Date.now() + 3600000,
    };

    await withTestConfig(
      "load-expired-refresh",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(expiredCredential));

        const refreshFn: RefreshFn = async () => newCredential;
        const result = await loadOrRefreshCredential(credentialStore, "mal", refreshFn);

        expect(result).toEqual(newCredential);

        const stored = await credentialStore.getCredential("mal");
        expect(JSON.parse(stored ?? "{}")).toEqual(newCredential);
      },
      createMockKeytar(),
    );
  });

  test("throws auth_expired when no refreshFn provided and token expired", async () => {
    const expiredCredential = {
      access_token: "old-token",
      expires_at: Date.now() - 1000,
    };

    await withTestConfig(
      "load-expired-no-refresh",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(expiredCredential));
        await expect(loadOrRefreshCredential(credentialStore, "mal")).rejects.toThrow(TrackerError);
      },
      createMockKeytar(),
    );
  });

  test("throws TrackerError when refreshFn fails", async () => {
    const expiredCredential = {
      access_token: "old-token",
      expires_at: Date.now() - 1000,
    };

    await withTestConfig(
      "load-refresh-fails",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(expiredCredential));

        const refreshFn: RefreshFn = async () => {
          throw new Error("Refresh failed");
        };

        await expect(loadOrRefreshCredential(credentialStore, "mal", refreshFn)).rejects.toThrow(
          TrackerError,
        );
      },
      createMockKeytar(),
    );
  });

  test("returns credential without expires_at (never expires)", async () => {
    const credential = {
      access_token: "test-token",
    };

    await withTestConfig(
      "load-no-expires",
      async (_dir, _config, credentialStore) => {
        await credentialStore.setCredential("mal", JSON.stringify(credential));
        const result = await loadOrRefreshCredential(credentialStore, "mal");
        expect(result.access_token).toBe("test-token");
      },
      createMockKeytar(),
    );
  });
});

describe("throwHttpError", () => {
  const expectTrackerError = (
    fn: () => never,
    expectedType: TrackerErrorType,
    expectedMessage: string,
  ) => {
    try {
      fn();
      throw new Error("Expected throwHttpError to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TrackerError);
      expect((e as TrackerError).type).toBe(expectedType);
      expect((e as TrackerError).message).toBe(expectedMessage);
    }
  };

  test("throws auth_expired for 401 status", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(401), "mal"),
      "auth_expired",
      "mal token expired",
    );
  });

  test("throws auth_expired for AniList 403", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(403), "anilist"),
      "auth_expired",
      "anilist token expired or invalid",
    );
  });

  test("throws unknown for AniList 403 when temporarily disabled", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(403, "API temporarily disabled"), "anilist"),
      "unknown",
      "AniList API is temporarily unavailable",
    );
  });

  test("throws auth_invalid for non-AniList 403", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(403), "mal"),
      "auth_invalid",
      "mal access denied (check token permissions)",
    );
  });

  test("throws rate_limited for 429 status", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(429), "kitsu"),
      "rate_limited",
      "kitsu rate limit exceeded",
    );
  });

  test("includes context prefix in error message", () => {
    expectTrackerError(
      () => throwHttpError(createHttpResponse(401), "mal", "Fetch failed"),
      "auth_expired",
      "Fetch failed: mal token expired",
    );
  });
});
