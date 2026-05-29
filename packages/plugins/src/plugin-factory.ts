import {
  type ConfigManager,
  type CredentialStore,
  type DebugEntry,
  HttpClient,
} from "@kogoro/core";
import { AniDBPlugin } from "./database/anidb-plugin";
import type { DatabasePlugin } from "./database/plugin";
import { TVDBPlugin } from "./database/tvdb-plugin";
import { PluginRegistry } from "./plugin-registry";
import { OpenSubtitlesPlugin } from "./subtitle/opensubtitles-plugin";
import type { SubtitlePlugin } from "./subtitle/plugin";

const RATE_LIMITS = {
  tvdb: 200,
  anidb: 2000,
} as const;

function prettifyBody(body: string): string {
  try {
    const parsed = JSON.parse(body) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return body;
  }
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
    const name = (this.config.get("primary-db") as string | undefined) ?? "tvdb";
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
      default: {
        const plugin = await this.registry.instantiate(name, this.debug ? { debug: true } : {});
        return plugin ?? undefined;
      }
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
