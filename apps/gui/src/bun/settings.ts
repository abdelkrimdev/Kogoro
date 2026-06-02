import type { ConfigManager } from "@kogoro/core";

export type PluginInfo = {
  name: string;
  type: "database" | "subtitle";
  source: "built-in";
  enabled: boolean;
};

export type SettingsFormData = {
  primaryDb: string;
  secondaryDbs: string[];
  templatePreset: string;
  templateCustom: string;
  directoryTemplate: string;
  mediaExtensions: string[];
  excludePatterns: string[];
  scanConcurrency: number;
  fetchConcurrency: number;
  episodeNumbering: string;
  renameAction: string;
  subtitleLanguage: string;
  apiKeys: Record<string, string>;
  plugins: PluginInfo[];
};

export function maskApiKey(key: string | undefined): string {
  if (!key) return "Not set";
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

export function buildPluginList(
  pluginsConfig: Record<string, { enabled?: boolean }> | undefined,
): PluginInfo[] {
  return [
    {
      name: "tvdb",
      type: "database",
      source: "built-in",
      enabled: pluginsConfig?.["tvdb"]?.enabled ?? true,
    },
    {
      name: "anidb",
      type: "database",
      source: "built-in",
      enabled: pluginsConfig?.["anidb"]?.enabled ?? true,
    },
    {
      name: "opensubtitles",
      type: "subtitle",
      source: "built-in",
      enabled: pluginsConfig?.["opensubtitles"]?.enabled ?? true,
    },
  ];
}

export function buildSettingsFormData(
  config: ConfigManager,
  apiKeys: Record<string, string | undefined>,
): SettingsFormData {
  const primaryDb = String(config.get("primary-db") ?? "tvdb");
  const secondaryDbs = config.getList("secondary-dbs");
  const templatePreset = String(config.get("template.preset") ?? "standard");
  const templateCustom = String(config.get("template.custom") ?? "");
  const directoryTemplate = String(config.get("template.directory") ?? "{anime}/{type}");
  const mediaExtensions = config.getList("media-extensions");
  const excludePatterns = config.getList("exclude-patterns");
  const scanConcurrency = Number(config.get("scan-concurrency") ?? 4);
  const fetchConcurrency = Number(config.get("fetch-concurrency") ?? 5);
  const episodeNumbering = String(config.get("episode-numbering") ?? "relative");
  const renameAction = String(config.get("rename-action") ?? "move");
  const subtitleLanguage = String(config.get("subtitle-language") ?? "en");

  const pluginsRaw = config.get("plugins") as Record<string, { enabled?: boolean }> | undefined;
  const plugins = buildPluginList(pluginsRaw);

  const maskedKeys: Record<string, string> = {};
  for (const plugin of plugins) {
    maskedKeys[plugin.name] = maskApiKey(apiKeys[plugin.name]);
  }

  return {
    primaryDb,
    secondaryDbs,
    templatePreset,
    templateCustom,
    directoryTemplate,
    mediaExtensions,
    excludePatterns,
    scanConcurrency,
    fetchConcurrency,
    episodeNumbering,
    renameAction,
    subtitleLanguage,
    apiKeys: maskedKeys,
    plugins,
  };
}
