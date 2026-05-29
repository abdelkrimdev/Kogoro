import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/types";

const rpc = Electroview.defineRPC<AppRPC>({
  handlers: {
    requests: {},
    messages: {},
  },
});

const electrobun = new Electroview({ rpc });

type View = "scan" | "library" | "settings";

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
        <h2 class="text-2xl font-bold">Settings</h2>
        <p class="text-surface-500">Configure your Kogoro preferences.</p>
      </div>
    </div>
  `,
};

let currentView: View = "scan";

function renderView(view: View) {
  const content = document.getElementById("content");
  const statusText = document.getElementById("status-text");
  if (content) content.innerHTML = views[view];
  if (statusText)
    statusText.textContent =
      view === "library" ? "Library ready" : view === "scan" ? "Ready to scan" : "Settings";

  document.querySelectorAll("[data-nav]").forEach((el) => {
    const navItem = el.getAttribute("data-nav");
    if (navItem === view) {
      el.classList.add("bg-primary-500/20", "text-primary-500");
      el.classList.remove("text-surface-400", "hover:text-surface-200");
    } else {
      el.classList.remove("bg-primary-500/20", "text-primary-500");
      el.classList.add("text-surface-400", "hover:text-surface-200");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderView(currentView);

  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => {
      currentView = el.getAttribute("data-nav") as View;
      renderView(currentView);
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
