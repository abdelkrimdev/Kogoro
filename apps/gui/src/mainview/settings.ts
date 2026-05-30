type SettingsField =
  | { type: "select"; key: string; label: string; options: Array<{ value: string; label: string }> }
  | { type: "text"; key: string; label: string; placeholder?: string }
  | { type: "number"; key: string; label: string; min?: number; max?: number }
  | { type: "radio"; key: string; label: string; options: Array<{ value: string; label: string }> }
  | { type: "tag-input"; key: string; label: string; placeholder?: string };

const GENERAL_FIELDS: SettingsField[] = [
  {
    type: "select",
    key: "primaryDb",
    label: "Primary Database",
    options: [
      { value: "tvdb", label: "TVDB" },
      { value: "anidb", label: "AniDB" },
    ],
  },
  {
    type: "text",
    key: "secondaryDbs",
    label: "Secondary Databases",
    placeholder: "Comma-separated",
  },
  {
    type: "select",
    key: "templatePreset",
    label: "Filename Template Preset",
    options: [
      { value: "standard", label: "Standard (Recommended)" },
      { value: "compact", label: "Compact" },
      { value: "absolute", label: "Absolute" },
      { value: "plex", label: "Plex" },
      { value: "anidb", label: "AniDB" },
    ],
  },
  {
    type: "text",
    key: "templateCustom",
    label: "Custom Template",
    placeholder: "{anime} - {season}x{episode:02} - {title}",
  },
  {
    type: "text",
    key: "directoryTemplate",
    label: "Directory Template",
    placeholder: "{anime}/{type}",
  },
  {
    type: "tag-input",
    key: "mediaExtensions",
    label: "Media Extensions",
    placeholder: ".mkv, .mp4, ...",
  },
  {
    type: "tag-input",
    key: "excludePatterns",
    label: "Exclude Patterns",
    placeholder: ".part, .crdownload, ...",
  },
];

const ADVANCED_FIELDS: SettingsField[] = [
  { type: "number", key: "scanConcurrency", label: "Scan Concurrency", min: 1, max: 16 },
  { type: "number", key: "fetchConcurrency", label: "Fetch Concurrency", min: 1, max: 16 },
  {
    type: "radio",
    key: "episodeNumbering",
    label: "Episode Numbering",
    options: [
      { value: "relative", label: "Relative (1x01)" },
      { value: "absolute", label: "Absolute (001)" },
    ],
  },
  {
    type: "select",
    key: "renameAction",
    label: "Rename Action",
    options: [
      { value: "move", label: "Move" },
      { value: "copy", label: "Copy" },
      { value: "symlink", label: "Symlink" },
      { value: "hardlink", label: "Hardlink" },
    ],
  },
  { type: "text", key: "subtitleLanguage", label: "Subtitle Language", placeholder: "en" },
];

