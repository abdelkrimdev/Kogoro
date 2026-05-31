<script lang="ts">
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

  let data = $state<Record<string, unknown>>({});
  let showToast = $state(false);
  let toastMessage = $state("");
  let editingApiKey = $state<string | null>(null);
  let newApiKey = $state("");

  const apiKeys = $derived((data["apiKeys"] as Record<string, string>) ?? {});
  const plugins = $derived(
    (data["plugins"] as Array<{ name: string; type: string; source: string; enabled: boolean }>) ?? [],
  );

  async function loadSettings() {
    try {
      data = (await rpc.request("getSettingsData", {})) as Record<string, unknown>;
    } catch {
      showNotification("Failed to load settings");
    }
  }

  async function saveSettings() {
    const params: Record<string, unknown> = {};

    for (const field of [...GENERAL_FIELDS, ...ADVANCED_FIELDS]) {
      if (field.type === "radio") {
        const checked = document.querySelector(`input[name="${field.key}"]:checked`) as HTMLInputElement;
        if (checked) params[field.key] = checked.value;
      } else {
        const input = document.querySelector(`[data-field="${field.key}"]`) as HTMLInputElement;
        if (input) {
          params[field.key] = field.type === "number" ? Number(input.value) : input.value;
        }
      }
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
    toastMessage = message;
    showToast = true;
    setTimeout(() => {
      showToast = false;
    }, 2000);
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

  $effect(() => {
    loadSettings();
  });
</script>

<div class="max-w-2xl mx-auto p-6 space-y-8">
  {#if showToast}
    <div class="fixed top-16 right-6 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium z-50 transition-opacity duration-300">
      {toastMessage}
    </div>
  {/if}

  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Settings</h2>
    <button class="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors text-sm font-medium" onclick={saveSettings}>
      Save Changes
    </button>
  </div>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">General</h3>
    <div class="grid grid-cols-1 gap-4">
      {#each GENERAL_FIELDS as field}
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">{field.label}</label>
          {#if field.type === "select"}
            <select data-field={field.key} class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
              {#each field.options as option}
                <option value={option.value} selected={data[field.key] === option.value}>{option.label}</option>
              {/each}
            </select>
          {:else if field.type === "text" || field.type === "tag-input"}
            <input
              type="text"
              data-field={field.key}
              value={String(data[field.key] ?? "")}
              placeholder={field.placeholder ?? ""}
              class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm"
            />
          {:else if field.type === "number"}
            <input
              type="number"
              data-field={field.key}
              value={Number(data[field.key] ?? 0)}
              min={field.min ?? 1}
              max={field.max ?? 16}
              class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm"
            />
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">Advanced</h3>
    <div class="grid grid-cols-2 gap-4">
      {#each ADVANCED_FIELDS as field}
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">{field.label}</label>
          {#if field.type === "number"}
            <input
              type="number"
              data-field={field.key}
              value={Number(data[field.key] ?? 0)}
              min={field.min ?? 1}
              max={field.max ?? 16}
              class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm"
            />
          {:else if field.type === "radio"}
            <div class="flex gap-4">
              {#each field.options as option}
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={field.key} value={option.value} checked={data[field.key] === option.value} class="w-4 h-4 text-primary-500" />
                  <span class="text-sm">{option.label}</span>
                </label>
              {/each}
            </div>
          {:else if field.type === "select"}
            <select data-field={field.key} class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
              {#each field.options as option}
                <option value={option.value} selected={data[field.key] === option.value}>{option.label}</option>
              {/each}
            </select>
          {:else}
            <input
              type="text"
              data-field={field.key}
              value={String(data[field.key] ?? "")}
              placeholder={field.placeholder ?? ""}
              class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm"
            />
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">API Keys</h3>
    <div class="space-y-2">
      {#each Object.entries(apiKeys) as [name, masked]}
        {#if editingApiKey === name}
          <div class="flex items-center gap-2 p-3">
            <input
              type="password"
              placeholder="Enter new {name} API key"
              bind:value={newApiKey}
              class="flex-1 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm"
            />
            <button class="px-3 py-1 text-xs rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors" onclick={() => updateApiKey(name)}>
              Save
            </button>
            <button class="px-3 py-1 text-xs rounded-lg border border-surface-700 hover:border-surface-500 transition-colors" onclick={() => { editingApiKey = null; newApiKey = ""; }}>
              Cancel
            </button>
          </div>
        {:else}
          <div class="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
            <div class="flex items-center gap-3">
              <span class="font-medium text-sm">{name}</span>
              <span class="text-surface-500 text-sm font-mono">{masked}</span>
            </div>
            <button class="px-3 py-1 text-xs rounded-lg border border-surface-700 hover:border-primary-500 transition-colors" onclick={() => { editingApiKey = name; newApiKey = ""; }}>
              Update
            </button>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">Plugins</h3>
    <div class="space-y-2">
      {#each plugins as plugin}
        <div class="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
          <div class="flex items-center gap-3">
            <span class="font-medium text-sm">{plugin.name}</span>
            <span class="text-surface-500 text-xs px-2 py-0.5 rounded bg-surface-700">{plugin.type}</span>
            <span class="text-surface-500 text-xs">{plugin.source}</span>
          </div>
          <button
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors {plugin.enabled ? 'bg-primary-500' : 'bg-surface-600'}"
            onclick={() => togglePlugin(plugin.name, plugin.enabled)}
          >
            <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform {plugin.enabled ? 'translate-x-4' : 'translate-x-1'}"></span>
          </button>
        </div>
      {/each}
    </div>
  </section>
</div>
