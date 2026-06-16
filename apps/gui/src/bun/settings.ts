import type { ConfigManager, CredentialStore } from "@kogoro/core";
import type { PluginInfo } from "@kogoro/plugins";

export type SettingsFormData = {
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

export type SettingsUpdateResult = { success: boolean; error?: string };

export type ApiKeyUpdateResult = { success: boolean; usedKeyring?: boolean; error?: string };

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
  const plugins = buildPluginList(config.plugins);

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
    primaryDb: config.primaryDb,
    templatePreset: config.template.preset,
    templateCustom: config.template.custom,
    directoryTemplate: config.template.directory,
    mediaExtensions: config.mediaExtensions,
    excludePatterns: config.excludePatterns,
    scanConcurrency: config.scanConcurrency,
    fetchConcurrency: config.fetchConcurrency,
    episodeNumbering: config.episodeNumbering,
    renameAction: config.renameAction,
    subtitleLanguage: config.subtitleLanguage,
    sanitizeAction: config.sanitize.action,
    sanitizeReplacement: config.sanitize.replacement,
    sanitizeChars: config.sanitize.chars,
    apiKeys: maskedKeys,
    plugins,
  };
}

const NESTED_CONFIG_KEYS: Record<string, string> = {
  templatePreset: "template.preset",
  templateCustom: "template.custom",
  directoryTemplate: "template.directory",
  sanitizeAction: "sanitize.action",
  sanitizeReplacement: "sanitize.replacement",
  sanitizeChars: "sanitize.chars",
};

export function applySettingsUpdate(
  config: ConfigManager,
  params: Record<string, unknown>,
): SettingsUpdateResult {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const configKey = NESTED_CONFIG_KEYS[key] ?? key;
    const stringValue = Array.isArray(value) ? value.join(",") : String(value);
    const result = config.set(configKey, stringValue);
    if (!result.success) return { success: false, error: result.error };
  }
  return { success: true };
}

export async function updateApiKey(
  credentialStore: CredentialStore,
  params: { plugin: string; apiKey: string },
): Promise<ApiKeyUpdateResult> {
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
): SettingsUpdateResult {
  const result = config.set(`plugins.${params.plugin}.enabled`, String(params.enabled));
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}
