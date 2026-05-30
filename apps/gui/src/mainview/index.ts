import type { ReviewPlan } from "@kogoro/core";
import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/types";
import { renderAnimeDetail } from "./detail";
import { renderLibrary } from "./library";
import { renderReviewScreen } from "./review";
import { renderSettings } from "./settings";
import { renderWizard } from "./wizard";

const rpc = Electroview.defineRPC<AppRPC>({
  handlers: {
    requests: {},
    messages: {
      // Electrobun RPC types messages as Record<string, never> but handlers are functions
      showOnboarding: () => {
        currentMode = "onboarding";
        render();
      },
      showMainApp: () => {
        currentMode = "main";
        render();
      },
      scanProgress: (data: unknown) => {
        // Update status text with scan progress
        const event = data as { completed: number; total: number; file: string; status: string };
        const statusText = document.getElementById("status-text");
        if (statusText) {
          statusText.textContent = `Scanning: ${event.completed}/${event.total} - ${event.status}`;
        }
      },
      scanPhaseComplete: (data: unknown) => {
        const event = data as { phase: string; summary: { totalFiles: number } };
        const statusText = document.getElementById("status-text");
        if (statusText) {
          statusText.textContent = `Phase complete: ${event.phase}`;
        }
      },
      scanReviewReady: (data: unknown) => {
        const event = data as { sessionId: string; plan: ReviewPlan };
        currentSessionId = event.sessionId;
        currentPlan = event.plan;
        currentView = "review";
        render();
      },
      scanExecutionProgress: (data: unknown) => {
        const event = data as { completed: number; total: number; file: string; status: string };
        const statusText = document.getElementById("status-text");
        if (statusText) {
          statusText.textContent = `Executing: ${event.completed}/${event.total} - ${event.status}`;
        }
      },
      scanComplete: (data: unknown) => {
        const event = data as { summary: { renamed: number; renameFailed: number } };
        const statusText = document.getElementById("status-text");
        if (statusText) {
          statusText.textContent = `Complete: ${event.summary.renamed} renamed, ${event.summary.renameFailed} failed`;
        }
        // Return to scan view after completion
        currentView = "scan";
        currentSessionId = null;
        currentPlan = null;
        render();
      },
      enrichmentProgress: (data: unknown) => {
        const event = data as { command: string; completed: number; total: number; status: string };
        const statusText = document.getElementById("status-text");
        if (statusText) {
          const label = event.command === "artwork" ? "Cover art" : "Metadata";
          statusText.textContent = `${label}: ${event.completed}/${event.total} - ${event.status}`;
        }
      },
      enrichmentComplete: (_data: unknown) => {},
    } as any,
  },
});

const electrobun = new Electroview({ rpc });

type Mode = "onboarding" | "main";
type View = "scan" | "library" | "details" | "settings" | "review";

let currentMode: Mode = "main";
let currentView: View = "scan";
let currentSessionId: string | null = null;
let currentPlan: ReviewPlan | null = null;
let currentDetailId: string | null = null;

const views: Record<View, string> = {
  scan: `
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-bold">Scan</h2>
        <p class="text-surface-500">Drop a folder to scan for anime files.</p>
        <button id="start-scan" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
          Start Scan
        </button>
      </div>
    </div>
  `,
  library: `
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-bold">Library</h2>
        <p class="text-surface-500">No library yet — scan a folder to get started.</p>
      </div>
    </div>
  `,
  settings: "",
  review: "",
  details: "",
};

function setShellVisible(visible: boolean): void {
  const display = visible ? "" : "none";
  for (const selector of ["aside", "header", "footer"]) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) el.style.display = display;
  }
}

function renderMain(): void {
  setShellVisible(true);

  const content = document.getElementById("content");
  const statusText = document.getElementById("status-text");
  if (content) {
    if (currentView === "review" && currentPlan) {
      renderReviewScreen(content, {
        rpc: rpc as any,
        sessionId: currentSessionId!,
        plan: currentPlan,
        onComplete: () => {
          currentView = "scan";
          currentSessionId = null;
          currentPlan = null;
          render();
        },
      });
    } else if (currentView === "library") {
      renderLibrary(content, rpc as any, statusText, (id: string) => {
        currentDetailId = id;
        currentView = "details";
        render();
      });
    } else if (currentView === "settings") {
      renderSettings(content, rpc as any);
    } else if (currentView === "details" && currentDetailId) {
      renderAnimeDetail(
        content,
        rpc as any,
        currentDetailId,
        () => {
          currentView = "library";
          currentDetailId = null;
          render();
        },
        statusText,
      );
    } else {
      content.innerHTML = views[currentView];
    }
  }
  if (statusText) {
    switch (currentView) {
      case "library":
        statusText.textContent = "Library ready";
        break;
      case "scan":
        statusText.textContent = "Ready to scan";
        break;
      case "settings":
        statusText.textContent = "Settings";
        break;
      case "review":
        statusText.textContent = "Review plan";
        break;
      case "details":
        statusText.textContent = "Anime details";
        break;
    }
  }

  document.querySelectorAll("[data-nav]").forEach((el) => {
    const navItem = el.getAttribute("data-nav");
    if (navItem === currentView) {
      el.classList.add("bg-primary-500/20", "text-primary-500");
      el.classList.remove("text-surface-400", "hover:text-surface-200");
    } else {
      el.classList.remove("bg-primary-500/20", "text-primary-500");
      el.classList.add("text-surface-400", "hover:text-surface-200");
    }
  });

  const startScanBtn = document.getElementById("start-scan");
  if (startScanBtn) {
    startScanBtn.addEventListener("click", async () => {
      try {
        const result = (await rpc.request("scanStart", { path: "/tmp/test" })) as {
          sessionId: string;
        };
        currentSessionId = result.sessionId;
        if (statusText) {
          statusText.textContent = "Scanning...";
        }
      } catch (err) {
        console.error("Failed to start scan:", err);
      }
    });
  }
}

function renderOnboarding(): void {
  setShellVisible(false);

  const content = document.getElementById("content");
  if (content) {
    // Electrobun RPC type mismatch between request/response schemas
    renderWizard(content, rpc as any, () => {
      // After onboarding completes, switch to main app
      currentMode = "main";
      render();
    });
  }
}

function render(): void {
  if (currentMode === "onboarding") {
    renderOnboarding();
  } else {
    renderMain();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Request onboarding status from main process
  rpc.request("checkOnboarding", {}).then((result) => {
    currentMode = result.needsOnboarding ? "onboarding" : "main";
    render();
  });

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      currentView = el.getAttribute("data-nav") as View;
      renderMain();
    });
  });
});

window.addEventListener("beforeunload", () => {
  const { innerWidth, innerHeight, screenX, screenY } = window;
  const rpc = electrobun.rpc as unknown as {
    send?: { windowWillClose?: (data: unknown) => void };
  };
  rpc.send?.windowWillClose?.({
    x: screenX,
    y: screenY,
    width: innerWidth,
    height: innerHeight,
  });
});
