import type { ConfigManager } from "./config/config-manager";
import type { CredentialStore } from "./config/credential-store";
import { HttpClient } from "./http-client";
import { PluginRegistry } from "./plugin-registry";
import { AniDBPlugin } from "./plugins/database/anidb-plugin";
import type { DatabasePlugin } from "./plugins/database/plugin";
import { TVDBPlugin } from "./plugins/database/tvdb-plugin";
import { OpenSubtitlesPlugin } from "./plugins/subtitle/opensubtitles-plugin";
import type { SubtitlePlugin } from "./plugins/subtitle/plugin";

const CREDENTIAL_KEYS = {
  tvdb: "tvdb",
  anidb: "anidb",
  opensubtitles: "opensubtitles",
} as const;

const RATE_LIMITS = {
  tvdb: 200,
  anidb: 2000,
} as const;

interface DebugEntry {
  type: string;
  url: string;
  method: string;
  status?: number;
  body?: string;
}

export class PluginFactory {
  private registry: PluginRegistry;

  constructor(
    private config: ConfigManager,
    private credentialStore: CredentialStore,
    private debug?: boolean,
  ) {
    this.registry = new PluginRegistry();
    this.registry.setDisabled(config.getDisabledPlugins());
  }

  async primaryDatabase(): Promise<DatabasePlugin | undefined> {
    const name = this.config.get("primary-db") ?? "tvdb";
    return this.database(name);
  }

  async secondaryDatabases(): Promise<DatabasePlugin[]> {
    const names = this.config.getList("secondary-dbs");
    const plugins: DatabasePlugin[] = [];
    for (const name of names) {
      const plugin = await this.database(name);
      if (plugin) {
        plugins.push(plugin);
      }
    }
    return plugins;
  }

  async database(name: string): Promise<DatabasePlugin | undefined> {
    if (!this.registry.isEnabled(name)) {
      console.warn(`Plugin "${name}" is disabled`);
      return undefined;
    }
    switch (name) {
      case "tvdb": {
        const apiKey = await this.credentialStore.getCredential(CREDENTIAL_KEYS.tvdb);
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
        const credential = await this.credentialStore.getCredential(CREDENTIAL_KEYS.anidb);
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
      default: {
        const plugin = await this.registry.instantiate(name, this.debug ? { debug: true } : {});
        return plugin ?? undefined;
      }
    }
  }

  async subtitle(name?: string): Promise<SubtitlePlugin | undefined> {
    const pluginName = name ?? "opensubtitles";
    if (!(pluginName in CREDENTIAL_KEYS)) return undefined;

    const apiKey = await this.credentialStore.getCredential(
      CREDENTIAL_KEYS[pluginName as keyof typeof CREDENTIAL_KEYS],
    );
    if (!apiKey) {
      console.error(`No ${pluginName} API key configured. Run 'kogoro config init' first.`);
      return undefined;
    }
    const httpClient = new HttpClient(this.debugOptions());
    return new OpenSubtitlesPlugin({ apiKey, httpClient });
  }

  private debugOptions(): { onDebug?: (entry: DebugEntry) => void } {
    if (!this.debug) return {};
    return {
      onDebug: (entry) => {
        if (entry.type === "request") {
          console.error(`→ ${entry.method} ${entry.url}`);
        } else {
          const bodySuffix = entry.body ? `\n   body: ${entry.body}` : "";
          console.error(`← ${entry.status} ${entry.url}${bodySuffix}`);
        }
      },
    };
  }
}
