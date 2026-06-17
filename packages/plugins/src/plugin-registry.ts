import type { ConfigManager } from "@kogoro/core";
import { BUILT_IN_MANIFEST } from "./plugin-manifest";

export interface PluginInfo {
  name: string;
  type: "database" | "subtitle";
  source: "built-in" | "external";
  description?: string;
  enabled: boolean;
}

const ALL_BUILT_IN: PluginInfo[] = BUILT_IN_MANIFEST.map((e) => ({
  name: e.name,
  type: e.type,
  source: "built-in" as const,
  description: e.description,
  enabled: true,
}));

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