function renderField(field: SettingsField, data: Record<string, unknown>): string {
  const value = data[field.key];

  switch (field.type) {
    case "select": {
      const selected = String(value ?? "");
      return `
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">${field.label}</label>
          <select data-field="${field.key}" class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
            ${field.options.map((o) => `<option value="${o.value}" ${selected === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
        </div>
      `;
    }
    case "text": {
      const val = String(value ?? "");
      return `
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">${field.label}</label>
          <input type="text" data-field="${field.key}" value="${val}" placeholder="${field.placeholder ?? ""}"
            class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
        </div>
      `;
    }
    case "number": {
      const numVal = Number(value ?? 0);
      return `
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">${field.label}</label>
          <input type="number" data-field="${field.key}" value="${numVal}" min="${field.min ?? 1}" max="${field.max ?? 16}"
            class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
        </div>
      `;
    }
    case "radio": {
      const selected = String(value ?? "");
      return `
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-2">${field.label}</label>
          <div class="flex gap-4">
            ${field.options
              .map(
                (o) => `
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="${field.key}" value="${o.value}" ${selected === o.value ? "checked" : ""} class="w-4 h-4 text-primary-500">
                <span class="text-sm">${o.label}</span>
              </label>
            `,
              )
              .join("")}
          </div>
        </div>
      `;
    }
    case "tag-input": {
      const arr = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
      const display = arr.map(String).join(", ");
      return `
        <div>
          <label class="block text-sm font-medium text-surface-300 mb-1">${field.label}</label>
          <input type="text" data-field="${field.key}" value="${display}" placeholder="${field.placeholder ?? ""}"
            class="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm">
        </div>
      `;
    }
  }
}

function renderApiKeyRow(name: string, maskedKey: string): string {
  return `
    <div class="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
      <div class="flex items-center gap-3">
        <span class="font-medium text-sm">${name}</span>
        <span class="text-surface-500 text-sm font-mono">${maskedKey}</span>
      </div>
      <button data-update-key="${name}" class="px-3 py-1 text-xs rounded-lg border border-surface-700 hover:border-primary-500 transition-colors">
        Update
      </button>
    </div>
  `;
}

function renderPluginRow(name: string, type: string, source: string, enabled: boolean): string {
  return `
    <div class="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
      <div class="flex items-center gap-3">
        <span class="font-medium text-sm">${name}</span>
        <span class="text-surface-500 text-xs px-2 py-0.5 rounded bg-surface-700">${type}</span>
        <span class="text-surface-500 text-xs">${source}</span>
      </div>
      <button data-toggle-plugin="${name}" class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-primary-500" : "bg-surface-600"}">
        <span class="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}"></span>
      </button>
    </div>
  `;
}

export function renderSettings(
  container: HTMLElement,
  rpc: { request: (method: string, params: unknown) => Promise<unknown> },
): void {
  let data: Record<string, unknown> = {};
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string): void {
    const toast = document.getElementById("settings-toast");
    if (toast) {
      toast.textContent = message;
      toast.classList.remove("opacity-0");
      toast.classList.add("opacity-100");
    }
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      const t = document.getElementById("settings-toast");
      if (t) {
        t.classList.remove("opacity-100");
        t.classList.add("opacity-0");
      }
    }, 2000);
  }

  async function loadSettings(): Promise<void> {
    try {
      data = (await rpc.request("getSettingsData", {})) as Record<string, unknown>;
      render();
    } catch {
      showToast("Failed to load settings");
    }
  }

  async function saveSettings(): Promise<void> {
    const params: Record<string, unknown> = {};

    for (const field of [...GENERAL_FIELDS, ...ADVANCED_FIELDS]) {
      if (field.type === "radio") {
        const checked = document.querySelector(
          `input[name="${field.key}"]:checked`,
        ) as HTMLInputElement;
        if (checked) params[field.key] = checked.value;
      } else {
        const input = document.querySelector(`[data-field="${field.key}"]`) as HTMLInputElement;
        if (input) {
          params[field.key] = field.type === "number" ? Number(input.value) : input.value;
        }
      }
    }

    try {
      const result = (await rpc.request("updateSettings", params)) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        showToast("Settings saved");
      } else {
        showToast(`Error: ${result.error}`);
      }
    } catch {
      showToast("Failed to save settings");
    }
  }

  function render(): void {
    const generalFields = GENERAL_FIELDS.map((f) => renderField(f, data)).join("");
    const advancedFields = ADVANCED_FIELDS.map((f) => renderField(f, data)).join("");

    const apiKeys = (data["apiKeys"] as Record<string, string>) ?? {};
    const apiKeyRows = Object.entries(apiKeys)
      .map(([name, masked]) => renderApiKeyRow(name, masked))
      .join("");

    const plugins =
      (data["plugins"] as Array<{
        name: string;
        type: string;
        source: string;
        enabled: boolean;
      }>) ?? [];
    const pluginRows = plugins
      .map((p) => renderPluginRow(p.name, p.type, p.source, p.enabled))
      .join("");

    container.innerHTML = `
      <div class="max-w-2xl mx-auto p-6 space-y-8">
        <div id="settings-toast" class="fixed top-16 right-6 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium opacity-0 transition-opacity duration-300 z-50"></div>

        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold">Settings</h2>
          <button id="saveSettingsBtn" class="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors text-sm font-medium">
            Save Changes
          </button>
        </div>

        <section class="space-y-4">
          <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">General</h3>
          <div class="grid grid-cols-1 gap-4">
            ${generalFields}
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">Advanced</h3>
          <div class="grid grid-cols-2 gap-4">
            ${advancedFields}
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">API Keys</h3>
          <div class="space-y-2">
            ${apiKeyRows}
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="text-sm font-semibold text-surface-400 uppercase tracking-wide">Plugins</h3>
          <div class="space-y-2">
            ${pluginRows}
          </div>
        </section>
      </div>
    `;

    const saveBtn = document.getElementById("saveSettingsBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", saveSettings);
    }

    container.querySelectorAll<HTMLElement>("[data-update-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const plugin = btn.getAttribute("data-update-key");
        if (plugin) promptApiKeyUpdate(container, rpc, plugin, loadSettings, showToast);
      });
    });

    container.querySelectorAll<HTMLElement>("[data-toggle-plugin]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const plugin = btn.getAttribute("data-toggle-plugin");
        if (!plugin) return;
        const current = plugins.find((p) => p.name === plugin);
        if (!current) return;
        const newEnabled = !current.enabled;
        try {
          const result = (await rpc.request("togglePlugin", { plugin, enabled: newEnabled })) as {
            success: boolean;
            error?: string;
          };
          if (result.success) {
            current.enabled = newEnabled;
            render();
            showToast(`${plugin} ${newEnabled ? "enabled" : "disabled"}`);
          } else {
            showToast(`Error: ${result.error}`);
          }
        } catch {
          showToast("Failed to toggle plugin");
        }
      });
    });
  }

  loadSettings();
}

function promptApiKeyUpdate(
  container: HTMLElement,
  rpc: { request: (method: string, params: unknown) => Promise<unknown> },
  plugin: string,
  reload: () => Promise<void>,
  showToast: (msg: string) => void,
): void {
  const existing = container
    .querySelector(`[data-update-key="${plugin}"]`)
    ?.closest("div.flex") as HTMLElement;
  if (!existing) return;

  const keyInput = document.createElement("input");
  keyInput.type = "password";
  keyInput.placeholder = `Enter new ${plugin} API key`;
  keyInput.className =
    "flex-1 px-3 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none text-sm";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.className =
    "px-3 py-1 text-xs rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className =
    "px-3 py-1 text-xs rounded-lg border border-surface-700 hover:border-surface-500 transition-colors";

  const inlineForm = document.createElement("div");
  inlineForm.className = "flex items-center gap-2 p-3";
  inlineForm.appendChild(keyInput);
  inlineForm.appendChild(saveBtn);
  inlineForm.appendChild(cancelBtn);

  existing.replaceWith(inlineForm);
  keyInput.focus();

  cancelBtn.addEventListener("click", () => reload());

  saveBtn.addEventListener("click", async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      showToast("API key cannot be empty");
      return;
    }
    try {
      const result = (await rpc.request("updateApiKey", { plugin, apiKey })) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        showToast(`${plugin} API key updated`);
        await reload();
      } else {
        showToast(`Error: ${result.error}`);
      }
    } catch {
      showToast("Failed to update API key");
    }
  });
}
