import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import type { ConfigManager } from "./config-manager.ts";
import type { CredentialStore } from "./credential-store.ts";

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

export interface TemplatePreset {
  label: string;
  value: string;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { label: "Standard (Recommended)", value: "standard" },
  { label: "Compact", value: "compact" },
  { label: "Absolute", value: "absolute" },
  { label: "Plex", value: "plex" },
  { label: "AniDB", value: "anidb" },
];

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

export interface WizardDeps {
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
        { value: "tvdb", label: "TVDB (default, no API key required)" },
        { value: "anidb", label: "AniDB (requires API key)" },
      ],
    }),
  );
  if (primaryDb === undefined) return;

  config.set("primary-db", primaryDb);

  const apiKeyPrompt =
    primaryDb === "anidb"
      ? {
          message: "Enter your AniDB API key",
          placeholder: "Optional, set later with 'kogoro config set'",
        }
      : { message: "Enter API key (optional)", placeholder: "Leave empty if none" };

  const apiKey = await prompt(p.text(apiKeyPrompt));
  if (apiKey === undefined) return;

  if (apiKey.length > 0) {
    await credentialStore.setCredential(primaryDb, apiKey);
  }

  const secondaryDbs = await prompt(
    p.text({
      message: "Enter secondary databases (comma-separated, optional)",
      placeholder: "e.g. anidb,tvdb",
    }),
  );
  if (secondaryDbs === undefined) return;

  config.set("secondary-dbs", secondaryDbs);

  const templateChoice = await prompt(
    p.select({
      message: "Pick a rename template preset",
      options: [
        ...TEMPLATE_PRESETS.map((t) => ({ value: t.value, label: t.label })),
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
    config.set("template.string", custom);
    config.set("template.preset", "");
  } else {
    config.set("template.preset", templateChoice);
    config.set("template.string", "");
  }

  const useDirStructure = await prompt(
    p.confirm({
      message: "Use default directory structure ({anime}/{EntryType}/)?",
      initialValue: true,
    }),
  );
  if (useDirStructure === undefined) return;

  config.init();

  p.outro("Kogoro is configured and ready!");
}
