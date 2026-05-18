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
  { label: "Standard (Recommended)", value: "{anime} - {season}x{episode:02} - {title}" },
  { label: "Compact", value: "{anime} - E{episode:02}" },
  { label: "Absolute", value: "{anime} - {episode:03d}" },
];

export function getDefaultPrompts(): PromptsAPI {
  return {
    intro,
    outro,
    select,
    text,
    confirm: (opts: { message: string; initialValue: boolean }) => confirm(opts),
    isCancel,
  };
}

export interface WizardDeps {
  config: ConfigManager;
  creds: CredentialStore;
  prompts?: PromptsAPI;
}

export async function runConfigWizard(deps: WizardDeps): Promise<void> {
  const { config, creds } = deps;
  const p = deps.prompts ?? getDefaultPrompts();

  p.intro("Kogoro Setup");

  const primaryDb = await p.select({
    message: "Select your primary Database",
    options: [
      { value: "tvdb", label: "TVDB (default, no API key required)" },
      { value: "anidb", label: "AniDB (requires API key)" },
    ],
  });
  if (p.isCancel(primaryDb)) {
    cancel("Setup cancelled.");
    return;
  }

  await config.set("primary-db", primaryDb as string);

  let apiKey: string | symbol = "";

  if (primaryDb === "anidb") {
    apiKey = await p.text({
      message: "Enter your AniDB API key",
      placeholder: "Optional, set later with 'kogoro config set'",
    });
    if (p.isCancel(apiKey)) {
      cancel("Setup cancelled.");
      return;
    }
  } else {
    apiKey = await p.text({
      message: "Enter API key (optional)",
      placeholder: "Leave empty if none",
    });
    if (p.isCancel(apiKey)) {
      cancel("Setup cancelled.");
      return;
    }
  }

  if (apiKey && typeof apiKey === "string" && apiKey.length > 0) {
    await creds.setCredential(primaryDb as string, apiKey);
  }

  const templateChoice = await p.select({
    message: "Pick a rename template preset",
    options: [
      ...TEMPLATE_PRESETS.map((t) => ({ value: t.value, label: t.label })),
      { value: "__custom__", label: "Custom template" },
    ],
  });
  if (p.isCancel(templateChoice)) {
    cancel("Setup cancelled.");
    return;
  }

  if (templateChoice === "__custom__") {
    const custom = await p.text({
      message: "Enter your custom template string",
      defaultValue: TEMPLATE_PRESETS[0]?.value ?? "{anime} - {season}x{episode:02} - {title}",
    });
    if (p.isCancel(custom)) {
      cancel("Setup cancelled.");
      return;
    }
    await config.set("template.string", custom as string);
  } else {
    await config.set("template.string", templateChoice as string);
  }

  const useDirStructure = await p.confirm({
    message: "Use default directory structure ({anime}/{EntryType}/)?",
    initialValue: true,
  });
  if (p.isCancel(useDirStructure)) {
    cancel("Setup cancelled.");
    return;
  }

  await config.init();

  p.outro("Kogoro is configured and ready!");
}
