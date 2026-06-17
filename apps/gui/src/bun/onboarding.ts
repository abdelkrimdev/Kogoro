import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  BunSecretsKeytar,
  CONFIG_DIR,
  type ConfigManager,
  type CredentialStore,
  checkKeyring,
} from "@kogoro/core";

export function checkKeyringStatus() {
  const keytar = new BunSecretsKeytar();
  return checkKeyring(keytar, process.platform);
}

export function checkOnboarding(): CheckOnboardingResult {
  return { needsOnboarding: shouldShowOnboarding(CONFIG_DIR) };
}

type CheckOnboardingResult = { needsOnboarding: boolean };

type CheckIncompleteResult = { incomplete: boolean; missingKey?: string };

type WriteConfigResult = { success: boolean; error?: string };

export function shouldShowOnboarding(configDir: string): boolean {
  const configPath = join(configDir, "config.toml");
  return !existsSync(configPath);
}

export async function checkIncompleteOnboarding(
  configManager: ConfigManager,
  credentialStore: CredentialStore,
): Promise<CheckIncompleteResult> {
  const primaryDb = configManager.primaryDb;
  try {
    const key = await credentialStore.getCredential(primaryDb);
    if (!key) {
      return { incomplete: true, missingKey: primaryDb };
    }
    return { incomplete: false };
  } catch {
    return { incomplete: true, missingKey: primaryDb };
  }
}

export async function writeOnboardingConfig(
  configManager: ConfigManager,
  credentialStore: CredentialStore,
  params: {
    primaryDb: string;
    apiKey: string;
    templatePreset: string;
    templateCustom?: string;
  },
): Promise<WriteConfigResult> {
  const { primaryDb, apiKey, templatePreset, templateCustom } = params;

  const result1 = configManager.set("primary-db", primaryDb);
  if (!result1.success) return { success: false, error: result1.error };

  const result2 = configManager.set("template.preset", templatePreset);
  if (!result2.success) return { success: false, error: result2.error };

  const customResult = configManager.set(
    "template.custom",
    templatePreset === "custom" ? (templateCustom ?? "") : "",
  );
  if (!customResult.success) return { success: false, error: customResult.error };

  if (apiKey) {
    await credentialStore.setCredential(primaryDb, apiKey);
  }

  return { success: true };
}
