import type { ConfigManager, CredentialStore } from "@kogoro/core";
import type { PluginInfo } from "@kogoro/plugins";

const SETTINGS_FIELD_MAP: Record<string, string> = {
  primaryDb: "primary-db",
  templatePreset: "template.preset",
  templateCustom: "template.custom",
  directoryTemplate: "template.directory",
  mediaExtensions: "media-extensions",
  excludePatterns: "exclude-patterns",
  scanConcurrency: "scan-concurrency",
  fetchConcurrency: "fetch-concurrency",
  episodeNumbering: "episode-numbering",
  renameAction: "rename-action",
  subtitleLanguage: "subtitle-language",
  sanitizeAction: "sanitize.action",
  sanitizeReplacement: "sanitize.replacement",
  sanitizeChars: "sanitize.chars",
};

type SettingsFormData = {
  primaryDb: string;
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
  sanitizeAction: string;
  sanitizeReplacement: string;
  sanitizeChars: string;
  apiKeys: Record<string, string>;
  plugins: PluginInfo[];
};

function maskApiKey(key: string | undefined): string {
  if (!key) return "Not set";
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}

function buildPluginList(
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

export async function buildSettingsFormData(
  config: ConfigManager,
  credentialStore: CredentialStore,
): Promise<SettingsFormData> {
  const primaryDb = String(config.get("primary-db") ?? "tvdb");
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

  const sanitizeRaw = config.get("sanitize") as
    | { action?: string; replacement?: string; chars?: string }
    | undefined;
  const sanitizeAction = sanitizeRaw?.action ?? "strip";
  const sanitizeReplacement = sanitizeRaw?.replacement ?? "_";
  const sanitizeChars = sanitizeRaw?.chars ?? '\\/:*?"<>|';

  const pluginsRaw = config.get("plugins") as Record<string, { enabled?: boolean }> | undefined;
  const plugins = buildPluginList(pluginsRaw);

  const maskedKeys: Record<string, string> = {};
  for (const plugin of plugins) {
    try {
      const key = (await credentialStore.getCredential(plugin.name)) ?? undefined;
      maskedKeys[plugin.name] = maskApiKey(key);
    } catch {
      maskedKeys[plugin.name] = "Not set";
    }
  }

  return {
    primaryDb,
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
    sanitizeAction,
    sanitizeReplacement,
    sanitizeChars,
    apiKeys: maskedKeys,
    plugins,
  };
}

export function applySettingsUpdate(
  config: ConfigManager,
  params: Record<string, unknown>,
): { success: boolean; error?: string } {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const configKey = SETTINGS_FIELD_MAP[key];
    if (!configKey) continue;
    const stringValue = Array.isArray(value) ? value.join(",") : String(value);
    const result = config.set(configKey, stringValue);
    if (!result.success) return { success: false, error: result.error };
  }
  return { success: true };
}

export async function updateApiKey(
  credentialStore: CredentialStore,
  params: { plugin: string; apiKey: string },
): Promise<{ success: boolean; usedKeyring?: boolean; error?: string }> {
  const { plugin, apiKey } = params;
  if (!apiKey) {
    await credentialStore.deleteCredential(plugin);
    return { success: true };
  }
  const { usedKeyring } = await credentialStore.setCredential(plugin, apiKey);
  return { success: true, usedKeyring };
}

export function togglePlugin(
  config: ConfigManager,
  params: { plugin: string; enabled: boolean },
): { success: boolean; error?: string } {
  const result = config.set(`plugins.${params.plugin}.enabled`, String(params.enabled));
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}
