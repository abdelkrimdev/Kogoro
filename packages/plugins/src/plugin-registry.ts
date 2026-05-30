import { readdirSync } from "node:fs";
import { join } from "node:path";

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
    description: "TheTVDB.com plugin",
    enabled: true,
  },
  {
    name: "anidb",
    type: "database",
    source: "built-in",
    description: "AniDB plugin",
    enabled: true,
  },
];

const BUILT_IN_SUBTITLE_PLUGINS: PluginInfo[] = [
  {
    name: "opensubtitles",
    type: "subtitle",
    source: "built-in",
    description: "OpenSubtitles.com plugin",
    enabled: true,
  },
];

export class PluginRegistry {
  private plugins: Map<string, PluginInfo> = new Map();
  private externalDiscovered = false;
  private disabledNames: Set<string> = new Set();

  constructor() {
    this.registerBuiltIn();
  }

  setDisabled(disabledNames: Set<string>): void {
    this.disabledNames = disabledNames;
    for (const [, info] of this.plugins) {
      info.enabled = !disabledNames.has(info.name);
    }
  }

  isEnabled(name: string): boolean {
    const info = this.plugins.get(name);
    return info?.enabled ?? true;
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
}
