<script lang="ts">
  import type { ReviewPlan, ScanFileStatus } from "@kogoro/core";
  import type { AppRPC } from "../../shared/types";
  import { Search, LayoutGrid, Settings, Sun, Moon, PanelLeftClose, PanelLeftOpen, LoaderCircle } from '@lucide/svelte';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { onMount } from 'svelte';
  import { createRPCThemeState, applyThemeToDocument } from "../state/theme-state";
  import Wizard from "./Wizard.svelte";
  import Library from "./Library.svelte";
  import Review from "./Review.svelte";
  import Detail from "./Detail.svelte";
  import SettingsView from "./Settings.svelte";
  import ScanView from "./ScanView.svelte";
  import type { ScanProgressState } from "../state/scan-progress-state";
  import { addScanProgressEvent, createScanProgressState } from "../state/scan-progress-state";

  type View = "loading" | "onboarding" | "scan" | "library" | "details" | "settings" | "review";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => void;
    initialView?: View;
  }

  let { rpc, onMessage, initialView = "scan" }: Props = $props();

  let themeState: ReturnType<typeof createRPCThemeState> | null = null;
  let themeMode = $state<"light" | "dark">("light");

  $effect(() => {
    themeState = createRPCThemeState(rpc);
    themeMode = themeState.mode;
    themeState.load();
  });

  const SIDEBAR_KEY = "kogoro-sidebar-collapsed";
  function loadSidebarCollapsed(): boolean {
    try {
      const v = localStorage.getItem(SIDEBAR_KEY);
      return v === "true";
    } catch {
      return false;
    }
  }
  let sidebarCollapsed = $state(loadSidebarCollapsed());
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    } catch {}
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

  let currentView = $state<View>(initialView);
  let currentSessionId = $state<string | null>(null);
  let currentPlan = $state<ReviewPlan | null>(null);
  let currentDetailId = $state<string | null>(null);
  let statusText = $state("Ready");
  let isScanning = $state(false);
  let scanProgressState = $state<ScanProgressState | null>(null);
  type LibraryStats = AppRPC["bun"]["requests"]["getLibraryStats"]["response"];

  let libraryStats = $state<LibraryStats | null>(null);

  function refreshLibraryStats() {
    (async () => {
      try {
        const stats = (await rpc.request("getLibraryStats", {})) as LibraryStats;
        libraryStats = stats;
      } catch {}
    })();
  }

  const NAV_ITEMS = [
    { view: "scan" as const, label: "Scan", icon: Search },
    { view: "library" as const, label: "Library", icon: LayoutGrid },
    { view: "settings" as const, label: "Settings", icon: Settings },
  ];

  const footerText = $derived(statusText);
  const isMainView = $derived(currentView !== "review" && currentView !== "details");

  $effect(() => {
    if (currentView === "library" || statusText === "Ready") {
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

  function onScanStarted() {
    scanProgressState = createScanProgressState();
  }

  function onViewResults() {
    currentView = "review";
    scanProgressState = null;
    statusText = "Review ready";
  }

  function onReviewComplete() {
    currentView = "scan";
    currentSessionId = null;
    currentPlan = null;
  }

  let isLoading = $state(true);

  const MIN_SPINNER_MS = 500;

  onMount(async () => {
    const startTime = Date.now();

    const { needsOnboarding } = (await rpc.request("checkOnboarding", {})) as {
      needsOnboarding: boolean;
    };

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
    onMessage((message, data) => {
      switch (message) {
        case "showOnboarding":
          currentView = "onboarding";
          break;
        case "scanProgress": {
          const scanEvent = data as { completed: number; total: number; file: string; status: string };
          statusText = `Scanning: ${scanEvent.completed}/${scanEvent.total} - ${scanEvent.status}`;
          isScanning = true;
          if (!scanProgressState) scanProgressState = createScanProgressState();
          addScanProgressEvent(scanProgressState, {
            file: scanEvent.file,
            status: scanEvent.status as ScanFileStatus,
            completed: scanEvent.completed,
            total: scanEvent.total,
          });
          break;
        }
        case "scanPhaseComplete": {
          const phaseEvent = data as { phase: string; summary: { totalFiles: number } };
          statusText = `Phase complete: ${phaseEvent.phase}`;
          break;
        }
        case "scanReviewReady": {
          const reviewEvent = data as { sessionId: string; plan: ReviewPlan };
          currentSessionId = reviewEvent.sessionId;
          currentPlan = reviewEvent.plan;
          isScanning = false;
          statusText = "Scan complete — review results";
          break;
        }
        case "scanExecutionProgress": {
          const execEvent = data as { completed: number; total: number; file: string; status: string };
          statusText = `Executing: ${execEvent.completed}/${execEvent.total} - ${execEvent.file.split("/").pop() ?? execEvent.file} - ${execEvent.status}`;
          break;
        }
        case "scanComplete": {
          const completeEvent = data as {
            summary: { renamed: number; renameFailed: number; renameFailures: Array<{ file: string; reason: string }> };
          };
          let text = `Complete: ${completeEvent.summary.renamed} renamed, ${completeEvent.summary.renameFailed} failed`;
          if (completeEvent.summary.renameFailures.length > 0) {
            const reasons = [...new Set(completeEvent.summary.renameFailures.map((f) => f.reason))].join(", ");
            text += ` (${reasons})`;
          }
          statusText = text;
          currentView = "scan";
          currentSessionId = null;
          currentPlan = null;
          isScanning = false;
          scanProgressState = null;
          refreshLibraryStats();
          break;
        }
        case "enrichmentProgress": {
          const enrichEvent = data as { command: string; completed: number; total: number; status: string };
          const label = enrichEvent.command === "artwork" ? "Cover art" : "Metadata";
          statusText = `${label}: ${enrichEvent.completed}/${enrichEvent.total} - ${enrichEvent.status}`;
          break;
        }
      }
    });
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
                  {#if item.view === "scan" && isScanning}
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
      <main class="flex-1 overflow-auto">
        {#if currentView === "review" && currentPlan && currentSessionId}
          <Review {rpc} sessionId={currentSessionId} plan={currentPlan} onComplete={onReviewComplete} />
        {:else if currentView === "library"}
          <Library {rpc} onOpenAnime={openAnime} onStartScan={() => navigate("scan")} />
        {:else if currentView === "settings"}
          <SettingsView {rpc} />
        {:else if currentView === "details" && currentDetailId}
          <Detail {rpc} animeId={currentDetailId} onBack={backToLibrary} />
        {:else}
          <ScanView {rpc} {scanProgressState} onScanStarted={onScanStarted} reviewReady={currentPlan !== null} {onViewResults} />
        {/if}
      </main>
    </div>
    <footer class="h-8 flex items-center px-4 border-t border-surface-300-700 bg-surface-100-900 shrink-0 gap-4">
      <span class="text-xs text-surface-600-400">{footerText}</span>
      {#if libraryStats && (footerText === "Ready" || currentView !== "scan")}
        <span class="text-xs text-surface-500-500">{libraryStats.animeCount} anime &bull; {libraryStats.episodeCount} episodes</span>
      {/if}
    </footer>
  </div>
{/if}
