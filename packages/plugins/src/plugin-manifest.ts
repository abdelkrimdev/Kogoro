import {
  type CredentialStore,
  type DatabasePlugin,
  type DebugEntry,
  HttpClient,
  type SubtitlePlugin,
  type TrackerPlugin,
} from "@kogoro/core";
import { AniDBPlugin } from "./database/anidb-plugin";
import { TVDBPlugin } from "./database/tvdb-plugin";
import { OpenSubtitlesPlugin } from "./subtitle/opensubtitles-plugin";
import { MyAnimeListPlugin } from "./tracker/myanimelist-plugin";

export interface PluginLoadContext {
  credentialStore: CredentialStore;
  debug?: boolean;
}

export interface PluginManifestEntry {
  name: string;
  type: "database" | "subtitle" | "tracker";
  description: string;
  baseUrl: string;
  rateLimit?: number;
  credentialKey: string;
  load: (
    ctx: PluginLoadContext,
    entry: PluginManifestEntry,
  ) => Promise<DatabasePlugin | SubtitlePlugin | TrackerPlugin | undefined>;
}

function debugOptions(debug?: boolean): { onDebug?: (entry: DebugEntry) => void } {
  if (!debug) return {};
  return {
    onDebug: (entry) => {
      if (entry.type === "request") {
        console.error(`→ ${entry.method} ${entry.url}`);
      } else {
        let bodySuffix = "";
        if (entry.body) {
          try {
            const parsed = JSON.parse(entry.body) as unknown;
            bodySuffix = `\n   ${JSON.stringify(parsed, null, 2)}`;
          } catch {
            bodySuffix = `\n   ${entry.body}`;
          }
        }
        console.error(`← ${entry.status} ${entry.url} (${entry.ms}ms)${bodySuffix}`);
      }
    },
  };
}

async function loadTvdb(
  ctx: PluginLoadContext,
  entry: PluginManifestEntry,
): Promise<DatabasePlugin | undefined> {
  const apiKey = await ctx.credentialStore.getCredential(entry.credentialKey);
  if (!apiKey) {
    console.error(`No ${entry.name} API key configured. Run 'kogoro config init' first.`);
    return undefined;
  }
  const httpClient = new HttpClient({
    minDelay: entry.rateLimit,
    ...debugOptions(ctx.debug),
  });
  return new TVDBPlugin({ apiKey, baseUrl: entry.baseUrl, httpClient });
}

async function loadAnidb(
  ctx: PluginLoadContext,
  entry: PluginManifestEntry,
): Promise<DatabasePlugin | undefined> {
  const credential = await ctx.credentialStore.getCredential(entry.credentialKey);
  if (!credential) {
    console.error(`No ${entry.name} credentials configured. Run 'kogoro config init' first.`);
    return undefined;
  }
  const [client, clientver] = credential.split(":", 2);
  const httpClient = new HttpClient({
    minDelay: entry.rateLimit,
    ...debugOptions(ctx.debug),
  });
  return new AniDBPlugin({
    client: client ?? credential,
    clientver: clientver ?? "1",
    baseUrl: entry.baseUrl,
    httpClient,
  });
}

async function loadOpenSubtitles(
  ctx: PluginLoadContext,
  entry: PluginManifestEntry,
): Promise<SubtitlePlugin | undefined> {
  const apiKey = await ctx.credentialStore.getCredential(entry.credentialKey);
  if (!apiKey) {
    console.error(`No ${entry.name} API key configured. Run 'kogoro config init' first.`);
    return undefined;
  }
  const httpClient = new HttpClient(debugOptions(ctx.debug));
  return new OpenSubtitlesPlugin({ apiKey, baseUrl: entry.baseUrl, httpClient });
}

async function loadMyAnimeList(
  ctx: PluginLoadContext,
  entry: PluginManifestEntry,
): Promise<TrackerPlugin | undefined> {
  const httpClient = new HttpClient({
    minDelay: entry.rateLimit,
    ...debugOptions(ctx.debug),
  });
  return new MyAnimeListPlugin({
    credentialStore: ctx.credentialStore,
    httpClient,
  });
}

export const BUILT_IN_MANIFEST: PluginManifestEntry[] = [
  {
    name: "tvdb",
    type: "database",
    description: "TheTVDB.com plugin",
    baseUrl: "https://api4.thetvdb.com/v4",
    rateLimit: 200,
    credentialKey: "tvdb",
    load: loadTvdb,
  },
  {
    name: "anidb",
    type: "database",
    description: "AniDB plugin",
    baseUrl: "http://api.anidb.net:9001/httpapi",
    rateLimit: 2000,
    credentialKey: "anidb",
    load: loadAnidb,
  },
  {
    name: "opensubtitles",
    type: "subtitle",
    description: "OpenSubtitles.com plugin",
    baseUrl: "https://api.opensubtitles.com/api/v1",
    credentialKey: "opensubtitles",
    load: loadOpenSubtitles,
  },
  {
    name: "myanimelist",
    type: "tracker",
    description: "MyAnimeList.net plugin",
    baseUrl: "https://api.myanimelist.net/v2",
    rateLimit: 500,
    credentialKey: "mal",
    load: loadMyAnimeList,
  },
];

export function getManifestEntry(name: string): PluginManifestEntry | undefined {
  return BUILT_IN_MANIFEST.find((e) => e.name === name);
}
