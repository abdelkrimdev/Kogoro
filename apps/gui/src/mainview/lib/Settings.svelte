<script lang="ts">
  import { Switch, TagsInput, Toast, createToaster, Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { KeyringCheckResult } from "@kogoro/core";
  import SelectField from './SelectField.svelte';
  import KeyringNotice from './KeyringNotice.svelte';
  import { TEMPLATE_PRESETS } from "../shared";

  type SettingsField =
    | { type: "select"; key: string; label: string; options: Array<{ value: string; label: string }> }
    | { type: "text"; key: string; label: string; placeholder?: string }
    | { type: "number"; key: string; label: string; min?: number; max?: number }
    | { type: "radio"; key: string; label: string; options: Array<{ value: string; label: string }> }
    | { type: "tag-input"; key: string; label: string; placeholder?: string };

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    keyringResult: KeyringCheckResult | null;
    onRerunOnboarding?: () => void;
  }

  let { rpc, keyringResult, onRerunOnboarding }: Props = $props();

  const toaster = createToaster();

  const GENERAL_FIELDS: SettingsField[] = [
    { type: "select", key: "primaryDb", label: "Primary Database", options: [{ value: "tvdb", label: "TVDB" }, { value: "anidb", label: "AniDB" }] },
    { type: "select", key: "templatePreset", label: "Filename Template Preset", options: TEMPLATE_PRESETS },
    { type: "text", key: "templateCustom", label: "Custom Template", placeholder: "{anime} - {season}x{episode:02} - {title}" },
    { type: "text", key: "directoryTemplate", label: "Directory Template", placeholder: "{anime}/{type}" },
    { type: "tag-input", key: "mediaExtensions", label: "Media Extensions", placeholder: ".mkv, .mp4, ..." },
    { type: "tag-input", key: "excludePatterns", label: "Exclude Patterns", placeholder: ".part, .crdownload, ..." },
  ];

  const ADVANCED_FIELDS: SettingsField[] = [
    { type: "number", key: "scanConcurrency", label: "Scan Concurrency", min: 1, max: 16 },
    { type: "number", key: "fetchConcurrency", label: "Fetch Concurrency", min: 1, max: 16 },
    { type: "radio", key: "episodeNumbering", label: "Episode Numbering", options: [{ value: "relative", label: "Relative (1x01)" }, { value: "absolute", label: "Absolute (001)" }] },
    { type: "select", key: "renameAction", label: "Rename Action", options: [{ value: "move", label: "Move" }, { value: "copy", label: "Copy" }, { value: "symlink", label: "Symlink" }, { value: "hardlink", label: "Hardlink" }] },
    { type: "text", key: "subtitleLanguage", label: "Subtitle Language", placeholder: "en" },
    { type: "select", key: "sanitizeAction", label: "Filename Sanitization", options: [{ value: "replace", label: "Replace illegal chars" }, { value: "strip", label: "Strip illegal chars" }] },
    { type: "text", key: "sanitizeReplacement", label: "Replacement Character", placeholder: "_" },
    { type: "text", key: "sanitizeChars", label: "Illegal Characters", placeholder: '\\/:*?"<>|' },
  ];

  let settingsData = $state<Record<string, unknown>>({});
  let editingApiKey = $state<string | null>(null);
  let newApiKey = $state("");
  let rebuilding = $state(false);
  let showRebuildConfirm = $state(false);

  const apiKeys = $derived((settingsData["apiKeys"] as Record<string, string>) ?? {});
  const plugins = $derived(
    (settingsData["plugins"] as Array<{ name: string; type: string; source: string; enabled: boolean }>) ?? [],
  );
  const primaryDbKey = $derived((settingsData["primaryDb"] as string) ?? "tvdb");

  function updateField(key: string, value: unknown) {
    settingsData[key] = value;
  }

  async function loadSettings() {
    try {
      settingsData = (await rpc.request("getSettingsData", {})) as Record<string, unknown>;
    } catch {
      showNotification("Failed to load settings");
    }
  }

  async function saveSettings() {
    const params: Record<string, unknown> = {};
    for (const field of [...GENERAL_FIELDS, ...ADVANCED_FIELDS]) {
      params[field.key] = settingsData[field.key];
    }

    try {
      const result = (await rpc.request("updateSettings", params)) as { success: boolean; error?: string };
      if (result.success) {
        showNotification("Settings saved");
      } else {
        showNotification(`Error: ${result.error}`);
      }
    } catch {
      showNotification("Failed to save settings");
    }
  }

  function showNotification(message: string) {
    toaster.create({
      type: 'info',
      title: message,
      duration: 2000,
    });
  }

  async function updateApiKey(plugin: string) {
    if (!newApiKey) {
      showNotification("API key cannot be empty");
      return;
    }
    try {
      const result = (await rpc.request("updateApiKey", { plugin, apiKey: newApiKey })) as { success: boolean; usedKeyring?: boolean; error?: string };
      if (result.success) {
        showNotification(`${plugin} API key updated`);
        editingApiKey = null;
        newApiKey = "";
        await loadSettings();
      } else {
        showNotification(`Error: ${result.error}`);
      }
    } catch {
      showNotification("Failed to update API key");
    }
  }

  async function togglePlugin(pluginName: string, currentEnabled: boolean) {
    const newEnabled = !currentEnabled;
    try {
      const result = (await rpc.request("togglePlugin", { plugin: pluginName, enabled: newEnabled })) as { success: boolean; error?: string };
      if (result.success) {
        showNotification(`${pluginName} ${newEnabled ? "enabled" : "disabled"}`);
        for (const p of plugins) {
          if (p.name === pluginName) {
            p.enabled = newEnabled;
          }
        }
      } else {
        showNotification(`Error: ${result.error}`);
        await loadSettings();
      }
    } catch {
      showNotification("Failed to toggle plugin");
      await loadSettings();
    }
  }

  async function handleRebuildConfirm() {
    showRebuildConfirm = false;
    await rebuildLibrary();
  }

  async function rebuildLibrary() {
    rebuilding = true;
    try {
      const result = (await rpc.request("rebuildLibrary", {})) as { success: boolean; error?: string };
      if (result.success) {
        showNotification("Library rebuilt successfully");
      } else {
        showNotification(`Error: ${result.error ?? "Unknown error"}`);
      }
    } catch {
      showNotification("Failed to rebuild library");
    } finally {
      rebuilding = false;
    }
  }

  $effect(() => {
    loadSettings();
  });
