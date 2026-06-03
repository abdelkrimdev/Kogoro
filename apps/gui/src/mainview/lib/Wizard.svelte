<script lang="ts">
  import { Check } from '@lucide/svelte';
  import { Steps } from '@skeletonlabs/skeleton-svelte';
  import { TEMPLATE_PRESETS } from "../shared";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onComplete: () => void;
  }

  let { rpc, onComplete }: Props = $props();

  const WIZARD_STEPS = [
    { id: "database", title: "Database" },
    { id: "apikey", title: "API Key" },
    { id: "template", title: "Template" },
  ];

  let step = $state(0);
  let primaryDb = $state("tvdb");
  let apiKey = $state("");
  let templatePreset = $state("standard");
  let templateCustom = $state("");
  let error = $state<string | null>(null);
  let saving = $state(false);

  const stepIsValid = $derived.by(() => {
    if (step === 1) return apiKey.length > 0;
    if (step === 2) return !saving;
    return true;
  });

  async function handleStepChange(details: { step: number }) {
    if (details.step === 3 && step === 2 && !saving) {
      saving = true;
      error = null;
      try {
        const result = (await rpc.request("writeOnboardingConfig", {
          primaryDb,
          apiKey,
          templatePreset,
          templateCustom,
        })) as { success: boolean; error?: string };
        if (!result.success) {
          error = result.error ?? "Failed to save configuration";
          saving = false;
          return;
        }
        step = 3;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        saving = false;
        return;
      }
      saving = false;
    } else if (details.step < step || stepIsValid) {
      error = null;
      step = details.step;
    }
  }
</script>

<div class="flex items-center justify-center h-full">
  <div class="w-full max-w-2xl p-8">
    <div class="card preset-outlined-surface-300-700 p-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-surface-950-50 mb-2">Kogoro Setup</h1>
        <p class="text-surface-600-400 text-sm">Configure your anime organizer</p>
      </div>

      <Steps
        count={WIZARD_STEPS.length}
        step={step}
        onStepChange={handleStepChange}
        isStepValid={() => stepIsValid}
        linear
        class="w-full"
      >
        <Steps.List>
          {#each WIZARD_STEPS as item, index}
            <Steps.Item {index}>
              <Steps.Trigger>
                <Steps.Indicator>{index + 1}</Steps.Indicator>
                {item.title}
              </Steps.Trigger>
              {#if index < WIZARD_STEPS.length - 1}
                <Steps.Separator />
              {/if}
            </Steps.Item>
          {/each}
        </Steps.List>

        <Steps.Content index={0}>
          <div class="space-y-6">
            <h2 class="text-xl font-bold text-surface-950-50">Select Primary Database</h2>
            <p class="text-surface-700-300 text-sm">Choose the database Kogoro will use for anime lookups.</p>
            <div class="space-y-2">
              <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
                <input type="radio" name="primaryDb" value="tvdb" bind:group={primaryDb} class="radio text-primary-500" />
                <span class="text-surface-950-50">TVDB (default)</span>
              </label>
              <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
                <input type="radio" name="primaryDb" value="anidb" bind:group={primaryDb} class="radio text-primary-500" />
                <span class="text-surface-950-50">AniDB</span>
              </label>
            </div>
          </div>
        </Steps.Content>

        <Steps.Content index={1}>
          <div class="space-y-6">
            <h2 class="text-xl font-bold text-surface-950-50">Enter API Key</h2>
            <p class="text-surface-700-300 text-sm">Your API key will be stored securely in your OS keyring.</p>
            <label class="label">
              <span class="label-text">API Key</span>
              <input
                type="password"
                placeholder="Required"
                bind:value={apiKey}
                class="input"
              />
            </label>
            {#if error}
              <p class="text-error-500-400 text-sm">{error}</p>
            {/if}
          </div>
        </Steps.Content>

        <Steps.Content index={2}>
          <div class="space-y-6">
            <h2 class="text-xl font-bold text-surface-950-50">Select Filename Template</h2>
            <p class="text-surface-700-300 text-sm">Choose how your organized files will be named.</p>
            <div class="space-y-2">
              {#each TEMPLATE_PRESETS as preset}
                <label class="flex items-center gap-3 p-4 rounded-container border border-surface-200-800 hover:border-primary-500 cursor-pointer transition-colors">
                  <input type="radio" name="templatePreset" value={preset.value} bind:group={templatePreset} class="radio text-primary-500" />
                  <span class="text-surface-950-50">{preset.label}</span>
                </label>
              {/each}
            </div>
            {#if error}
              <p class="text-error-500-400 text-sm">{error}</p>
            {/if}
          </div>
        </Steps.Content>

        <Steps.Content index={3}>
          <div class="space-y-6 text-center">
            <h2 class="text-xl font-bold text-surface-950-50">You're All Set!</h2>
            <p class="text-surface-700-300 text-sm">Kogoro is configured and ready to organize your anime collection.</p>
            <button type="button" class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={onComplete}>
              <Check class="size-4 inline-block mr-1" /> Enter Kogoro
            </button>
          </div>
        </Steps.Content>

        <div class="flex justify-between mt-8">
          <Steps.PrevTrigger class="btn preset-outlined-surface-300-700 rounded-lg font-medium">
            Back
          </Steps.PrevTrigger>
          <Steps.NextTrigger class="btn preset-filled-primary-500 rounded-lg font-medium">
            {saving ? "Saving..." : step === 2 ? "Finish" : "Next"}
          </Steps.NextTrigger>
        </div>
      </Steps>
    </div>
  </div>
</div>
