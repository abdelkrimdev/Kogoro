import type { CredentialStore, EventRepository, LibraryService } from "@kogoro/core";
import {
  ANILIST_CLIENT_ID,
  ANILIST_REDIRECT_URI,
  generateCodeVerifier,
  MAL_CLIENT_ID,
  MAL_REDIRECT_URI,
  TrackerError,
} from "@kogoro/core";
import { type CallbackResult, CallbackServer } from "./callback-server";

export interface TrackerConnectionInfo {
  name: string;
  displayName: string;
  connected: boolean;
}

export interface TrackerCredentialField {
  name: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
}

export interface TrackerAuthInfo {
  instructions?: string;
}

interface TrackerDefinition {
  name: string;
  displayName: string;
  credentialKey: string;
  fields: TrackerCredentialField[];
  instructions?: string;
  buildCredential: (values: Record<string, string>) => string | null;
  oauth?: {
    clientId: string;
    baseUrl: string;
    redirectUri: string;
    responseType: string;
    includeRedirectUri?: boolean;
    extraParams?: (verifier: string) => Record<string, string>;
  };
}

const TRACKER_DEFINITIONS: TrackerDefinition[] = [
  {
    name: "anilist",
    displayName: "AniList",
    credentialKey: "anilist",
    fields: [],
    instructions: "You'll be redirected to AniList to authorize.",
    buildCredential: () => null,
    oauth: {
      clientId: ANILIST_CLIENT_ID,
      baseUrl: "https://anilist.co/api/v2/oauth/authorize",
      redirectUri: ANILIST_REDIRECT_URI,
      responseType: "token",
      includeRedirectUri: false,
    },
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
  },
  {
    name: "mal",
    displayName: "MyAnimeList",
    credentialKey: "mal",
    fields: [],
    instructions: "You'll be redirected to MyAnimeList to authorize.",
    buildCredential: () => null,
    oauth: {
      clientId: MAL_CLIENT_ID,
      baseUrl: "https://myanimelist.net/v1/oauth2/authorize",
      redirectUri: MAL_REDIRECT_URI,
      responseType: "code",
      extraParams: (verifier) => ({
        code_challenge: verifier,
        code_challenge_method: "plain",
        scope: "write:users",
      }),
    },
  },
];

let callbackServer: CallbackServer | null = null;

function findTrackerDef(name: string): TrackerDefinition | undefined {
  return TRACKER_DEFINITIONS.find((d) => d.name === name);
}

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
    });
  }
  return statusList;
}

export function getTrackerConnectionFields(name: string): TrackerCredentialField[] {
  return findTrackerDef(name)?.fields ?? [];
}

export function getTrackerAuthInfo(name: string): TrackerAuthInfo {
  return { instructions: findTrackerDef(name)?.instructions };
}

export async function connectTracker(
  credentialStore: CredentialStore,
  params: {
    name: string;
    values: Record<string, string>;
    onBeforeStore?: (name: string, values: Record<string, string>) => Promise<string | null>;
  },
): Promise<{ success: boolean; error?: string }> {
  const def = findTrackerDef(params.name);
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
  const def = findTrackerDef(params.name);
  if (!def) return { success: false, error: `Unknown tracker: ${params.name}` };

  libraryService.removeTrackerMappingsBySource(def.name);
  eventRepo.dropForSource(def.name);
  await credentialStore.deleteCredential(def.credentialKey);
  return { success: true };
}

export async function startTrackerAuth(
  trackerName: string,
  credentialStore?: CredentialStore,
): Promise<{ authUrl: string; state: string }> {
  const def = findTrackerDef(trackerName);
  if (!def?.oauth) {
    throw new TrackerError("unknown", `OAuth flow not supported for ${trackerName}`, trackerName);
  }

  if (!callbackServer) {
    callbackServer = new CallbackServer();
  }
  await callbackServer.start();

  const state = callbackServer.generateState();
  const { oauth } = def;

  let codeVerifier: string | undefined;
  if (oauth.extraParams) {
    codeVerifier = generateCodeVerifier();
    if (credentialStore) {
      await credentialStore.setCredential(`${trackerName}_code_verifier`, codeVerifier);
    }
  }

  const authUrl = new URL(oauth.baseUrl);
  authUrl.searchParams.set("client_id", oauth.clientId);
  if (oauth.includeRedirectUri !== false) {
    authUrl.searchParams.set("redirect_uri", oauth.redirectUri);
  }
  authUrl.searchParams.set("response_type", oauth.responseType);
  authUrl.searchParams.set("state", state);

  if (oauth.extraParams && codeVerifier) {
    for (const [key, value] of Object.entries(oauth.extraParams(codeVerifier))) {
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
