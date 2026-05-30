import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR, ConfigManager, createCredentialStore, ScanOrchestrator } from "@kogoro/core";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding } from "./onboarding";
import { buildSettingsFormData } from "./settings";

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

const libraryHandlers = createLibraryHandlers(CONFIG_DIR);

const scanOrchestrators = new Map<string, ScanOrchestrator>();

function getOrchestrator(sessionId: string): ScanOrchestrator {
  const orchestrator = scanOrchestrators.get(sessionId);
  if (!orchestrator) {
    throw new Error("Scan session not found");
  }
  return orchestrator;
}

function createScanOrchestrator(sessionId: string): ScanOrchestrator {
  const orchestrator = new ScanOrchestrator({
    scanner: {
      async match(_parsed: unknown) {
        return [];
      },
    },
    walk: async (_path: string) => {
      return [];
    },
    scanFile: async (_filePath: string) => {
      return {
        file: "",
        hash: "",
        parsed: {
          title: null,
          season: null,
          episode: null,
          tags: { group: null, resolution: null, source: null, codec: null, audio: null },
        },
        match: null,
        plan: null,
        cached: false,
        skipped: false,
        status: "failed" as const,
      };
    },
  });

  scanOrchestrators.set(sessionId, orchestrator);
  return orchestrator;
}

async function handleEnrichment(params: { id: string }, command: "artwork" | "metadata") {
  const send = rpc.send as unknown as {
    enrichmentProgress?: (data: unknown) => void;
    enrichmentComplete?: (data: unknown) => void;
  };
  const enrichment = createEnrichmentHandlers({
    configManager,
    credentialStore,
    configDir: CONFIG_DIR,
    send: {
      enrichmentProgress: (data) => send.enrichmentProgress?.(data),
      enrichmentComplete: (data) => send.enrichmentComplete?.(data),
    },
  });
  const result =
    command === "artwork"
      ? await enrichment.enrichArtwork(params)
      : await enrichment.enrichMetadata(params);
  send.enrichmentComplete?.({
    animeId: params.id,
    command,
    success: result.success,
    error: result.error,
  });
  return result;
}

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
      getLibrary: () => libraryHandlers.getLibrary(),
      getAnimeDetail: (params) => libraryHandlers.getAnimeDetail(params),
      getSettingsData: async () => {
        const apiKeys: Record<string, string | undefined> = {};
        for (const plugin of ["tvdb", "anidb", "opensubtitles"]) {
          try {
            apiKeys[plugin] = (await credentialStore.getCredential(plugin)) ?? undefined;
          } catch {
            apiKeys[plugin] = undefined;
          }
        }
        return buildSettingsFormData(configManager, apiKeys);
      },
      updateSettings: async (params) => {
        const fieldMap: Record<string, string> = {
          primaryDb: "primary-db",
          secondaryDbs: "secondary-dbs",
          templatePreset: "template.preset",
          templateCustom: "template.custom",
          directoryTemplate: "template.directory",
          mediaExtensions: "media-extensions",
          excludePatterns: "exclude-patterns",
          scanConcurrency: "scan-concurrency",
          fetchConcurrency: "fetch-concurrency",
          episodeNumbering: "episode-numbering",
          renameAction: "rename-action",
          subtitleLanguage: "subtitle-language",
        };

        for (const [key, value] of Object.entries(params)) {
          if (value === undefined) continue;
          const configKey = fieldMap[key];
          if (!configKey) continue;
          const result = configManager.set(configKey, String(value));
          if (!result.success) return { success: false, error: result.error };
        }
        return { success: true };
      },
      updateApiKey: async (params) => {
        const { plugin, apiKey } = params;
        if (!apiKey) {
          try {
            await credentialStore.deleteCredential(plugin);
          } catch (err) {
            return {
              success: false,
              error: `Failed to delete API key: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
          return { success: true };
        }
        try {
          await credentialStore.setCredential(plugin, apiKey);
        } catch (err) {
          return {
            success: false,
            error: `Failed to store API key: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
        return { success: true };
      },
      togglePlugin: async (params) => {
        const { plugin, enabled } = params;
        const result = configManager.set(`plugins.${plugin}.enabled`, String(enabled));
        if (!result.success) return { success: false, error: result.error };
        return { success: true };
      },
      scanStart: async (params) => {
        const { path } = params;
        const sessionId = crypto.randomUUID();
        const orchestrator = createScanOrchestrator(sessionId);

        const send = rpc.send as unknown as {
          scanProgress?: (data: unknown) => void;
          scanPhaseComplete?: (data: unknown) => void;
          scanReviewReady?: (data: unknown) => void;
          scanExecutionProgress?: (data: unknown) => void;
          scanComplete?: (data: unknown) => void;
        };

        orchestrator.on("*", (event) => {
          switch (event.type) {
            case "scanProgress":
              send.scanProgress?.(event);
              break;
            case "scanPhaseComplete":
              send.scanPhaseComplete?.(event);
              break;
            case "scanReviewReady":
              send.scanReviewReady?.(event);
              break;
            case "scanExecutionProgress":
              send.scanExecutionProgress?.(event);
              break;
            case "scanComplete":
              send.scanComplete?.(event);
              break;
          }
        });

        orchestrator.startScan(path).catch((err) => {
          console.error("Scan failed:", err);
        });

        return { sessionId };
      },
      approvePlan: async (params) => {
        const { sessionId } = params;
        await getOrchestrator(sessionId).approvePlan();
        return undefined;
      },
      rejectPlan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).rejectPlan();
        return undefined;
      },
      cancelScan: async (params) => {
        const { sessionId } = params;
        getOrchestrator(sessionId).cancel();
        return undefined;
      },
      swapFiles: async (params) => {
        const { sessionId, fileAId, fileBId } = params;
        getOrchestrator(sessionId).swapFiles(fileAId, fileBId);
        return undefined;
      },
      enrichArtwork: async (params) => {
        return handleEnrichment(params, "artwork") as any;
      },
      enrichMetadata: async (params) => {
        return handleEnrichment(params, "metadata") as any;
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
