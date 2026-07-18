import type { CredentialStore } from "../config/credential-store";
import { type TrackerCredential, TrackerError, type TrackerWatchStatus } from "../types";

export type LocalWatchStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";

export function mapTrackerStatus(status: TrackerWatchStatus): LocalWatchStatus {
  switch (status) {
    case "plan-to-watch":
      return "plan_to_watch";
    case "on-hold":
      return "on_hold";
    default:
      return status;
  }
}

export function mapLocalStatusToTracker(status: string): TrackerWatchStatus {
  switch (status) {
    case "plan_to_watch":
      return "plan-to-watch";
    case "on_hold":
      return "on-hold";
    default:
      return status as TrackerWatchStatus;
  }
}

export const ANILIST_CLIENT_ID = "45221";
export const ANILIST_REDIRECT_URI = "http://localhost:43219/callback/anilist";
export const MAL_CLIENT_ID = "97e4bfe9c07f9e679ec96e4906862030";
export const MAL_REDIRECT_URI = "http://localhost:43219/callback/mal";

export type RefreshFn = () => Promise<TrackerCredential>;

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const binary = Array.from(array, (b) => String.fromCharCode(b)).join("");
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isAuthErrorMessage(msg: string): boolean {
  return msg === "Invalid token" || msg === "Unauthorized.";
}

interface GraphQLErrorEntry {
  message: string;
  status?: number;
}

export function throwHttpError(
  response: Response,
  trackerName: string,
  context?: string,
  graphqlErrors?: GraphQLErrorEntry[],
): never {
  const label = context ? `${context}: ` : "";
  const gqlError = graphqlErrors?.[0];
  const effectiveStatus = gqlError?.status ?? response.status;
  const msg = gqlError?.message ?? response.statusText;

  if (effectiveStatus === 401 || (gqlError && isAuthErrorMessage(msg))) {
    throw new TrackerError("auth_expired", `${label}${trackerName} token expired`, trackerName);
  }
  if (effectiveStatus === 403) {
    if (trackerName === "anilist") {
      if (msg?.includes("temporarily disabled")) {
        throw new TrackerError(
          "unknown",
          `${label}AniList API is temporarily unavailable`,
          trackerName,
        );
      }
      throw new TrackerError(
        "auth_expired",
        `${label}${trackerName} token expired or invalid`,
        trackerName,
      );
    }
    throw new TrackerError(
      "auth_invalid",
      `${label}${trackerName} access denied (check token permissions)`,
      trackerName,
    );
  }
  if (effectiveStatus === 429) {
    throw new TrackerError(
      "rate_limited",
      `${label}${trackerName} rate limit exceeded`,
      trackerName,
    );
  }
  if (!response.ok) {
    throw new TrackerError(
      "unknown",
      `${label}${trackerName} API error: ${response.status} ${msg}`,
      trackerName,
    );
  }
  throw new TrackerError("unknown", `${label}${trackerName} GraphQL error: ${msg}`, trackerName);
}

async function parseStoredCredential(
  credentialStore: CredentialStore,
  trackerName: string,
): Promise<TrackerCredential> {
  const stored = await credentialStore.getCredential(trackerName);
  if (!stored) {
    throw new TrackerError("auth_invalid", `${trackerName} credentials not found`, trackerName);
  }

  try {
    return JSON.parse(stored) as TrackerCredential;
  } catch {
    throw new TrackerError("auth_invalid", `Invalid ${trackerName} credential format`, trackerName);
  }
}

export async function loadOrRefreshCredential(
  credentialStore: CredentialStore,
  trackerName: string,
  refreshFn?: RefreshFn,
): Promise<TrackerCredential> {
  const credential = await parseStoredCredential(credentialStore, trackerName);

  if (credential.expires_at && credential.expires_at < Date.now()) {
    if (!refreshFn) {
      throw new TrackerError(
        "auth_expired",
        `${trackerName} token expired and no refresh function provided`,
        trackerName,
      );
    }

    try {
      const refreshed = await refreshFn();
      await credentialStore.setCredential(trackerName, JSON.stringify(refreshed));
      return refreshed;
    } catch (error) {
      if (error instanceof TrackerError) {
        throw error;
      }
      throw new TrackerError(
        "auth_expired",
        `Failed to refresh ${trackerName} token: ${error instanceof Error ? error.message : "Unknown error"}`,
        trackerName,
      );
    }
  }

  return credential;
}

export interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  message?: string;
  error_description?: string;
}

export async function loadStoredCredential(
  credentialStore: CredentialStore,
  trackerName: string,
): Promise<TrackerCredential> {
  const credential = await parseStoredCredential(credentialStore, trackerName);

  if (!credential.refresh_token) {
    throw new TrackerError("auth_expired", `${trackerName} has no refresh token`, trackerName);
  }

  return credential;
}

export function parseOAuthTokenResponse(json: OAuthTokenResponse): TrackerCredential {
  return buildCredentialFromToken(json.access_token ?? "", json.expires_in, json.refresh_token);
}

export function buildCredentialFromToken(
  token: string,
  expiresIn?: number,
  refreshToken?: string,
): TrackerCredential {
  return {
    access_token: token,
    refresh_token: refreshToken,
    expires_at: expiresIn != null ? Date.now() + expiresIn * 1000 : undefined,
  };
}
