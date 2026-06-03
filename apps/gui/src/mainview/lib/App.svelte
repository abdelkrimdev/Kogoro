<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { FolderSearch, Search, LayoutGrid, Settings, Sun, Moon, PanelLeftClose, PanelLeftOpen } from '@lucide/svelte';
  import { Navigation } from '@skeletonlabs/skeleton-svelte';
  import { createRPCThemeState, applyThemeToDocument } from "../state/theme-state";
  import Wizard from "./Wizard.svelte";
  import Library from "./Library.svelte";
  import Review from "./Review.svelte";
  import Detail from "./Detail.svelte";
  import SettingsView from "./Settings.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => void;
  }

  let { rpc, onMessage }: Props = $props();

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

  type Mode = "onboarding" | "main";
  type View = "scan" | "library" | "details" | "settings" | "review";

  let currentMode = $state<Mode>("main");
  let currentView = $state<View>("scan");
  let currentSessionId = $state<string | null>(null);
  let currentPlan = $state<ReviewPlan | null>(null);
  let currentDetailId = $state<string | null>(null);
  let statusText = $state("Ready");

  const NAV_ITEMS = [
    { view: "scan" as const, label: "Scan", icon: Search },
    { view: "library" as const, label: "Library", icon: LayoutGrid },
    { view: "settings" as const, label: "Settings", icon: Settings },
  ];

  function navigate(view: string) {
    currentView = view as View;
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
    currentMode = "main";
  }

  function onReviewComplete() {
    currentView = "scan";
    currentSessionId = null;
    currentPlan = null;
  }

  async function startScan() {
    try {
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;
      const scanResult = (await rpc.request("scanStart", { path: result.path })) as { sessionId: string };
      currentSessionId = scanResult.sessionId;
      statusText = "Scanning...";
    } catch (err) {
      console.error("Failed to start scan:", err);
    }
  }

  $effect(() => {
    onMessage((message, data) => {
      switch (message) {
        case "showOnboarding":
          currentMode = "onboarding";
          break;
        case "showMainApp":
          currentMode = "main";
          break;
        case "scanProgress": {
          const scanEvent = data as { completed: number; total: number; file: string; status: string };
          statusText = `Scanning: ${scanEvent.completed}/${scanEvent.total} - ${scanEvent.status}`;
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
          currentView = "review";
          break;
        }
        case "scanExecutionProgress": {
          const execEvent = data as { completed: number; total: number; file: string; status: string };
          statusText = `Executing: ${execEvent.completed}/${execEvent.total} - ${execEvent.status}`;
          break;
        }
        case "scanComplete": {
          const completeEvent = data as { summary: { renamed: number; renameFailed: number } };
          statusText = `Complete: ${completeEvent.summary.renamed} renamed, ${completeEvent.summary.renameFailed} failed`;
          currentView = "scan";
          currentSessionId = null;
          currentPlan = null;
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

{#if currentMode === "onboarding"}
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
      <Navigation layout="sidebar" class="{sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-surface-200-800 transition-[width] duration-200 ease-in-out">
        <Navigation.Content>
          <Navigation.Menu>
            {#each NAV_ITEMS as item}
              <Navigation.Trigger
                class={currentView === item.view ? 'preset-tonal-primary' : ''}
                onclick={() => navigate(item.view)}
              >
                <item.icon class="size-4" />
                {#if !sidebarCollapsed}
                  <Navigation.TriggerText>{item.label}</Navigation.TriggerText>
                {/if}
              </Navigation.Trigger>
            {/each}
          </Navigation.Menu>
        </Navigation.Content>
      </Navigation>
      <main class="flex-1 overflow-auto">
        {#if currentView === "review" && currentPlan && currentSessionId}
          <Review {rpc} sessionId={currentSessionId} plan={currentPlan} onComplete={onReviewComplete} />
        {:else if currentView === "library"}
          <Library {rpc} onOpenAnime={openAnime} onNavigate={navigate} />
        {:else if currentView === "settings"}
          <SettingsView {rpc} />
        {:else if currentView === "details" && currentDetailId}
          <Detail {rpc} animeId={currentDetailId} onBack={backToLibrary} />
        {:else}
          <div class="flex items-center justify-center h-full">
            <div class="text-center space-y-4">
              <FolderSearch class="size-16 text-surface-600-400 mx-auto" />
              <p class="text-surface-600-400 text-sm">Drop a folder to scan for anime files.</p>
              <button
                type="button"
                class="btn preset-filled-primary-500 rounded-lg font-medium"
                onclick={startScan}
              >
                Start Scan
              </button>
            </div>
          </div>
        {/if}
      </main>
    </div>
    <footer class="h-8 flex items-center px-4 border-t border-surface-300-700 bg-surface-100-900 shrink-0">
      <span class="text-xs text-surface-600-400">{statusText}</span>
    </footer>
  </div>
{/if}
