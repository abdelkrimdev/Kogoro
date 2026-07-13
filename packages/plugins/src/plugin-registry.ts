import { BUILT_IN_MANIFEST } from "./plugin-manifest";

export interface PluginInfo {
  name: string;
  type: "database" | "subtitle" | "tracker" | "enrichment";
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

export function isPluginEnabled(
  name: string,
  plugins?: Record<string, { enabled: boolean }>,
): boolean {
  const plugin = plugins?.[name];
  if (plugin === undefined) return true;
  return plugin.enabled;
}

export class PluginRegistry {
  list(plugins?: Record<string, { enabled: boolean }>): PluginInfo[] {
    return ALL_BUILT_IN.map((p) => ({
      ...p,
      enabled: isPluginEnabled(p.name, plugins),
    }));
  }

  byName(name: string): PluginInfo | undefined {
    return ALL_BUILT_IN.find((p) => p.name === name);
  }
}
