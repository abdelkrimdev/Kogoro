import { CONFIG_DIR, ConfigManager, createCredentialStore } from "@kogoro/core";
import { BrowserView, BrowserWindow } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding } from "./onboarding";
import { createScanOrchestrator, findCandidateMatches, getMatcher, getOrchestrator } from "./scan";
import { applySettingsUpdate, buildSettingsFormData } from "./settings";
import { loadThemeMode, loadWindowState, saveThemeMode, saveWindowState } from "./state";

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const libraryHandlers = createLibraryHandlers(CONFIG_DIR);

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
        const result1 = configManager.set("primary-db", primaryDb);
        if (!result1.success) return { success: false, error: result1.error };
        const result2 = configManager.set("template.preset", templatePreset);
        if (!result2.success) return { success: false, error: result2.error };
        if (templateCustom) {
          const result3 = configManager.set("template.custom", templateCustom);
          if (!result3.success) return { success: false, error: result3.error };
        }
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
      getWatchStatusByAnime: (params) => libraryHandlers.getWatchStatusByAnime(params),
      setWatchStatus: (params) => libraryHandlers.setWatchStatus(params),
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
        return applySettingsUpdate(configManager, params);
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
        const orchestrator = await createScanOrchestrator(
          sessionId,
          configManager,
          credentialStore,
        );

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
      getResolveCandidates: async (params) => {
        const { sessionId, fileId } = params;
        const orchestrator = getOrchestrator(sessionId);
        const plan = orchestrator.getPlan();
        if (!plan) return { candidates: [] };

        let sourcePath: string | null = null;
        for (const group of plan.groups) {
          for (const file of group.files) {
            if (file.fileId === fileId) {
              sourcePath = file.sourcePath;
              break;
            }
          }
          if (sourcePath) break;
        }
        if (!sourcePath) return { candidates: [] };

        const matcher = getMatcher(sessionId);
        if (!matcher) return { candidates: [] };

        const { best } = await findCandidateMatches(matcher, sourcePath);

        return {
          candidates: best.map((m) => ({
            animeId: m.anime.id,
            animeTitle: m.anime.titleEn,
            entryType: m.anime.entryType,
            episodeId: m.episode?.id ?? "",
            episodeNumber: m.episode?.episode ?? 0,
            season: m.episode?.season ?? 1,
            score: m.score,
          })),
        };
      },
      resolveMatch: async (params) => {
        const { sessionId, fileId, animeId, episodeId } = params;
        await getOrchestrator(sessionId).resolveMatch(fileId, animeId, episodeId);
        return undefined;
      },
      enrichArtwork: async (params) => {
        return handleEnrichment(params, "artwork") as unknown as {
          success: boolean;
          summary?: { total: number; downloaded: number; skipped: number; noArtwork: number };
          error?: string;
        };
      },
      enrichMetadata: async (params) => {
        return handleEnrichment(params, "metadata") as unknown as {
          success: boolean;
          summary?: { total: number; written: number; skipped: number; failed: number };
          error?: string;
        };
      },
      getThemeMode: () => {
        const mode = loadThemeMode();
        return mode ? { mode } : null;
      },
      setThemeMode: (params) => {
        saveThemeMode(params.mode);
        return { success: true };
      },
    },
    messages: {
      "*": () => {},
    },
  },
});

const defaultFrame = { width: 1200, height: 800, x: 200, y: 200 };

const webviewUrl = process.env["VITE_DEV_SERVER_URL"] || "views://mainview/index.html";

const win = new BrowserWindow({
  title: "Kogoro",
  titleBarStyle: "hiddenInset",
  url: webviewUrl,
  frame: savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : defaultFrame,
  rpc,
});

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
