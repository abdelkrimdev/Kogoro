import type { CredentialStore, EventRepository, LibraryService } from "@kogoro/core";
import { generateCodeVerifier, TrackerError } from "@kogoro/core";
import { type CallbackResult, CallbackServer } from "./callback-server";

function credentialDisplayLabel(credential: string, fallback?: string): string | undefined {
  try {
    JSON.parse(credential);
    return "Connected";
  } catch {
    return fallback;
  }
}

export interface TrackerConnectionInfo {
  name: string;
  displayName: string;
  connected: boolean;
  accountInfo?: string;
}

export interface TrackerCredentialField {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
}

export interface TrackerAuthInfo {
  authUrl?: string;
  instructions?: string;
}

interface TrackerDefinition {
  name: string;
  displayName: string;
  credentialKey: string;
  fields: TrackerCredentialField[];
  authUrl?: string;
  authUrlEnvVars?: Record<string, string>;
  instructions?: string;
  buildCredential: (values: Record<string, string>) => string | null;
  extractAccountInfo: (credential: string) => string | undefined;
}

const TRACKER_DEFINITIONS: TrackerDefinition[] = [
  {
    name: "anilist",
    displayName: "AniList",
    credentialKey: "anilist",
    fields: [],
    authUrl:
      "https://anilist.co/api/v2/oauth/authorize?client_id={client_id}&redirect_uri=http%3A%2F%2Flocalhost%3A43219%2Fcallback%2Fanilist&response_type=code",
    authUrlEnvVars: { client_id: "ANILIST_CLIENT_ID" },
    buildCredential: () => null,
    extractAccountInfo: (credential) => credentialDisplayLabel(credential),
  },
  {
    name: "kitsu",
    displayName: "Kitsu",
    credentialKey: "kitsu",
    fields: [
      { name: "username", label: "Username", type: "text", placeholder: "Kitsu username" },
      { name: "password", label: "Password", type: "password", placeholder: "Kitsu password" },
    ],
    buildCredential: (values) => {
      const username = values["username"] ?? "";
      const password = values["password"] ?? "";
      if (!username) return null;
      return `${username}:${password}`;
    },
    extractAccountInfo: (credential) => {
      const colonIndex = credential.indexOf(":");
      return credentialDisplayLabel(
        credential,
        colonIndex > 0 ? credential.slice(0, colonIndex) : undefined,
      );
    },
  },
  {
    name: "mal",
    displayName: "MyAnimeList",
    credentialKey: "mal",
    fields: [
      {
        name: "token",
        label: "Access Token",
        type: "password",
        placeholder: "Enter your MyAnimeList access token",
      },
    ],
    buildCredential: (values) => {
      const token = values["token"] ?? "";
      if (!token) return null;
      return JSON.stringify({
        access_token: token,
        expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
      });
    },
    extractAccountInfo: () => undefined,
  },
];

let callbackServer: CallbackServer | null = null;

export async function getTrackerStatus(
  credentialStore: CredentialStore,
): Promise<TrackerConnectionInfo[]> {
  const statusList: TrackerConnectionInfo[] = [];
  for (const def of TRACKER_DEFINITIONS) {
    const credential = await credentialStore.getCredential(def.credentialKey);
    statusList.push({
      name: def.name,
      displayName: def.displayName,
      connected: !!credential,
      accountInfo: credential ? def.extractAccountInfo(credential) : undefined,
    });
  }
  return statusList;
}

export function getTrackerConnectionFields(name: string): TrackerCredentialField[] {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === name);
  return def?.fields ?? [];
}

export function getTrackerAuthInfo(name: string): TrackerAuthInfo {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === name);
  let authUrl = def?.authUrl;
  if (authUrl && def?.authUrlEnvVars) {
    for (const [placeholder, envKey] of Object.entries(def.authUrlEnvVars)) {
      const value = process.env[envKey];
      if (value) {
        authUrl = authUrl.replace(`{${placeholder}}`, value);
      }
    }
  }
  return { authUrl, instructions: def?.instructions };
}

