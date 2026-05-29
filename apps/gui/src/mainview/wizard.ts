// AppRPC type imported for reference only

type WizardStep = "database" | "apikey" | "template" | "completion";

interface WizardState {
  step: WizardStep;
  primaryDb: string;
  apiKey: string;
  templatePreset: string;
  templateCustom: string;
  error: string | null;
}

const steps: WizardStep[] = ["database", "apikey", "template", "completion"];

const PRESETS = [
  { value: "standard", label: "Standard (Recommended)" },
  { value: "compact", label: "Compact" },
  { value: "absolute", label: "Absolute" },
  { value: "plex", label: "Plex" },
  { value: "anidb", label: "AniDB" },
];

function stepIndex(step: WizardStep): number {
  return steps.indexOf(step);
}

function renderStep(state: WizardState): string {
  switch (state.step) {
    case "database":
      return `
        <div class="space-y-6">
          <h2 class="text-xl font-bold">Select Primary Database</h2>
          <p class="text-surface-400">Choose the database Kogoro will use for anime lookups.</p>
          <div class="space-y-2">
            <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
              <input type="radio" name="primaryDb" value="tvdb" ${state.primaryDb === "tvdb" ? "checked" : ""} class="w-4 h-4 text-primary-500">
              <span>TVDB (default)</span>
            </label>
            <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
              <input type="radio" name="primaryDb" value="anidb" ${state.primaryDb === "anidb" ? "checked" : ""} class="w-4 h-4 text-primary-500">
              <span>AniDB</span>
            </label>
          </div>
        </div>
      `;
    case "apikey":
      return `
        <div class="space-y-6">
          <h2 class="text-xl font-bold">Enter API Key</h2>
          <p class="text-surface-400">Your API key will be stored securely in your OS keyring.</p>
          <input
            type="password"
            id="apiKeyInput"
            placeholder="Required"
            class="w-full px-4 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none"
            value="${state.apiKey}"
          >
          ${state.error ? `<p class="text-red-500 text-sm">${state.error}</p>` : ""}
        </div>
      `;
    case "template":
      return `
        <div class="space-y-6">
          <h2 class="text-xl font-bold">Select Filename Template</h2>
          <p class="text-surface-400">Choose how your organized files will be named.</p>
          <div class="space-y-2">
            ${PRESETS.map(
              (p) => `
              <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
                <input type="radio" name="templatePreset" value="${p.value}" ${state.templatePreset === p.value ? "checked" : ""} class="w-4 h-4 text-primary-500">
                <span>${p.label}</span>
              </label>
            `,
            ).join("")}
          </div>
        </div>
      `;
    case "completion":
      return `
        <div class="space-y-6 text-center">
          <h2 class="text-xl font-bold">You're All Set!</h2>
          <p class="text-surface-400">Kogoro is configured and ready to organize your anime collection.</p>
          <button id="finishBtn" class="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors">
            Enter Kogoro
          </button>
        </div>
      `;
  }
}

export function renderWizard(
  container: HTMLElement,
  rpc: { request: (method: string, params: any) => Promise<any> },
  onComplete: () => void,
): void {
  const state: WizardState = {
    step: "database",
    primaryDb: "tvdb",
    apiKey: "",
    templatePreset: "standard",
    templateCustom: "",
    error: null,
  };

  function update(): void {
    container.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="w-full max-w-md p-8">
          <div class="mb-8">
            <h1 class="text-2xl font-bold mb-2">Kogoro Setup</h1>
            <p class="text-surface-500">Configure your anime organizer</p>
          </div>
          ${renderStep(state)}
          <div class="flex justify-between mt-8">
            ${
              state.step !== "database"
                ? `
              <button id="backBtn" class="px-4 py-2 rounded-lg border border-surface-700 hover:border-surface-500 transition-colors">
                Back
              </button>
            `
                : `<div></div>`
            }
            ${
              state.step !== "completion"
                ? `
              <button id="nextBtn" class="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors">
                ${state.step === "template" ? "Finish" : "Next"}
              </button>
            `
                : ""
            }
          </div>
        </div>
      </div>
    `;

    // Event listeners
    const backBtn = document.getElementById("backBtn");
    const nextBtn = document.getElementById("nextBtn");
    const finishBtn = document.getElementById("finishBtn");

    if (backBtn) {
      backBtn.addEventListener("click", () => {
        const idx = stepIndex(state.step);
        const prev = steps[idx - 1];
        if (idx > 0 && prev) {
          state.step = prev;
          state.error = null;
          update();
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", async () => {
        // Validate current step
        if (state.step === "database") {
          const selected = document.querySelector(
            'input[name="primaryDb"]:checked',
          ) as HTMLInputElement;
          if (selected) state.primaryDb = selected.value;
        } else if (state.step === "apikey") {
          const input = document.getElementById("apiKeyInput") as HTMLInputElement;
          state.apiKey = input.value.trim();
          if (!state.apiKey) {
            state.error = "API key is required";
            update();
            return;
          }
        } else if (state.step === "template") {
          const selected = document.querySelector(
            'input[name="templatePreset"]:checked',
          ) as HTMLInputElement;
          if (selected) state.templatePreset = selected.value;
          // Submit configuration
          try {
            const result = await rpc.request("writeOnboardingConfig", {
              primaryDb: state.primaryDb,
              apiKey: state.apiKey,
              templatePreset: state.templatePreset,
              templateCustom: state.templateCustom,
            });
            if (!result.success) {
              state.error = result.error ?? "Failed to save configuration";
              update();
              return;
            }
            // Clear API key from memory after successful storage
            state.apiKey = "";
            // Clear the input field as well
            const apiKeyInput = document.getElementById("apiKeyInput") as HTMLInputElement | null;
            if (apiKeyInput) apiKeyInput.value = "";
          } catch (err) {
            state.error = err instanceof Error ? err.message : String(err);
            update();
            return;
          }
        }
        // Move to next step
        const idx = stepIndex(state.step);
        const next = steps[idx + 1];
        if (idx < steps.length - 1 && next) {
          state.step = next;
          state.error = null;
          update();
        }
      });
    }

    if (finishBtn) {
      finishBtn.addEventListener("click", () => {
        onComplete();
      });
    }
  }

  update();
}
