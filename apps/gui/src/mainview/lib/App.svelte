<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { FolderSearch } from '@lucide/svelte';
  import Wizard from "./Wizard.svelte";
  import Library from "./Library.svelte";
  import Review from "./Review.svelte";
  import Detail from "./Detail.svelte";
  import Settings from "./Settings.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => void;
  }

  let { rpc, onMessage }: Props = $props();

  type Mode = "onboarding" | "main";
  type View = "scan" | "library" | "details" | "settings" | "review";

  let currentMode = $state<Mode>("main");
  let currentView = $state<View>("scan");
  let currentSessionId = $state<string | null>(null);
  let currentPlan = $state<ReviewPlan | null>(null);
  let currentDetailId = $state<string | null>(null);
  let statusText = $state("Ready");

  function setShellVisible(visible: boolean) {
    const display = visible ? "" : "none";
    for (const selector of ["aside", "header", "footer"]) {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) el.style.display = display;
    }
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

  $effect(() => {
    function handleNav(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.view) {
        currentView = detail.view as View;
        document.querySelectorAll("[data-nav]").forEach((el) => {
          const navItem = el.getAttribute("data-nav");
          if (navItem === detail.view) {
            el.classList.add("bg-primary-500/20", "text-primary-500");
            el.classList.remove("text-surface-400", "hover:text-surface-200");
          } else {
            el.classList.remove("bg-primary-500/20", "text-primary-500");
            el.classList.add("text-surface-400", "hover:text-surface-200");
          }
        });
      }
    }
    window.addEventListener("kogoro:navigate", handleNav);
    return () => window.removeEventListener("kogoro:navigate", handleNav);
  });

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

  $effect(() => {
    setShellVisible(currentMode === "main");
  });

  $effect(() => {
    const statusEl = document.getElementById("status-text");
    if (statusEl) statusEl.textContent = statusText;
  });
</script>

{#if currentMode === "onboarding"}
  <Wizard {rpc} onComplete={onWizardComplete} />
{:else}
  {#if currentView === "review" && currentPlan && currentSessionId}
    <Review {rpc} sessionId={currentSessionId} plan={currentPlan} onComplete={onReviewComplete} />
  {:else if currentView === "library"}
    <Library {rpc} onOpenAnime={openAnime} />
  {:else if currentView === "settings"}
    <Settings {rpc} />
  {:else if currentView === "details" && currentDetailId}
    <Detail {rpc} animeId={currentDetailId} onBack={backToLibrary} />
  {:else}
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-4">
        <FolderSearch class="size-16 text-surface-600 mx-auto" />
        <p class="text-surface-500 text-sm">Drop a folder to scan for anime files.</p>
        <button
          class="btn preset-filled-primary-500 rounded-lg font-medium"
          onclick={async () => {
            try {
              const result = (await rpc.request("scanStart", { path: "/tmp/test" })) as { sessionId: string };
              currentSessionId = result.sessionId;
              statusText = "Scanning...";
            } catch (err) {
              console.error("Failed to start scan:", err);
            }
          }}
        >
          Start Scan
        </button>
      </div>
    </div>
  {/if}
{/if}
