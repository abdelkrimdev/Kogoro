import type {
  ConfigManager,
  CredentialStore,
  DatabasePlugin,
  SubtitlePlugin,
  TrackerPlugin,
} from "@kogoro/core";
import { PluginLoader } from "./plugin-loader";
import { type PluginInfo, PluginRegistry } from "./plugin-registry";

export type { PluginInfo } from "./plugin-registry";

export class PluginFactory {
  private registry = new PluginRegistry();
  private loader: PluginLoader;

  constructor(
    private config: ConfigManager,
    private credentialStore: CredentialStore,
    debug?: boolean,
  ) {
    this.loader = new PluginLoader(debug);
  }

  async primaryDatabase(): Promise<DatabasePlugin | undefined> {
    return this.database(this.config.primaryDb);
  }

  async database(name: string): Promise<DatabasePlugin | undefined> {
    return this.loader.loadDatabase(name, this.config.plugins, this.credentialStore);
  }

  async subtitle(name?: string): Promise<SubtitlePlugin | undefined> {
    return this.loader.loadSubtitle(name ?? "opensubtitles", this.credentialStore);
  }

  async tracker(name: string): Promise<TrackerPlugin | undefined> {
    return this.loader.loadTracker(name, this.config.plugins, this.credentialStore);
  }

  list(): PluginInfo[] {
    return this.registry.list(this.config.plugins);
  }
}
