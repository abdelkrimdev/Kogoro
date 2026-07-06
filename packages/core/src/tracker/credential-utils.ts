import type { CredentialStore } from "../config/credential-store";
import { type TrackerCredential, TrackerError } from "../types";

export type RefreshFn = () => Promise<TrackerCredential>;

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const binary = Array.from(array, (b) => String.fromCharCode(b)).join("");
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function throwHttpError(response: Response, trackerName: string, context?: string): never {
  const label = context ? `${context}: ` : "";
  switch (response.status) {
    case 401:
      throw new TrackerError("auth_expired", `${label}${trackerName} token expired`, trackerName);
    case 403:
      throw new TrackerError(
        "auth_invalid",
        `${label}${trackerName} access denied (check token permissions)`,
        trackerName,
      );
    case 429:
      throw new TrackerError(
        "rate_limited",
        `${label}${trackerName} rate limit exceeded`,
        trackerName,
      );
    default:
      throw new TrackerError(
        "unknown",
        `${label}${trackerName} API error: ${response.status} ${response.statusText}`,
        trackerName,
      );
  }
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
