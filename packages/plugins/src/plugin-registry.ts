import { BUILT_IN_MANIFEST } from "./plugin-manifest";

export interface PluginInfo {
  name: string;
  type: "database" | "subtitle" | "tracker";
  description?: string;
  enabled: boolean;
}

const BASE_PLUGINS: PluginInfo[] = BUILT_IN_MANIFEST.map((e) => ({
  name: e.name,
  type: e.type,
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

export function listPlugins(plugins?: Record<string, { enabled: boolean }>): PluginInfo[] {
  return BASE_PLUGINS.map((p) => ({
    ...p,
    enabled: isPluginEnabled(p.name, plugins),
  }));
}
