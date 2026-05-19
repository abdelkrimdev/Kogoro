import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabasePlugin } from "./db/database-plugin.ts";
import type { SubtitlePlugin } from "./subtitle/subtitle-plugin.ts";

export function isDatabasePlugin(obj: unknown): obj is DatabasePlugin {
  if (obj === null || typeof obj !== "object") return false;
  const p = obj as { searchAnime?: unknown; getEpisodes?: unknown; getArtwork?: unknown };
  return (
    typeof p.searchAnime === "function" &&
    typeof p.getEpisodes === "function" &&
    typeof p.getArtwork === "function"
  );
}

export function isSubtitlePlugin(obj: unknown): obj is SubtitlePlugin {
  if (obj === null || typeof obj !== "object") return false;
  const p = obj as { search?: unknown; download?: unknown };
  return typeof p.search === "function" && typeof p.download === "function";
}

export interface PluginInfo {
  name: string;
  type: "database" | "subtitle";
  source: "built-in" | "external";
  description?: string;
  enabled: boolean;
}

const BUILT_IN_DATABASE_PLUGINS: PluginInfo[] = [
  {
    name: "tvdb",
    type: "database",
    source: "built-in",
    description: "TheTVDB.com adapter",
    enabled: true,
  },
  {
    name: "anidb",
    type: "database",
    source: "built-in",
    description: "AniDB adapter",
    enabled: true,
  },
];

const BUILT_IN_SUBTITLE_PLUGINS: PluginInfo[] = [
  {
    name: "opensubtitles",
    type: "subtitle",
    source: "built-in",
    description: "OpenSubtitles.com adapter",
    enabled: true,
  },
];

export class PluginRegistry {
  private plugins: Map<string, PluginInfo> = new Map();
  private externalDiscovered = false;
  private instanceCache: Map<string, DatabasePlugin> = new Map();
  private subtitleCache: Map<string, SubtitlePlugin> = new Map();
  private disabledNames: Set<string> = new Set();

  constructor() {
    this.registerBuiltIn();
  }

  setDisabled(disabledNames: Set<string>): void {
    this.disabledNames = disabledNames;
    for (const [name, info] of this.plugins) {
      info.enabled = !disabledNames.has(name);
    }
  }

  isEnabled(name: string): boolean {
    const info = this.plugins.get(name);
    return info?.enabled ?? true;
  }

  async instantiate(
    name: string,
    options: Record<string, unknown>,
  ): Promise<DatabasePlugin | null> {
    if (!this.isEnabled(name)) {
      console.warn(`Plugin "${name}" is disabled`);
      return null;
    }

    const cached = this.instanceCache.get(name);
    if (cached) return cached;

    try {
      const mod = await import(`kogoro-plugin-${name}`);
      const PluginConstructor = mod.default as new (options: Record<string, unknown>) => unknown;
      if (typeof PluginConstructor !== "function") {
        console.warn(`Plugin "${name}" does not export a constructor as default`);
        return null;
      }
      const instance = new PluginConstructor(options);
      if (!isDatabasePlugin(instance)) {
        console.warn(`Plugin "${name}" does not implement DatabasePlugin interface`);
        return null;
      }
      this.instanceCache.set(name, instance);
      return instance;
    } catch (err) {
      console.warn(`Failed to load external plugin "${name}": ${String(err)}`);
      return null;
    }
  }

  async instantiateSubtitle(
    name: string,
    options: Record<string, unknown>,
  ): Promise<SubtitlePlugin | null> {
    if (!this.isEnabled(name)) {
      console.warn(`Plugin "${name}" is disabled`);
      return null;
    }

    const cached = this.subtitleCache.get(name);
    if (cached) return cached;

    try {
      const mod = await import(`kogoro-plugin-${name}`);
      const PluginConstructor = mod.default as new (options: Record<string, unknown>) => unknown;
      if (typeof PluginConstructor !== "function") {
        console.warn(`Plugin "${name}" does not export a constructor as default`);
        return null;
      }
      const instance = new PluginConstructor(options);
      if (!isSubtitlePlugin(instance)) {
        console.warn(`Plugin "${name}" does not implement SubtitlePlugin interface`);
        return null;
      }
      this.subtitleCache.set(name, instance);
      return instance;
    } catch (err) {
      console.warn(`Failed to load external subtitle plugin "${name}": ${String(err)}`);
      return null;
    }
  }

  private registerBuiltIn(): void {
    for (const plugin of [...BUILT_IN_DATABASE_PLUGINS, ...BUILT_IN_SUBTITLE_PLUGINS]) {
      this.plugins.set(plugin.name, { ...plugin });
    }
  }

  private discoverExternal(): void {
    for (const nmPath of this.getNodeModulesPaths()) {
      let entries: string[];
      try {
        entries = readdirSync(nmPath);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.startsWith("kogoro-plugin-") && !this.plugins.has(entry)) {
          const info = this.inferPluginInfo(entry);
          if (info) {
            this.plugins.set(entry, info);
          }
        }
      }
    }
  }

  private getNodeModulesPaths(): string[] {
    const paths: string[] = [];
    let current = process.cwd();
    while (true) {
      paths.push(join(current, "node_modules"));
      const parent = join(current, "..");
      if (parent === current) break;
      current = parent;
    }
    return paths;
  }

  private inferPluginInfo(packageName: string): PluginInfo | null {
    const name = packageName.replace("kogoro-plugin-", "");
    const type: PluginInfo["type"] = name.includes("subtitle") ? "subtitle" : "database";
    return {
      name,
      type,
      source: "external",
      description: `External plugin: ${packageName}`,
      enabled: !this.disabledNames.has(name),
    };
  }

  list(): PluginInfo[] {
    if (!this.externalDiscovered) {
      this.discoverExternal();
      this.externalDiscovered = true;
    }
    return Array.from(this.plugins.values());
  }

  getDatabasePlugins(): PluginInfo[] {
    return this.list().filter((p) => p.type === "database");
  }

  getSubtitlePlugins(): PluginInfo[] {
    return this.list().filter((p) => p.type === "subtitle");
  }
}
