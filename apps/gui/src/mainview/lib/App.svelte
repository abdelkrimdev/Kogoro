<script lang="ts">
  import type { ReviewPlan, KeyringCheckResult } from "@kogoro/core";
  import { Sun, Moon, PanelLeftClose, PanelLeftOpen, LoaderCircle, TriangleAlert } from '@lucide/svelte';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { createRPCThemeState, applyThemeToDocument } from "../state/theme-state";
  import {
    createInitialSnapshot,
    reduceMessage,
    reduceOnViewResults,
    reduceOnDismissSummary,
    reduceClearAfterReview,
    reduceClearAfterComplete,
    reduceOnBatchScanStarted,
    reduceOnBatchFolderStarted,
    reduceOnBatchFolderComplete,
    reduceOnBatchScanComplete,
    type ScanSessionSnapshot,
  } from "../state/scan-session-reducer";
  import { createSidebarState, NAV_ITEMS, type View } from "../state/nav";
  import Wizard from "./Wizard.svelte";
  import Library from "./Library.svelte";
  import Review from "./Review.svelte";
  import Detail from "./Detail.svelte";
  import Settings from "./Settings.svelte";
  import Scan from "./Scan.svelte";
  import Footer from "./Footer.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => () => void;
  }

  let { rpc, onMessage }: Props = $props();

  let snap: ScanSessionSnapshot = $state(createInitialSnapshot());

  async function cancelExecution() {
    if (!snap.sessionId) return;
    try {
      await rpc.request("cancelScan", { sessionId: snap.sessionId });
    } catch (err) {
      console.error("Failed to cancel execution:", err);
    }
  }

  let themeState: ReturnType<typeof createRPCThemeState> | null = null;
  let themeMode = $state<"light" | "dark">("light");

  $effect(() => {
    themeState = createRPCThemeState(rpc);
    themeMode = themeState.mode;
    themeState.load();
  });

  let sidebarState = createSidebarState(() => rpc);
  let sidebarCollapsed = $state(false);
  const showSidebar = $derived(NAV_ITEMS.some((item) => item.view === currentView));

  function toggleSidebar() {
    sidebarState.toggle();
    sidebarCollapsed = sidebarState.collapsed;
  }

  $effect(() => {
    if (!themeState) return;
    const cleanup = applyThemeToDocument(themeState);
    return cleanup;
  });

  $effect(() => {
    if (!themeState) return;
    return themeState.onChange((mode) => {
      themeMode = mode;
    });
  });

  let currentView = $state<View>("scan");
  let currentDetailId = $state<string | null>(null);
  let isLoading = $state(true);
  let incompleteConfig = $state<{ incomplete: boolean; missingKey?: string } | null>(null);
  let keyringResult = $state<KeyringCheckResult | null>(null);

  function navigate(view: View) {
    currentView = view;
    if (view === "scan") refreshIncompleteConfig();
  }

  async function refreshIncompleteConfig() {
    try {
      const incomplete = (await rpc.request("checkIncompleteOnboarding", {})) as { incomplete: boolean; missingKey?: string };
      incompleteConfig = incomplete.incomplete ? incomplete : null;
    } catch {}
  }

  function openAnime(id: string) {
    currentDetailId = id;
    currentView = "details";
  }

  function backToLibrary() {
    currentDetailId = null;
    currentView = "library";
  }

  function onWizardComplete() {
    navigate("scan");
  }

  function onRerunOnboarding() {
    currentView = "onboarding";
  }

  function onViewResults() {
    currentView = "review";
    snap = reduceOnViewResults(snap);
  }

  function onDismissSummary() {
    snap = reduceOnDismissSummary(snap);
  }

  function onReviewComplete() {
    currentView = "scan";
    snap = reduceClearAfterReview(snap);
  }

  function onBatchScanStarted(folderCount: number) {
    snap = reduceOnBatchScanStarted(snap, folderCount);
  }

  function onBatchFolderStarted(folderPath: string, folderBasename: string) {
    snap = reduceOnBatchFolderStarted(snap, folderPath, folderBasename);
  }

  function onBatchFolderComplete(folderPath: string, plan: ReviewPlan) {
    snap = reduceOnBatchFolderComplete(snap, folderPath, plan);
  }

  function onBatchScanComplete(folders: { path: string; basename: string }[]) {
    snap = reduceOnBatchScanComplete(snap, folders);
  }

  const MIN_SPINNER_MS = 500;

  onMount(async () => {
    const startTime = Date.now();

    const [onboardingResult] = await Promise.all([
      rpc.request("checkOnboarding", {}) as Promise<{ needsOnboarding: boolean }>,
      sidebarState.load(),
    ]);
    sidebarCollapsed = sidebarState.collapsed;

    const keyringPromise = rpc.request("checkKeyring", {}) as Promise<KeyringCheckResult>;

    let view: View;
    if (onboardingResult.needsOnboarding) {
      view = "onboarding";
      keyringResult = await keyringPromise;
    } else {
      const [stats, kr] = await Promise.all([
        rpc.request("getLibraryStats", {}) as Promise<{ animeCount: number; episodeCount: number }>,
        keyringPromise,
      ]);
      keyringResult = kr;
      await refreshIncompleteConfig();
      view = stats.animeCount > 0 ? "library" : "scan";
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_SPINNER_MS) {
      await new Promise((r) => setTimeout(r, MIN_SPINNER_MS - elapsed));
    }

    isLoading = false;
    currentView = view;
  });

  $effect(() => {
    const unsub = onMessage((message, data) => {
      if (message === "scanComplete") {
        snap = reduceMessage(snap, message, data);
        currentView = "scan";
        snap = reduceClearAfterComplete(snap);
        return;
      }
      if (message === "scanError") {
        snap = reduceMessage(snap, message, data);
        snap = reduceClearAfterComplete(snap);
        return;
      }
      snap = reduceMessage(snap, message, data);
    });
    return unsub;
  });
