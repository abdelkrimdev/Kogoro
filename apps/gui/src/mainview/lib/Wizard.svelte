<script lang="ts">
  import { Check } from '@lucide/svelte';
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

  const showBack = $derived(canGoBack(step));
  const showNext = $derived(canAdvance(step, apiKey));

  const PRESETS = [
    { value: "standard", label: "Standard (Recommended)" },
    { value: "compact", label: "Compact" },
    { value: "absolute", label: "Absolute" },
    { value: "plex", label: "Plex" },
    { value: "anidb", label: "AniDB" },
  ];

  function goBack() {
    const prev = getPreviousStep(step);
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

    const next = getNextStep(step);
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
      <p class="text-surface-600-400 text-sm">Configure your anime organizer</p>
    </div>

    {#if step === "database"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Select Primary Database</h2>
        <p class="text-surface-700-300 text-sm">Choose the database Kogoro will use for anime lookups.</p>
        <div class="space-y-2">
          <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
            <input type="radio" name="primaryDb" value="tvdb" bind:group={primaryDb} class="radio text-primary-500" />
            <span>TVDB (default)</span>
          </label>
          <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
            <input type="radio" name="primaryDb" value="anidb" bind:group={primaryDb} class="radio text-primary-500" />
            <span>AniDB</span>
          </label>
        </div>
      </div>
    {:else if step === "apikey"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Enter API Key</h2>
        <p class="text-surface-700-300 text-sm">Your API key will be stored securely in your OS keyring.</p>
        <input
          type="password"
          placeholder="Required"
          bind:value={apiKey}
          class="input w-full rounded-lg border-surface-300-700 text-sm py-2"
        />
        {#if error}
          <p class="text-error-500-400 text-sm">{error}</p>
        {/if}
      </div>
    {:else if step === "template"}
      <div class="space-y-6">
        <h2 class="text-xl font-bold">Select Filename Template</h2>
        <p class="text-surface-700-300 text-sm">Choose how your organized files will be named.</p>
        <div class="space-y-2">
          {#each PRESETS as preset}
            <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
              <input type="radio" name="templatePreset" value={preset.value} bind:group={templatePreset} class="radio text-primary-500" />
              <span>{preset.label}</span>
            </label>
          {/each}
        </div>
      </div>
    {:else if step === "completion"}
      <div class="space-y-6 text-center">
        <h2 class="text-xl font-bold">You're All Set!</h2>
        <p class="text-surface-700-300 text-sm">Kogoro is configured and ready to organize your anime collection.</p>
        <button class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={onComplete}>
          <Check class="size-4 inline-block mr-1" /> Enter Kogoro
        </button>
      </div>
    {/if}

    <div class="flex justify-between mt-8">
      {#if showBack}
        <button class="btn preset-outlined-surface-300-700 rounded-lg font-medium" onclick={goBack}>
          Back
        </button>
      {:else}
        <div></div>
      {/if}
      {#if showNext}
        <button class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={goNext}>
          {step === "template" ? "Finish" : "Next"}
        </button>
      {/if}
    </div>
  </div>
</div>
