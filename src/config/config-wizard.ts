import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import type { ConfigManager } from "./config-manager";
import type { CredentialStore } from "./credential-store";
import { TEMPLATE_PRESETS } from "./schema";

export interface PromptsAPI {
  intro(title: string): void;
  outro(message: string): void;
  select(opts: {
    message: string;
    options: { value: string; label: string }[];
  }): Promise<string | symbol>;
  text(opts: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
  }): Promise<string | symbol>;
  confirm(opts: { message: string; initialValue: boolean }): Promise<boolean | symbol>;
  isCancel(value: unknown): boolean;
}

interface TemplatePreset {
  label: string;
  value: string;
}

function presetLabel(key: string): string {
  if (key === "standard") return "Standard (Recommended)";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const PRESET_OPTIONS: TemplatePreset[] = Object.keys(TEMPLATE_PRESETS).map((key) => ({
  value: key,
  label: presetLabel(key),
}));

export function getDefaultPrompts(): PromptsAPI {
  return {
    intro,
    outro,
    select,
    text,
    confirm,
    isCancel,
  };
}

interface WizardDeps {
  config: ConfigManager;
  credentialStore: CredentialStore;
  prompts?: PromptsAPI;
}

export async function runConfigWizard(deps: WizardDeps): Promise<void> {
  const { config, credentialStore } = deps;
  const p = deps.prompts ?? getDefaultPrompts();

  p.intro("Kogoro Setup");

  async function prompt<T>(promise: Promise<T | symbol>): Promise<T | undefined> {
    const result = await promise;
    if (p.isCancel(result)) {
      cancel("Setup cancelled.");
      return undefined;
    }
    return result as T;
  }

  const primaryDb = await prompt(
    p.select({
      message: "Select your primary Database",
      options: [
        { value: "tvdb", label: "TVDB (default)" },
        { value: "anidb", label: "AniDB" },
      ],
    }),
  );
  if (primaryDb === undefined) return;

  config.set("primary-db", primaryDb);

  const apiKeyPrompt = {
    message: "Enter your API key",
    placeholder: "Optional, set later with 'kogoro config set'",
  };

  const apiKey = await prompt(p.text(apiKeyPrompt));
  if (apiKey === undefined) return;

  if (apiKey.length > 0) {
    try {
      await credentialStore.setCredential(primaryDb, apiKey);
    } catch (err) {
      const envVar = `KOGORO_${primaryDb.toUpperCase()}_KEY`;
      p.outro(
        `Warning: Failed to save API key to OS keyring: ${err instanceof Error ? err.message : String(err)}. ` +
          `Set the ${envVar} environment variable as a fallback.`,
      );
    }
  }

  const secondaryDbs = await prompt(
    p.text({
      message: "Enter secondary databases (comma-separated, optional)",
      placeholder: "e.g. anidb,trakt",
    }),
  );
  if (secondaryDbs === undefined) return;

  config.set("secondary-dbs", secondaryDbs);

  const templateChoice = await prompt(
    p.select({
      message: "Pick a rename template preset",
      options: [
        ...PRESET_OPTIONS.map((t) => ({ value: t.value, label: t.label })),
        { value: "__custom__", label: "Custom template" },
      ],
    }),
  );
  if (templateChoice === undefined) return;

  if (templateChoice === "__custom__") {
    const custom = await prompt(
      p.text({
        message: "Enter your custom template string",
        defaultValue: "{anime} - {season}x{episode:02} - {title}",
      }),
    );
    if (custom === undefined) return;
    config.set("template.custom", custom);
  } else {
    config.set("template.preset", templateChoice);
    config.set("template.custom", "");
  }

  config.init();

  p.outro("Kogoro is configured and ready!");
}