</script>

{#if isLoading}
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-3">
      <LoaderCircle class="size-8 animate-spin text-primary-500-400 mx-auto" />
      <p class="text-surface-600-400 text-sm">Loading...</p>
    </div>
  </div>
{:else if currentView === "onboarding"}
  <Wizard {rpc} {keyringResult} onComplete={onWizardComplete} />
{:else}
  <div class="h-full flex flex-col">
    <header class="h-12 flex items-center border-b border-surface-300-700 shrink-0" style="-webkit-app-region: drag;">
      <div class="flex items-center gap-2 px-3" style="-webkit-app-region: no-drag;">
        {#if showSidebar}
          <button
            type="button"
            class="btn-icon preset-tonal-surface"
            onclick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {#if sidebarCollapsed}
              <PanelLeftOpen class="size-5" />
            {:else}
              <PanelLeftClose class="size-5" />
            {/if}
          </button>
        {/if}
      </div>
      <span class="text-sm font-medium text-surface-700-300">Kogoro</span>
      <div class="flex-1"></div>
      <div class="flex items-center gap-2 px-3" style="-webkit-app-region: no-drag;">
        <button
          type="button"
          class="btn-icon preset-tonal-surface"
          onclick={() => themeState?.toggle()}
          aria-label="Toggle theme"
        >
          {#if themeMode === "dark"}
            <Sun class="size-5" />
          {:else}
            <Moon class="size-5" />
          {/if}
        </button>
      </div>
    </header>
    <div class="flex-1 flex overflow-hidden">
      {#if showSidebar}
        <Navigation layout="sidebar" class="{sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-surface-200-800 transition-[width] duration-200 ease-in-out">
          <Navigation.Content>
            <Navigation.Menu>
              {#each NAV_ITEMS as item}
                <Navigation.Trigger
                  class={currentView === item.view ? 'preset-tonal-primary' : ''}
                  onclick={() => navigate(item.view)}
                >
                  <span class="relative">
                    <item.icon class={sidebarCollapsed ? 'size-5' : 'size-4'} />
                    {#if item.view === "scan" && snap.isScanning}
                      <span class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary-500 animate-pulse"></span>
                    {/if}
                  </span>
                  {#if !sidebarCollapsed}
                    <Navigation.TriggerText>{item.label}</Navigation.TriggerText>
                  {/if}
                </Navigation.Trigger>
              {/each}
            </Navigation.Menu>
          </Navigation.Content>
        </Navigation>
      {/if}
      <main class="flex-1 overflow-hidden flex flex-col">
        {#if currentView === "review" && snap.plan && snap.sessionId}
          <div class="flex-1 min-h-0 overflow-auto">
            <Review {rpc} sessionId={snap.sessionId} plan={snap.plan} onComplete={onReviewComplete} />
          </div>
        {:else if currentView === "library"}
          <div class="flex-1 min-h-0 overflow-auto">
            <Library {rpc} onOpenAnime={openAnime} onStartScan={() => navigate("scan")} />
          </div>
        {:else if currentView === "settings"}
          <div class="flex-1 min-h-0 overflow-auto">
            <Settings {rpc} {keyringResult} {onRerunOnboarding} />
          </div>
        {:else if currentView === "details" && currentDetailId}
          <div class="flex-1 min-h-0 overflow-auto">
            <Detail {rpc} animeId={currentDetailId} onBack={backToLibrary} />
          </div>
        {:else}
          {#if incompleteConfig}
            <div class="mx-4 mt-4 card preset-tonal-warning p-3 flex items-start gap-3 text-sm shrink-0">
              <TriangleAlert class="size-4 mt-0.5 shrink-0 text-warning-500-400" />
              <div class="flex-1 min-w-0">
                <p class="text-surface-950-50">
                  API key missing — scanning needs an API key for <strong>{incompleteConfig.missingKey}</strong>.
                  Add one in Settings, or set the <code class="text-xs bg-surface-200-800 px-1 py-0.5 rounded">KOGORO_{incompleteConfig.missingKey?.toUpperCase()}_KEY</code> environment variable.
                </p>
              </div>
              <button type="button" class="btn preset-outlined-warning-500 shrink-0" onclick={() => navigate("settings")}>
                Settings
              </button>
            </div>
          {/if}
          <div class="flex-1 min-h-0">
          <Scan
            {rpc}
            {onMessage}
            scanProgressState={snap.scanProgressState}
            reviewReady={snap.plan !== null}
            {onViewResults}
            onDismiss={onDismissSummary}
            isBatchScanning={snap.isBatchScanning}
            currentScanFolder={snap.currentScanFolder}
            batchFolderProgress={snap.batchFolderProgress}
            showSummary={snap.showSummary}
            scanSummaries={snap.scanSummaries}
            {onBatchScanStarted}
            {onBatchFolderStarted}
            {onBatchFolderComplete}
            {onBatchScanComplete}
          />
          </div>
        {/if}
      </main>
    </div>
    <Footer {rpc} statusText={snap.statusText} isExecuting={snap.isExecuting} onCancel={cancelExecution} />
  </div>
{/if}
