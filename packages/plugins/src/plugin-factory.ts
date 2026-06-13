import {
  type ConfigManager,
  type CredentialStore,
  type DatabasePlugin,
  type DebugEntry,
  HttpClient,
  type SubtitlePlugin,
} from "@kogoro/core";
import { AniDBPlugin } from "./database/anidb-plugin";
import { TVDBPlugin } from "./database/tvdb-plugin";
import { OpenSubtitlesPlugin } from "./subtitle/opensubtitles-plugin";

const RATE_LIMITS = {
  tvdb: 200,
  anidb: 2000,
} as const;

function isDatabasePlugin(obj: unknown): obj is DatabasePlugin {
  if (obj === null || typeof obj !== "object") return false;
  const p = obj as {
    searchAnime?: unknown;
    getAnime?: unknown;
    getEpisodes?: unknown;
    getArtwork?: unknown;
  };
  return (
    typeof p.searchAnime === "function" &&
    typeof p.getAnime === "function" &&
    typeof p.getEpisodes === "function" &&
    typeof p.getArtwork === "function"
  );
}

function prettifyBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
}

export class PluginFactory {
  private externalCache: Map<string, DatabasePlugin> = new Map();

  constructor(
    private config: ConfigManager,
    private credentialStore: CredentialStore,
    private debug?: boolean,
  ) {}

  async primaryDatabase(): Promise<DatabasePlugin | undefined> {
    const name = (this.config.get("primary-db") as string | undefined) ?? "tvdb";
    return this.database(name);
  }

  async database(name: string): Promise<DatabasePlugin | undefined> {
    if (!this.config.isPluginEnabled(name)) {
      console.warn(`Plugin "${name}" is disabled`);
      return undefined;
    }
    switch (name) {
      case "tvdb": {
        const apiKey = await this.credentialStore.getCredential("tvdb");
        if (!apiKey) {
          console.error("No TVDB API key configured. Run 'kogoro config init' first.");
          return undefined;
        }
        const httpClient = new HttpClient({
          minDelay: RATE_LIMITS.tvdb,
          ...this.debugOptions(),
        });
        return new TVDBPlugin({ apiKey, httpClient });
      }
      case "anidb": {
        const credential = await this.credentialStore.getCredential("anidb");
        if (!credential) {
          console.error("No AniDB credentials configured. Run 'kogoro config init' first.");
          return undefined;
        }
        const [client, clientver] = credential.split(":", 2);
        const httpClient = new HttpClient({
          minDelay: RATE_LIMITS.anidb,
          ...this.debugOptions(),
        });
        return new AniDBPlugin({
          client: client ?? credential,
          clientver: clientver ?? "1",
          httpClient,
        });
      }
      default:
        return this.loadExternalDatabasePlugin(name);
    }
  }

  async subtitle(name?: string): Promise<SubtitlePlugin | undefined> {
    const pluginName = name ?? "opensubtitles";
    const apiKey = await this.credentialStore.getCredential(pluginName);
    if (!apiKey) {
      console.error(`No ${pluginName} API key configured. Run 'kogoro config init' first.`);
      return undefined;
    }
    const httpClient = new HttpClient(this.debugOptions());
    return new OpenSubtitlesPlugin({ apiKey, httpClient });
  }

  private async loadExternalDatabasePlugin(name: string): Promise<DatabasePlugin | undefined> {
    const cached = this.externalCache.get(name);
    if (cached) return cached;

    try {
      const mod = await import(`kogoro-plugin-${name}`);
      const PluginConstructor = mod.default as new (options: Record<string, unknown>) => unknown;
      if (typeof PluginConstructor !== "function") {
        console.warn(`Plugin "${name}" does not export a constructor as default`);
        return undefined;
      }
      const instance = new PluginConstructor(this.debug ? { debug: true } : {});
      if (!isDatabasePlugin(instance)) {
        console.warn(`Plugin "${name}" does not implement DatabasePlugin interface`);
        return undefined;
      }
      this.externalCache.set(name, instance);
      return instance;
    } catch (err) {
      console.warn(`Failed to load external plugin "${name}": ${String(err)}`);
      return undefined;
    }
  }

  private debugOptions(): { onDebug?: (entry: DebugEntry) => void } {
    if (!this.debug) return {};
    return {
      onDebug: (entry) => {
        if (entry.type === "request") {
          console.error(`→ ${entry.method} ${entry.url}`);
        } else {
          let bodySuffix = "";
          if (entry.body) {
            const prettified = prettifyBody(entry.body);
            bodySuffix = `\n   ${prettified}`;
          }
          console.error(`← ${entry.status} ${entry.url} (${entry.ms}ms)${bodySuffix}`);
        }
      },
    };
  }
}
