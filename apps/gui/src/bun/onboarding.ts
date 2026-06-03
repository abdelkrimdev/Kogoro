import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CredentialStore, SetResult } from "@kogoro/core";

export interface ConfigSetter {
  set(key: string, value: string): SetResult;
}

export function shouldShowOnboarding(configDir: string): boolean {
  const configPath = join(configDir, "config.toml");
  return !existsSync(configPath);
}

export async function writeOnboardingConfig(
  configManager: ConfigSetter,
  credentialStore: CredentialStore,
  params: {
    primaryDb: string;
    apiKey: string;
    templatePreset: string;
    templateCustom?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const { primaryDb, apiKey, templatePreset, templateCustom } = params;

  const result1 = configManager.set("primary-db", primaryDb);
  if (!result1.success) return { success: false, error: result1.error };

  const result2 = configManager.set("template.preset", templatePreset);
  if (!result2.success) return { success: false, error: result2.error };

  if (templateCustom) {
    const result3 = configManager.set("template.custom", templateCustom);
    if (!result3.success) return { success: false, error: result3.error };
  }

  if (apiKey) {
    try {
      await credentialStore.setCredential(primaryDb, apiKey);
    } catch (err) {
      return {
        success: false,
        error: `Failed to store API key: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { success: true };
}
