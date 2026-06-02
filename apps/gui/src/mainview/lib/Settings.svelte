<script lang="ts">
  import { onMount } from 'svelte';
  import { Switch, Toast, createToaster } from '@skeletonlabs/skeleton-svelte';

  type SettingsField =
    | { type: "select"; key: string; label: string; options: Array<{ value: string; label: string }> }
    | { type: "text"; key: string; label: string; placeholder?: string }
    | { type: "number"; key: string; label: string; min?: number; max?: number }
    | { type: "radio"; key: string; label: string; options: Array<{ value: string; label: string }> }
    | { type: "tag-input"; key: string; label: string; placeholder?: string };

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
  }

  let { rpc }: Props = $props();

  const toaster = createToaster();

  const GENERAL_FIELDS: SettingsField[] = [
    { type: "select", key: "primaryDb", label: "Primary Database", options: [{ value: "tvdb", label: "TVDB" }, { value: "anidb", label: "AniDB" }] },
    { type: "text", key: "secondaryDbs", label: "Secondary Databases", placeholder: "Comma-separated" },
    { type: "select", key: "templatePreset", label: "Filename Template Preset", options: [{ value: "standard", label: "Standard (Recommended)" }, { value: "compact", label: "Compact" }, { value: "absolute", label: "Absolute" }, { value: "plex", label: "Plex" }, { value: "anidb", label: "AniDB" }] },
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
  ];

  let settingsData = $state<Record<string, unknown>>({});
  let editingApiKey = $state<string | null>(null);
  let newApiKey = $state("");

  const apiKeys = $derived((settingsData["apiKeys"] as Record<string, string>) ?? {});
  const plugins = $derived(
    (settingsData["plugins"] as Array<{ name: string; type: string; source: string; enabled: boolean }>) ?? [],
  );

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
      const result = (await rpc.request("updateApiKey", { plugin, apiKey: newApiKey })) as { success: boolean; error?: string };
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

  async function togglePlugin(plugin: string, enabled: boolean) {
    try {
      const result = (await rpc.request("togglePlugin", { plugin, enabled: !enabled })) as { success: boolean; error?: string };
      if (result.success) {
        showNotification(`${plugin} ${!enabled ? "enabled" : "disabled"}`);
        await loadSettings();
      } else {
        showNotification(`Error: ${result.error}`);
      }
    } catch {
      showNotification("Failed to toggle plugin");
    }
  }

  onMount(() => {
    loadSettings();
  });
</script>

<Toast.Group {toaster}>
  {#snippet children(toasts)}
    {#each toasts as toast}
      <Toast {toast}>
        <Toast.Message>
          <Toast.Title>{toast.title}</Toast.Title>
        </Toast.Message>
        <Toast.CloseTrigger />
      </Toast>
    {/each}
  {/snippet}
</Toast.Group>

<div class="max-w-2xl mx-auto p-6 space-y-8">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Settings</h2>
    <button class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={saveSettings}>
      Save Changes
    </button>
  </div>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">General</h3>
    <div class="grid grid-cols-1 gap-4">
      {#each GENERAL_FIELDS as field}
        <div>
          <label for={field.key} class="block text-sm font-medium text-surface-700-300 mb-1">{field.label}</label>
          {#if field.type === "select"}
            <select
              id={field.key}
              value={String(settingsData[field.key] ?? "")}
              onchange={(e) => updateField(field.key, (e.target as HTMLSelectElement).value)}
              class="select w-full text-sm rounded-lg border-surface-300-700"
            >
              {#each field.options as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          {:else if field.type === "text" || field.type === "tag-input"}
            <input
              type="text"
              id={field.key}
              value={String(settingsData[field.key] ?? "")}
              placeholder={field.placeholder ?? ""}
              oninput={(e) => updateField(field.key, (e.target as HTMLInputElement).value)}
              class="input w-full rounded-lg border-surface-300-700 text-sm py-2"
            />
          {:else if field.type === "number"}
            <input
              type="number"
              id={field.key}
              value={Number(settingsData[field.key] ?? 0)}
              min={field.min ?? 1}
              max={field.max ?? 16}
              oninput={(e) => updateField(field.key, Number((e.target as HTMLInputElement).value))}
              class="input w-full rounded-lg border-surface-300-700 text-sm py-2"
            />
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Advanced</h3>
    <div class="grid grid-cols-2 gap-4">
      {#each ADVANCED_FIELDS as field}
        <div>
          {#if field.type === "radio"}
            <label class="block text-sm font-medium text-surface-700-300 mb-1">{field.label}</label>
          {:else}
            <label for={field.key} class="block text-sm font-medium text-surface-700-300 mb-1">{field.label}</label>
          {/if}
          {#if field.type === "number"}
            <input
              type="number"
              id={field.key}
              value={Number(settingsData[field.key] ?? 0)}
              min={field.min ?? 1}
              max={field.max ?? 16}
              oninput={(e) => updateField(field.key, Number((e.target as HTMLInputElement).value))}
              class="input w-full rounded-lg border-surface-300-700 text-sm py-2"
            />
          {:else if field.type === "radio"}
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
                  <span class="text-sm">{option.label}</span>
                </label>
              {/each}
            </div>
          {:else if field.type === "select"}
            <select
              id={field.key}
              value={String(settingsData[field.key] ?? "")}
              onchange={(e) => updateField(field.key, (e.target as HTMLSelectElement).value)}
              class="select w-full text-sm rounded-lg border-surface-300-700"
            >
              {#each field.options as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          {:else}
            <input
              type="text"
              id={field.key}
              value={String(settingsData[field.key] ?? "")}
              placeholder={field.placeholder ?? ""}
              oninput={(e) => updateField(field.key, (e.target as HTMLInputElement).value)}
              class="input w-full rounded-lg border-surface-300-700 text-sm py-2"
            />
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">API Keys</h3>
    <div class="space-y-2">
      {#each Object.entries(apiKeys) as [name, masked]}
        {#if editingApiKey === name}
          <div class="flex items-center gap-2 p-3">
            <input
              type="password"
              placeholder="Enter new {name} API key"
              bind:value={newApiKey}
              class="input flex-1 rounded-lg border-surface-300-700 text-sm py-2"
            />
            <button class="btn btn-sm preset-filled-primary-500 rounded-lg" onclick={() => updateApiKey(name)}>
              Save
            </button>
            <button class="btn btn-sm preset-outlined-surface-300-700 rounded-lg" onclick={() => { editingApiKey = null; newApiKey = ""; }}>
              Cancel
            </button>
          </div>
        {:else}
          <div class="flex items-center justify-between p-3 rounded-lg bg-surface-200-800 border border-surface-300-700">
            <div class="flex items-center gap-3">
              <span class="font-medium text-sm text-surface-950-50">{name}</span>
              <span class="text-surface-600-400 text-sm font-mono">{masked}</span>
            </div>
            <button class="btn btn-sm preset-outlined-surface-300-700 rounded-lg" onclick={() => { editingApiKey = name; newApiKey = ""; }}>
              Update
            </button>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Plugins</h3>
    <div class="space-y-2">
      {#each plugins as plugin}
        <div class="flex items-center justify-between p-3 rounded-lg bg-surface-200-800 border border-surface-300-700">
          <div class="flex items-center gap-3">
            <span class="font-medium text-sm">{plugin.name}</span>
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
