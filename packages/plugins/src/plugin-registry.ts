import type { ConfigManager } from "@kogoro/core";

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

const ALL_BUILT_IN = [...BUILT_IN_DATABASE_PLUGINS, ...BUILT_IN_SUBTITLE_PLUGINS];

export class PluginRegistry {
  list(config: ConfigManager): PluginInfo[] {
    return ALL_BUILT_IN.map((p) => ({
      ...p,
      enabled: config.isPluginEnabled(p.name),
    }));
  }

  byName(name: string): PluginInfo | undefined {
    return ALL_BUILT_IN.find((p) => p.name === name);
  }
}
