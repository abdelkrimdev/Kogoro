<script lang="ts">
  import type { AppRPC } from "../../shared/types";
  import type { ReviewPlan } from "@kogoro/core";
  import { Sun, Moon, PanelLeftClose, PanelLeftOpen, LoaderCircle } from '@lucide/svelte';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { createRPCThemeState, applyThemeToDocument } from "../state/theme-state";
  import {
    createInitialSnapshot,
    reduceMessage,
    reduceOnViewResults,
    reduceClearAfterReview,
    reduceClearAfterComplete,
    reduceOnBatchScanStarted,
    reduceOnBatchFolderStarted,
    reduceOnBatchFolderComplete,
    reduceOnBatchScanComplete,
    type ScanSessionSnapshot,
  } from "../state/scan-session-reducer";
  import { NAV_ITEMS, type View } from "../state/nav";
  import Wizard from "./Wizard.svelte";
  import Library from "./Library.svelte";
  import Review from "./Review.svelte";
  import Detail from "./Detail.svelte";
  import SettingsView from "./Settings.svelte";
  import Scan from "./Scan.svelte";

  type LibraryStats = AppRPC["bun"]["requests"]["getLibraryStats"]["response"];

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => () => void;
  }

  let { rpc, onMessage }: Props = $props();

  let snap: ScanSessionSnapshot = $state(createInitialSnapshot());
  let libraryStats: LibraryStats | null = $state(null);

  async function refreshLibraryStats() {
    try {
      libraryStats = (await rpc.request("getLibraryStats", {})) as LibraryStats;
    } catch {}
  }

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

  let sidebarCollapsed = $state(false);
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    rpc.request("setSidebarCollapsed", { collapsed: sidebarCollapsed }).catch(() => {});
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

  const isMainView = $derived(currentView !== "review" && currentView !== "details");

  $effect(() => {
    if (currentView === "library" || snap.statusText === "Ready") {
      refreshLibraryStats();
    }
  });

  function navigate(view: View) {
    currentView = view;
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
    currentView = "scan";
  }

  function onViewResults() {
    currentView = "review";
    snap = reduceOnViewResults(snap);
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

    const [{ needsOnboarding }, sidebarResult] = await Promise.all([
      rpc.request("checkOnboarding", {}) as Promise<{ needsOnboarding: boolean }>,
      rpc.request("getSidebarCollapsed", {}) as Promise<{ collapsed: boolean }>,
    ]);

    sidebarCollapsed = sidebarResult.collapsed;

    let view: View;
    if (needsOnboarding) {
      view = "onboarding";
    } else {
      const stats = (await rpc.request("getLibraryStats", {})) as LibraryStats;
      libraryStats = stats;
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
        refreshLibraryStats();
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
  <Wizard {rpc} onComplete={onWizardComplete} />
{:else}
  <div class="h-full flex flex-col">
    <header class="h-12 flex items-center border-b border-surface-300-700 shrink-0" style="-webkit-app-region: drag;">
      <div class="flex items-center gap-2 px-3" style="-webkit-app-region: no-drag;">
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
      {#if isMainView}
        <Navigation layout="sidebar" class="{sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-surface-200-800 transition-[width] duration-200 ease-in-out">
          <Navigation.Content>
            <Navigation.Menu>
              {#each NAV_ITEMS as item}
                <Navigation.Trigger
                  class={currentView === item.view ? 'preset-tonal-primary' : ''}
                  onclick={() => navigate(item.view)}
                >
                  <item.icon class="size-4" />
                  {#if item.view === "scan" && snap.isScanning}
                    <span class="mx-0.5 size-2 rounded-full bg-primary-500 animate-pulse"></span>
                  {/if}
                  {#if !sidebarCollapsed}
                    <Navigation.TriggerText>{item.label}</Navigation.TriggerText>
                  {/if}
                </Navigation.Trigger>
              {/each}
            </Navigation.Menu>
          </Navigation.Content>
        </Navigation>
      {/if}
      <main class="flex-1 overflow-auto relative">
        {#if currentView === "review" && snap.plan && snap.sessionId}
          <Review {rpc} sessionId={snap.sessionId} plan={snap.plan} onComplete={onReviewComplete} />
        {:else if currentView === "library"}
          <Library {rpc} onOpenAnime={openAnime} onStartScan={() => navigate("scan")} />
        {:else if currentView === "settings"}
          <SettingsView {rpc} />
        {:else if currentView === "details" && currentDetailId}
          <Detail {rpc} animeId={currentDetailId} onBack={backToLibrary} />
        {:else}
          <Scan
            {rpc}
            {onMessage}
            scanProgressState={snap.scanProgressState}
            reviewReady={snap.plan !== null}
            {onViewResults}
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
        {/if}
      </main>
    </div>
    <footer class="h-8 flex items-center px-4 border-t border-surface-300-700 bg-surface-100-900 shrink-0 gap-4">
      <span class="text-xs text-surface-600-400">{snap.statusText}</span>
      {#if snap.isExecuting}
        <button
          type="button"
          class="btn btn-sm preset-filled-error-500 rounded-lg text-xs ml-auto"
          onclick={cancelExecution}
        >
          Cancel
        </button>
      {/if}
      {#if libraryStats && (snap.statusText === "Ready" || currentView !== "scan")}
        <span class="text-xs text-surface-500-500">{libraryStats.animeCount} anime &bull; {libraryStats.episodeCount} episodes</span>
      {/if}
    </footer>
  </div>
{/if}
