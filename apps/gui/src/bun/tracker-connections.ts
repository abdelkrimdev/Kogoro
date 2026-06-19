import type { CredentialStore } from "@kogoro/core";

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

interface TrackerDefinition {
  name: string;
  displayName: string;
  fields: TrackerCredentialField[];
  buildCredential: (values: Record<string, string>) => string | null;
  extractAccountInfo: (credential: string) => string | undefined;
}

const TRACKER_DEFINITIONS: TrackerDefinition[] = [
  {
    name: "anilist",
    displayName: "AniList",
    fields: [
      {
        name: "token",
        label: "API Token",
        type: "password",
        placeholder: "Enter your AniList API token",
      },
    ],
    buildCredential: (values) => {
      const token = values["token"] ?? "";
      return token || null;
    },
    extractAccountInfo: () => undefined,
  },
  {
    name: "kitsu",
    displayName: "Kitsu",
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
];

export async function getTrackerStatus(
  credentialStore: CredentialStore,
): Promise<TrackerConnectionInfo[]> {
  const statusList: TrackerConnectionInfo[] = [];
  for (const def of TRACKER_DEFINITIONS) {
    const credential = await credentialStore.getCredential(def.name);
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

export async function connectTracker(
  credentialStore: CredentialStore,
  params: { name: string; values: Record<string, string> },
): Promise<{ success: boolean; error?: string }> {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === params.name);
  if (!def) return { success: false, error: `Unknown tracker: ${params.name}` };

  const credential = def.buildCredential(params.values);
  if (!credential) {
    const requiredFields = def.fields.map((f) => f.label).join(" and ");
    return { success: false, error: `${requiredFields} are required` };
  }

  await credentialStore.setCredential(def.name, credential);
  return { success: true };
}

export async function disconnectTracker(
  credentialStore: CredentialStore,
  params: { name: string },
): Promise<{ success: boolean; error?: string }> {
  const def = TRACKER_DEFINITIONS.find((d) => d.name === params.name);
  if (!def) return { success: false, error: `Unknown tracker: ${params.name}` };

  await credentialStore.deleteCredential(def.name);
  return { success: true };
}
