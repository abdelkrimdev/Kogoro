import { CONFIG_DIR, ConfigManager, createCredentialStore } from "@kogoro/core";
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding } from "./onboarding";
import {
  cleanupSession,
  createScanOrchestrator,
  findCandidateMatches,
  getMatcher,
  getOrchestrator,
} from "./scan";
import { applySettingsUpdate, buildSettingsFormData } from "./settings";
import { loadThemeMode, loadWindowState, saveThemeMode, saveWindowState } from "./state";

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const libraryHandlers = createLibraryHandlers(CONFIG_DIR);

function createEnrichment() {
  return createEnrichmentHandlers({
    configManager,
    credentialStore,
    configDir: CONFIG_DIR,
    send: {
      enrichmentProgress: (data) => rpc.send.enrichmentProgress(data),
      enrichmentComplete: (data) => rpc.send.enrichmentComplete(data),
    },
  });
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

        orchestrator.on("*", (event) => {
          switch (event.type) {
            case "scanProgress":
              rpc.send.scanProgress(event);
              break;
            case "scanPhaseComplete":
              rpc.send.scanPhaseComplete(event);
              break;
            case "scanReviewReady":
              rpc.send.scanReviewReady(event);
              break;
            case "scanExecutionProgress":
              rpc.send.scanExecutionProgress(event);
              break;
            case "scanComplete":
              rpc.send.scanComplete(event);
              cleanupSession(sessionId);
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
        cleanupSession(sessionId);
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
        return createEnrichment().enrichArtwork(params);
      },
      enrichMetadata: async (params) => {
        return createEnrichment().enrichMetadata(params);
      },
      getThemeMode: () => {
        const mode = loadThemeMode();
        return mode ? { mode } : null;
      },
      setThemeMode: (params) => {
        saveThemeMode(params.mode);
        return { success: true };
      },
      openDirectoryPicker: async () => {
        const paths = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const first = paths[0];
        if (first) {
          return { path: first };
        }
        return null;
      },
    },
    messages: {
      windowWillClose: (data) => {
        saveWindowState({ x: data.x, y: data.y, width: data.width, height: data.height });
      },
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
if (needsOnboarding) {
  rpc.send.showOnboarding({});
}

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
