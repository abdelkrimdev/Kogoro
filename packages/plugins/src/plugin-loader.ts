import type { CredentialStore, DatabasePlugin, SubtitlePlugin, TrackerPlugin } from "@kogoro/core";
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

function isTrackerPlugin(obj: unknown): obj is TrackerPlugin {
  if (obj === null || typeof obj !== "object") return false;
  const p = obj as {
    authenticate?: unknown;
    getUserList?: unknown;
    getEntry?: unknown;
    updateEntry?: unknown;
    getAnimeDetails?: unknown;
  };
  return (
    typeof p.authenticate === "function" &&
    typeof p.getUserList === "function" &&
    typeof p.getEntry === "function" &&
    typeof p.updateEntry === "function" &&
    typeof p.getAnimeDetails === "function"
  );
}

export class PluginLoader {
  private databaseCache: Map<string, DatabasePlugin> = new Map();
  private subtitleCache: Map<string, SubtitlePlugin> = new Map();
  private trackerCache: Map<string, TrackerPlugin> = new Map();
  private externalCache: Map<string, DatabasePlugin> = new Map();
  private externalTrackerCache: Map<string, TrackerPlugin> = new Map();

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
    const cached = this.databaseCache.get(name);
    if (cached) return cached;
    const entry = getManifestEntry(name);
    if (entry && entry.type === "database") {
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

  async loadTracker(
    name: string,
    plugins: Record<string, { enabled: boolean }> | undefined,
    credentialStore: CredentialStore,
  ): Promise<TrackerPlugin | undefined> {
    if (!isPluginEnabled(name, plugins)) {
      console.warn(`Plugin "${name}" is disabled`);
      return undefined;
    }
    const cached = this.trackerCache.get(name);
    if (cached) return cached;
    const entry = getManifestEntry(name);
    if (entry && entry.type === "tracker") {
      const ctx: PluginLoadContext = { credentialStore, debug: this.debug };
      const plugin = await entry.load(ctx, entry);
      if (plugin) {
        this.trackerCache.set(name, plugin as TrackerPlugin);
      }
      return plugin as TrackerPlugin | undefined;
    }
    return this.loadExternalTrackerPlugin(name);
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

  private async loadExternalTrackerPlugin(name: string): Promise<TrackerPlugin | undefined> {
    const cached = this.externalTrackerCache.get(name);
    if (cached) return cached;

    try {
      const mod = await import(`kogoro-tracker-${name}`);
      const PluginConstructor = mod.default as new (options: Record<string, unknown>) => unknown;
      if (typeof PluginConstructor !== "function") {
        console.warn(`Plugin "${name}" does not export a constructor as default`);
        return undefined;
      }
      const instance = new PluginConstructor(this.debug ? { debug: true } : {});
      if (!isTrackerPlugin(instance)) {
        console.warn(`Plugin "${name}" does not implement TrackerPlugin interface`);
        return undefined;
      }
      this.externalTrackerCache.set(name, instance);
      return instance;
    } catch (err) {
      console.warn(`Failed to load external tracker plugin "${name}": ${String(err)}`);
      return undefined;
    }
  }
}
