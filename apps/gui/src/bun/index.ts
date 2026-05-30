import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR, ConfigManager, createCredentialStore } from "@kogoro/core";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { shouldShowOnboarding } from "./onboarding";

const STATE_FILE = join(import.meta.dir, "../../.window-state.json");

function loadWindowState(): { x: number; y: number; width: number; height: number } | null {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

function saveWindowState(state: { x: number; y: number; width: number; height: number }) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      getWindowState: () => {
        return savedState;
      },
      checkOnboarding: () => {
        return { needsOnboarding: shouldShowOnboarding(CONFIG_DIR) };
      },
      writeOnboardingConfig: async (params) => {
        const { primaryDb, apiKey, templatePreset, templateCustom } = params;
        // Set primary-db
        const result1 = configManager.set("primary-db", primaryDb);
        if (!result1.success) return { success: false, error: result1.error };
        // Set template
        const result2 = configManager.set("template.preset", templatePreset);
        if (!result2.success) return { success: false, error: result2.error };
        if (templateCustom) {
          const result3 = configManager.set("template.custom", templateCustom);
          if (!result3.success) return { success: false, error: result3.error };
        }
        // Store API key if provided
        if (apiKey) {
          try {
            await credentialStore.setCredential(primaryDb, apiKey);
          } catch (err) {
            return {
              success: false,
              error: `Failed to store API key: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
        return { success: true };
      },
    },
    messages: {
      "*": () => {},
    },
  },
});

const defaultFrame = { width: 1200, height: 800, x: 200, y: 200 };

const win = new BrowserWindow({
  title: "Kogoro",
  titleBarStyle: "hiddenInset",
  url: "views://mainview/index.html",
  frame: savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : defaultFrame,
  rpc,
});

// Determine which view to show
const needsOnboarding = shouldShowOnboarding(CONFIG_DIR);
const send = rpc.send as unknown as { showOnboarding?: () => void; showMainApp?: () => void };
if (needsOnboarding) {
  send.showOnboarding?.();
} else {
  send.showMainApp?.();
}

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
