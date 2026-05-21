import type { ConfigManager } from "./config/config-manager";
import { type CredentialStore, createCredentialStore } from "./config/credential-store";
import { type DebugCallback, HttpClient } from "./http-client";
import { PluginRegistry } from "./plugin-registry";
import { AniDBPlugin } from "./plugins/database/anidb-plugin";
import type { DatabasePlugin } from "./plugins/database/plugin";
import { TVDBPlugin } from "./plugins/database/tvdb-plugin";
import { OpenSubtitlesPlugin } from "./plugins/subtitle/opensubtitles-plugin";
import type { SubtitlePlugin } from "./plugins/subtitle/plugin";

const RATE_LIMITS = {
  tvdb: 200,
  anidb: 2000,
} as const;

export interface PluginFactoryOptions {
  config: ConfigManager;
  credentialStore?: CredentialStore;
  onDebug?: DebugCallback;
}

export class PluginFactory {
  private config: ConfigManager;
  private credentialStore: CredentialStore;
  private registry: PluginRegistry;
  private onDebug: DebugCallback | undefined;

  constructor(options: PluginFactoryOptions) {
    this.config = options.config;
    this.credentialStore = options.credentialStore ?? createCredentialStore();
    this.registry = new PluginRegistry();
    this.registry.setDisabled(this.config.getDisabledPlugins());
    this.onDebug = options.onDebug;
  }

  async primaryDatabase(): Promise<DatabasePlugin | undefined> {
    const name = this.config.get("primary-db") ?? "tvdb";
    return this.database(name);
  }

  async secondaryDatabases(): Promise<DatabasePlugin[]> {
    const names = this.config.getList("secondary-dbs");
    const dbs: DatabasePlugin[] = [];
    for (const name of names) {
      const db = await this.database(name);
      if (db) dbs.push(db);
    }
    return dbs;
  }

  async database(name: string): Promise<DatabasePlugin | undefined> {
    if (name === "tvdb") {
      const apiKey = await this.credentialStore.getCredential("tvdb");
      if (!apiKey) {
        console.error("No TVDB API key configured. Run 'kogoro config init' first.");
        return undefined;
      }
      const httpClient = new HttpClient({
        minDelay: RATE_LIMITS.tvdb,
        onDebug: this.onDebug,
      });
      return new TVDBPlugin({ apiKey, fetch: httpClient.fetch.bind(httpClient) });
    }

    if (name === "anidb") {
      const credential = await this.credentialStore.getCredential("anidb");
      if (!credential) {
        console.error("No AniDB credentials configured. Run 'kogoro config init' first.");
        return undefined;
      }
      const [client, clientver] = credential.split(":", 2);
      return new AniDBPlugin({
        client: client ?? credential,
        clientver: clientver ?? "1",
        httpClient: new HttpClient({
          minDelay: RATE_LIMITS.anidb,
          onDebug: this.onDebug,
        }),
      });
    }

    const plugin = await this.registry.instantiate(name, this.onDebug ? { debug: true } : {});
    if (!plugin) {
      console.warn(`Database "${name}" not available`);
    }
    return plugin ?? undefined;
  }

  async subtitle(): Promise<SubtitlePlugin | undefined> {
    const apiKey = await this.credentialStore.getCredential("opensubtitles");
    if (!apiKey) {
      console.error("No OpenSubtitles API key configured. Run 'kogoro config init' first.");
      return undefined;
    }
    const httpClient = new HttpClient({
      minDelay: 200,
      onDebug: this.onDebug,
    });
    return new OpenSubtitlesPlugin({ apiKey, fetch: httpClient.fetch.bind(httpClient) });
  }
}
