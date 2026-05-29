import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/types";
import { renderWizard } from "./wizard";

const rpc = Electroview.defineRPC<AppRPC>({
  handlers: {
    requests: {},
    messages: {
      showOnboarding: () => {
        currentMode = "onboarding";
        render();
      },
      showMainApp: () => {
        currentMode = "main";
        render();
      },
    } as any,
  },
});

const electrobun = new Electroview({ rpc });

type Mode = "onboarding" | "main";
type View = "scan" | "library" | "settings";

let currentMode: Mode = "main";
let currentView: View = "scan";

const views: Record<View, string> = {
  scan: `
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-4">
        <h2 class="text-2xl font-bold">Scan</h2>
        <p class="text-surface-500">Drop a folder to scan for anime files.</p>
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
  settings: `
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-4">
        <h2 class="text-xl font-bold">Settings</h2>
        <p class="text-surface-500">Configure your Kogoro preferences.</p>
      </div>
    </div>
  `,
};

function renderMain(): void {
  const sidebar = document.querySelector("aside");
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  if (sidebar) sidebar.style.display = "";
  if (header) header.style.display = "";
  if (footer) footer.style.display = "";

  const content = document.getElementById("content");
  const statusText = document.getElementById("status-text");
  if (content) content.innerHTML = views[currentView];
  if (statusText)
    statusText.textContent =
      currentView === "library"
        ? "Library ready"
        : currentView === "scan"
          ? "Ready to scan"
          : "Settings";

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
}

function renderOnboarding(): void {
  const sidebar = document.querySelector("aside");
  const header = document.querySelector("header");
  const footer = document.querySelector("footer");
  if (sidebar) sidebar.style.display = "none";
  if (header) header.style.display = "none";
  if (footer) footer.style.display = "none";

  const content = document.getElementById("content");
  if (content) {
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
