import type { CredentialStore, DatabasePlugin, SubtitlePlugin } from "@kogoro/core";
import { getManifestEntry, type PluginLoadContext } from "./plugin-manifest";
import { isPluginEnabled } from "./plugin-registry";

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

export class PluginLoader {
  private databaseCache: Map<string, DatabasePlugin> = new Map();
  private subtitleCache: Map<string, SubtitlePlugin> = new Map();
  private externalCache: Map<string, DatabasePlugin> = new Map();

  constructor(private debug?: boolean) {}

  async loadDatabase(
    name: string,
    plugins: Record<string, { enabled: boolean }> | undefined,
    credentialStore: CredentialStore,
  ): Promise<DatabasePlugin | undefined> {
    if (!isPluginEnabled(name, plugins)) {
      console.warn(`Plugin "${name}" is disabled`);
      return undefined;
    }
    const entry = getManifestEntry(name);
    if (entry && entry.type === "database") {
      const cached = this.databaseCache.get(name);
      if (cached) return cached;
      const ctx: PluginLoadContext = { credentialStore, debug: this.debug };
      const plugin = await entry.load(ctx, entry);
      if (plugin) {
        this.databaseCache.set(name, plugin as DatabasePlugin);
      }
      return plugin as DatabasePlugin | undefined;
    }
    return this.loadExternalDatabasePlugin(name);
  }

  async loadSubtitle(
    name: string,
    credentialStore: CredentialStore,
  ): Promise<SubtitlePlugin | undefined> {
    const cached = this.subtitleCache.get(name);
    if (cached) return cached;
    const entry = getManifestEntry(name);
    if (entry && entry.type === "subtitle") {
      const ctx: PluginLoadContext = { credentialStore, debug: this.debug };
      const plugin = await entry.load(ctx, entry);
      if (plugin) {
        this.subtitleCache.set(name, plugin as SubtitlePlugin);
      }
      return plugin as SubtitlePlugin | undefined;
    }
    console.warn(`Unknown subtitle plugin: "${name}"`);
    return undefined;
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
}