export async function connectTracker(
  credentialStore: CredentialStore,
  params: {
    name: string;
    values: Record<string, string>;
    onBeforeStore?: (name: string, values: Record<string, string>) => Promise<string | null>;
  },
): Promise<{ success: boolean; error?: string }> {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === params.name);
  if (!def) return { success: false, error: `Unknown tracker: ${params.name}` };

  const credential =
    (params.onBeforeStore ? await params.onBeforeStore(def.name, params.values) : null) ??
    def.buildCredential(params.values);
  if (!credential) {
    const requiredFields = def.fields.map((f) => f.label).join(" and ");
    return {
      success: false,
      error: requiredFields ? `${requiredFields} are required` : "Authentication required",
    };
  }

  await credentialStore.setCredential(def.credentialKey, credential);
  return { success: true };
}

export async function disconnectTracker(
  credentialStore: CredentialStore,
  libraryService: LibraryService,
  eventRepo: EventRepository,
  params: { name: string },
): Promise<{ success: boolean; error?: string }> {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === params.name);
  if (!def) return { success: false, error: `Unknown tracker: ${params.name}` };

  libraryService.removeTrackerMappingsBySource(def.name);
  eventRepo.dropForSource(def.name);
  await credentialStore.deleteCredential(def.credentialKey);
  return { success: true };
}

const OAUTH_CONFIGS: Record<
  string,
  {
    envKey: string;
    baseUrl: string;
    redirectPath: string;
    extraParams?: (verifier: string) => Record<string, string>;
  }
> = {
  anilist: {
    envKey: "ANILIST_CLIENT_ID",
    baseUrl: "https://anilist.co/api/v2/oauth/authorize",
    redirectPath: "/callback/anilist",
  },
  mal: {
    envKey: "MAL_CLIENT_ID",
    baseUrl: "https://myanimelist.net/v1/oauth2/authorize",
    redirectPath: "/callback/mal",
    extraParams: (verifier) => ({
      code_challenge: verifier,
      code_challenge_method: "plain",
      scope: "write:users",
    }),
  },
};

export async function startTrackerAuth(
  trackerName: string,
  credentialStore?: CredentialStore,
): Promise<{ authUrl: string; state: string }> {
  const config = OAUTH_CONFIGS[trackerName];
  if (!config) {
    throw new TrackerError("unknown", `OAuth flow not supported for ${trackerName}`, trackerName);
  }

  if (!callbackServer) {
    callbackServer = new CallbackServer();
  }
  await callbackServer.start();

  const state = callbackServer.generateState();
  const clientId = process.env[config.envKey];
  if (!clientId) {
    throw new TrackerError("unknown", `${config.envKey} environment variable not set`, trackerName);
  }

  let codeVerifier: string | undefined;
  if (config.extraParams) {
    codeVerifier = generateCodeVerifier();
    if (credentialStore) {
      await credentialStore.setCredential(`${trackerName}_code_verifier`, codeVerifier);
    }
  }

  const authUrl = new URL(config.baseUrl);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", `http://localhost:43219${config.redirectPath}`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  if (config.extraParams && codeVerifier) {
    for (const [key, value] of Object.entries(config.extraParams(codeVerifier))) {
      authUrl.searchParams.set(key, value);
    }
  }

  return { authUrl: authUrl.toString(), state };
}

export function waitForTrackerCallback(state: string): Promise<CallbackResult> {
  return new Promise((resolve) => {
    if (!callbackServer) {
      resolve({ code: "", state: "" });
      return;
    }

    callbackServer.waitForCallback(state, (result) => {
      resolve(result);
    });
  });
}

export async function cancelTrackerAuth(): Promise<void> {
  if (callbackServer) {
    await callbackServer.stop();
    callbackServer = null;
  }
}