</script>

<Toast.Group {toaster}>
  {#snippet children(toast)}
    <Toast {toast}>
      <Toast.Message>
        <Toast.Title>{toast.title}</Toast.Title>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>

<div class="max-w-2xl mx-auto p-6 space-y-8 relative">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold text-surface-950-50">Settings</h2>
    <button type="button" class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={saveSettings}>
      Save Changes
    </button>
  </div>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">General</h3>
    <div class="card preset-outlined-surface-300-700 p-4 space-y-4">
      <div class="grid grid-cols-1 gap-4">
        {#each GENERAL_FIELDS as field}
          {#if field.key === "templateCustom" && settingsData["templatePreset"] !== "custom"}
            <!-- skip custom template when preset is not custom -->
          {:else if field.type === "select"}
            <SelectField
              value={String(settingsData[field.key] ?? "")}
              options={field.options}
              label={field.label}
              onValueChange={(v) => updateField(field.key, v)}
            />
          {:else if field.type === "text"}
            <label class="label">
              <span class="label-text">{field.label}</span>
              <input
                type="text"
                value={String(settingsData[field.key] ?? "")}
                placeholder={field.placeholder ?? ""}
                oninput={(e) => updateField(field.key, (e.target as HTMLInputElement).value)}
                class="input"
              />
            </label>
          {:else if field.type === "tag-input"}
            <label class="label">
              <span class="label-text">{field.label}</span>
              <TagsInput
                value={(settingsData[field.key] as string[]) ?? []}
                onValueChange={(details) => updateField(field.key, details.value)}
              >
                <TagsInput.Control>
                  <TagsInput.Context>
                    {#snippet children(tagsInput)}
                      {#each tagsInput().value as value, index (index)}
                        <TagsInput.Item {value} {index}>
                          <TagsInput.ItemPreview>
                            <TagsInput.ItemText>{value}</TagsInput.ItemText>
                            <TagsInput.ItemDeleteTrigger />
                          </TagsInput.ItemPreview>
                          <TagsInput.ItemInput />
                        </TagsInput.Item>
                      {/each}
                    {/snippet}
                  </TagsInput.Context>
                  <TagsInput.Input placeholder={field.placeholder ?? ""} />
                </TagsInput.Control>
                <TagsInput.HiddenInput />
              </TagsInput>
            </label>
          {:else if field.type === "number"}
            <label class="label">
              <span class="label-text">{field.label}</span>
              <input
                type="number"
                value={Number(settingsData[field.key] ?? 0)}
                min={field.min ?? 1}
                max={field.max ?? 16}
                oninput={(e) => updateField(field.key, Number((e.target as HTMLInputElement).value))}
                class="input"
              />
            </label>
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Advanced</h3>
    <div class="card preset-outlined-surface-300-700 p-4 space-y-4">
      <div class="grid grid-cols-2 gap-4">
        {#each ADVANCED_FIELDS as field}
          {#if field.type === "radio"}
            <fieldset class="label">
              <legend class="label-text">{field.label}</legend>
              <div class="flex gap-4">
                {#each field.options as option}
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={field.key}
                      value={option.value}
                      checked={settingsData[field.key] === option.value}
                      onchange={() => updateField(field.key, option.value)}
                      class="radio text-primary-500"
                    />
                    <span class="text-sm text-surface-950-50">{option.label}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          {:else if field.type === "select"}
            <SelectField
              value={String(settingsData[field.key] ?? "")}
              options={field.options}
              label={field.label}
              onValueChange={(v) => updateField(field.key, v)}
            />
          {:else if field.type === "text"}
            <label class="label">
              <span class="label-text">{field.label}</span>
              <input
                type="text"
                value={String(settingsData[field.key] ?? "")}
                placeholder={field.placeholder ?? ""}
                oninput={(e) => updateField(field.key, (e.target as HTMLInputElement).value)}
                class="input"
              />
            </label>
          {:else if field.type === "number"}
            <label class="label">
              <span class="label-text">{field.label}</span>
              <input
                type="number"
                value={Number(settingsData[field.key] ?? 0)}
                min={field.min ?? 1}
                max={field.max ?? 16}
                oninput={(e) => updateField(field.key, Number((e.target as HTMLInputElement).value))}
                class="input"
              />
            </label>
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">API Keys</h3>
    {#if keyringResult && !keyringResult.available && apiKeys[primaryDbKey] === "Not set"}
      <KeyringNotice
        platform={keyringResult.platform}
        envVar="KOGORO_{primaryDbKey.toUpperCase()}_KEY"
      />
    {/if}
    <div class="space-y-2">
      {#each Object.entries(apiKeys) as [name, masked]}
        {#if editingApiKey === name}
          <div class="card preset-outlined-surface-300-700 flex items-center gap-2 p-3">
            <input
              type="password"
              placeholder="Enter new {name} API key"
              bind:value={newApiKey}
              class="input flex-1 text-sm"
            />
            <button type="button" class="btn btn-sm preset-filled-primary-500 rounded-lg" onclick={() => updateApiKey(name)}>
              Save
            </button>
            <button type="button" class="btn btn-sm preset-outlined-surface-300-700 rounded-lg" onclick={() => { editingApiKey = null; newApiKey = ""; }}>
              Cancel
            </button>
          </div>
        {:else}
          <div class="card preset-outlined-surface-300-700 flex items-center justify-between p-3">
            <div class="flex items-center gap-3">
              <span class="font-medium text-sm text-surface-950-50">{name}</span>
              <span class="text-surface-600-400 text-sm font-mono">{masked}</span>
            </div>
            <button type="button" class="btn btn-sm preset-outlined-surface-300-700 rounded-lg" onclick={() => { editingApiKey = name; newApiKey = ""; }}>
              Update
            </button>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Maintenance</h3>
    <div class="card preset-outlined-surface-300-700 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-surface-950-50">Rebuild Library</p>
          <p class="text-xs text-surface-600-400 mt-1">
            Re-scan your media directory and rebuild the library database from scratch.
          </p>
        </div>
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium"
          onclick={() => showRebuildConfirm = true}
          disabled={rebuilding}
        >
          {rebuilding ? "Rebuilding..." : "Rebuild Library"}
        </button>
      </div>
      <div class="border-t border-surface-300-700 pt-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-surface-950-50">Setup Wizard</p>
          <p class="text-xs text-surface-600-400 mt-1">
            Walk through the setup wizard again to change your database or template settings.
          </p>
        </div>
        <button
          type="button"
          class="btn preset-outlined-surface-300-700 rounded-lg font-medium"
          onclick={() => onRerunOnboarding?.()}
        >
          Setup Wizard
        </button>
      </div>
    </div>
  </section>

  <Dialog open={showRebuildConfirm} onOpenChange={(details) => { showRebuildConfirm = details.open; }}>
    <Portal>
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content class="card preset-outlined-surface-300-700 w-full max-w-sm p-0 shadow-xl">
          <div class="p-4">
            <Dialog.Title class="text-lg font-semibold text-surface-950-50 mb-2">Rebuild Library</Dialog.Title>
            <Dialog.Description class="text-sm text-surface-600-400">
              This will delete and recreate the library database from existing data.
              Your anime entries and episode files will be preserved.
            </Dialog.Description>
          </div>
          <div class="p-4 border-t border-surface-300-700 flex justify-end gap-3">
            <Dialog.CloseTrigger class="btn preset-tonal-surface rounded-lg font-medium">
              Cancel
            </Dialog.CloseTrigger>
            <button
              type="button"
              class="btn preset-filled-primary-500 rounded-lg font-medium"
              onclick={handleRebuildConfirm}
            >
              Rebuild
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Plugins</h3>
    <div class="space-y-2">
      {#each plugins as plugin}
        <div class="card preset-outlined-surface-300-700 flex items-center justify-between p-3">
          <div class="flex items-center gap-3">
            <span class="font-medium text-sm text-surface-950-50">{plugin.name}</span>
            <span class="badge preset-tonal-surface text-xs">{plugin.type}</span>
            <span class="text-surface-600-400 text-xs">{plugin.source}</span>
          </div>
          <Switch
            checked={plugin.enabled}
            onCheckedChange={() => togglePlugin(plugin.name, plugin.enabled)}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.HiddenInput />
          </Switch>
        </div>
      {/each}
    </div>
  </section>
</div>
