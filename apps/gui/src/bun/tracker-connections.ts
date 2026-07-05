import type { CredentialStore, EventRepository, LibraryService } from "@kogoro/core";

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
    fields: [
      {
        name: "pin",
        label: "PIN Code",
        type: "text",
        placeholder: "Paste the PIN code from AniList",
      },
    ],
    authUrl:
      "https://anilist.co/api/v2/oauth/authorize?client_id={client_id}&redirect_uri=https%3A%2F%2Fanilist.co%2Fapi%2Fv2%2Foauth%2Fpin&response_type=code",
    authUrlEnvVars: { client_id: "ANILIST_CLIENT_ID" },
    instructions:
      "1. Click the link below to authorize on AniList\n2. Copy the PIN code shown after authorizing\n3. Paste it here",
    buildCredential: (values) => {
      const pin = values["pin"] ?? "";
      return pin || null;
    },
    extractAccountInfo: () => undefined,
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
      return colonIndex > 0 ? credential.slice(0, colonIndex) : undefined;
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
      return token || null;
    },
    extractAccountInfo: () => undefined,
  },
];

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
    return { success: false, error: `${requiredFields} are required` };
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
