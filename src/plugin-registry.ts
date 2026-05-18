import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface PluginInfo {
  name: string;
  type: "database" | "subtitle";
  source: "built-in" | "external";
  description?: string;
}

const BUILT_IN_DATABASE_PLUGINS: PluginInfo[] = [
  { name: "tvdb", type: "database", source: "built-in", description: "TheTVDB.com adapter" },
  { name: "anidb", type: "database", source: "built-in", description: "AniDB adapter" },
];

const BUILT_IN_SUBTITLE_PLUGINS: PluginInfo[] = [
  {
    name: "opensubtitles",
    type: "subtitle",
    source: "built-in",
    description: "OpenSubtitles.com adapter",
  },
];

export class PluginRegistry {
  private plugins: Map<string, PluginInfo> = new Map();

  constructor() {
    this.registerBuiltIn();
  }

  private registerBuiltIn(): void {
    for (const plugin of BUILT_IN_DATABASE_PLUGINS) {
      this.plugins.set(plugin.name, plugin);
    }
    for (const plugin of BUILT_IN_SUBTITLE_PLUGINS) {
      this.plugins.set(plugin.name, plugin);
    }
  }

  private discoverExternal(): void {
    const nodeModulesPaths = this.getNodeModulesPaths();
    for (const nmPath of nodeModulesPaths) {
      if (!existsSync(nmPath)) continue;
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
    for (let i = 0; i < 10; i++) {
      const candidate = join(current, "node_modules");
      paths.push(candidate);
      const parent = join(current, "..");
      if (parent === current) break;
      current = parent;
    }
    return paths;
  }

  private inferPluginInfo(packageName: string): PluginInfo | null {
    const name = packageName.replace("kogoro-plugin-", "");
    const typeSegment = name.includes("subtitle") ? "subtitle" : "database";
    return {
      name,
      type: typeSegment as "database" | "subtitle",
      source: "external",
      description: `External plugin: ${packageName}`,
    };
  }

  list(): PluginInfo[] {
    this.discoverExternal();
    return Array.from(this.plugins.values());
  }

  getDatabasePlugins(): PluginInfo[] {
    return this.list().filter((p) => p.type === "database");
  }

  getSubtitlePlugins(): PluginInfo[] {
    return this.list().filter((p) => p.type === "subtitle");
  }
}
