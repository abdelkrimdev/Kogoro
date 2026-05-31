<script lang="ts">
  import { canAdvance, canGoBack, getNextStep, getPreviousStep, type WizardStep } from "../state/wizard-state";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onComplete: () => void;
  }

  let { rpc, onComplete }: Props = $props();

  let step = $state<WizardStep>("database");
  let primaryDb = $state("tvdb");
  let apiKey = $state("");
  let templatePreset = $state("standard");
  let templateCustom = $state("");
  let error = $state<string | null>(null);

  const state = $derived({ step, primaryDb, apiKey, templatePreset, templateCustom, error });

  const PRESETS = [
    { value: "standard", label: "Standard (Recommended)" },
    { value: "compact", label: "Compact" },
    { value: "absolute", label: "Absolute" },
    { value: "plex", label: "Plex" },
    { value: "anidb", label: "AniDB" },
  ];

  function goBack() {
    const prev = getPreviousStep(state);
    if (prev) {
      step = prev;
      error = null;
    }
  }

  async function goNext() {
    if (step === "apikey" && !apiKey) {
      error = "API key is required";
      return;
    }

    if (step === "template") {
      try {
        const result = (await rpc.request("writeOnboardingConfig", {
          primaryDb,
          apiKey,
          templatePreset,
          templateCustom,
        })) as { success: boolean; error?: string };
        if (!result.success) {
          error = result.error ?? "Failed to save configuration";
          return;
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        return;
      }
    }

    const next = getNextStep(state);
    if (next) {
      step = next;
      error = null;
    }
  }
</script>

<div class="flex items-center justify-center h-full">
  <div class="w-full max-w-md p-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold mb-2">Kogoro Setup</h1>
      <p class="text-surface-500">Configure your anime organizer</p>
    </div>

    {#if step === "database"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Select Primary Database</h2>
        <p class="text-surface-400">Choose the database Kogoro will use for anime lookups.</p>
        <div class="space-y-2">
          <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
            <input type="radio" name="primaryDb" value="tvdb" bind:group={primaryDb} class="w-4 h-4 text-primary-500" />
            <span>TVDB (default)</span>
          </label>
          <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
            <input type="radio" name="primaryDb" value="anidb" bind:group={primaryDb} class="w-4 h-4 text-primary-500" />
            <span>AniDB</span>
          </label>
        </div>
      </div>
    {:else if step === "apikey"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Enter API Key</h2>
        <p class="text-surface-400">Your API key will be stored securely in your OS keyring.</p>
        <input
          type="password"
          placeholder="Required"
          bind:value={apiKey}
          class="w-full px-4 py-2 rounded-lg bg-surface-800 border border-surface-700 focus:border-primary-500 focus:outline-none"
        />
        {#if error}
          <p class="text-red-500 text-sm">{error}</p>
        {/if}
      </div>
    {:else if step === "template"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Select Filename Template</h2>
        <p class="text-surface-400">Choose how your organized files will be named.</p>
        <div class="space-y-2">
          {#each PRESETS as preset}
            <label class="flex items-center gap-3 p-4 rounded-lg border border-surface-700 hover:border-primary-500 cursor-pointer transition-colors">
              <input type="radio" name="templatePreset" value={preset.value} bind:group={templatePreset} class="w-4 h-4 text-primary-500" />
              <span>{preset.label}</span>
            </label>
          {/each}
        </div>
      </div>
    {:else if step === "completion"}
      <div class="space-y-6 text-center">
        <h2 class="text-xl font-bold">You're All Set!</h2>
        <p class="text-surface-400">Kogoro is configured and ready to organize your anime collection.</p>
        <button class="px-6 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors" onclick={onComplete}>
          Enter Kogoro
        </button>
      </div>
    {/if}

    <div class="flex justify-between mt-8">
      {#if canGoBack(state)}
        <button class="px-4 py-2 rounded-lg border border-surface-700 hover:border-surface-500 transition-colors" onclick={goBack}>
          Back
        </button>
      {:else}
        <div></div>
      {/if}
      {#if canAdvance(state)}
        <button class="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 transition-colors" onclick={goNext}>
          {step === "template" ? "Finish" : "Next"}
        </button>
      {/if}
    </div>
  </div>
</div>
