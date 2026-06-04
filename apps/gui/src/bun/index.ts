import { CONFIG_DIR, ConfigManager, createCredentialStore } from "@kogoro/core";
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import { shouldShowOnboarding, writeOnboardingConfig } from "./onboarding";
import {
  cleanupSession,
  createScanOrchestrator,
  findCandidateMatches,
  getMatcher,
  getOrchestrator,
} from "./scan";
import { applySettingsUpdate, buildSettingsFormData, togglePlugin, updateApiKey } from "./settings";
import { loadThemeMode, loadWindowState, saveThemeMode, saveWindowState } from "./state";

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();

const libraryHandlers = createLibraryHandlers(CONFIG_DIR, configManager);

const enrichmentHandlers = createEnrichmentHandlers({
  configManager,
  credentialStore,
  configDir: CONFIG_DIR,
  send: {
    enrichmentProgress: (data) => rpc.send.enrichmentProgress(data),
    enrichmentComplete: (data) => rpc.send.enrichmentComplete(data),
  },
});

const rpc = BrowserView.defineRPC<AppRPC>({
  maxRequestTime: 5000,
  handlers: {
    requests: {
      getWindowState: () => savedState,
      checkOnboarding: () => ({ needsOnboarding: shouldShowOnboarding(CONFIG_DIR) }),
      writeOnboardingConfig: (params) =>
        writeOnboardingConfig(configManager, credentialStore, params),
      getLibrary: () => libraryHandlers.getLibrary(),
      getLibraryStats: () => libraryHandlers.getLibraryStats(),
      getAnimeDetail: (params) => libraryHandlers.getAnimeDetail(params),
      getWatchStatusByAnime: (params) => libraryHandlers.getWatchStatusByAnime(params),
      setWatchStatus: (params) => libraryHandlers.setWatchStatus(params),
      getSettingsData: async () => buildSettingsFormData(configManager, credentialStore),
      updateSettings: (params) => applySettingsUpdate(configManager, params),
      updateApiKey: (params) => updateApiKey(credentialStore, params),
      togglePlugin: (params) => togglePlugin(configManager, params),
      openDirectoryPicker: async () => {
        const paths = await Utils.openFileDialog({
          canChooseFiles: false,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
        });
        const dir = paths[0];
        return dir ? { path: dir } : null;
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
        const orchestrator = getOrchestrator(sessionId);
        await orchestrator.approvePlan();

        const matches = orchestrator.getMatchResults();
        const sourceDb = configManager.get("primary-db");
        if (matches.length > 0 && typeof sourceDb === "string" && sourceDb) {
          libraryHandlers.mergeMatches(matches, sourceDb);
        }

        return undefined;
      },
      rejectPlan: async (params) => {
        getOrchestrator(params.sessionId).rejectPlan();
        return undefined;
      },
      approveGroup: async (params) => {
        getOrchestrator(params.sessionId).approveGroup(params.animeId);
        return undefined;
      },
      rejectGroup: async (params) => {
        getOrchestrator(params.sessionId).rejectGroup(params.animeId);
        return undefined;
      },
      cancelScan: async (params) => {
        getOrchestrator(params.sessionId).cancel();
        cleanupSession(params.sessionId);
        return undefined;
      },
      swapFiles: async (params) => {
        getOrchestrator(params.sessionId).swapFiles(params.fileAId, params.fileBId);
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
        await getOrchestrator(params.sessionId).resolveMatch(
          params.fileId,
          params.animeId,
          params.episodeId,
        );
        return undefined;
      },
      enrichArtwork: (params) => enrichmentHandlers.enrichArtwork(params),
      enrichMetadata: (params) => enrichmentHandlers.enrichMetadata(params),
      getThemeMode: () => {
        const mode = loadThemeMode();
        return mode ? { mode } : null;
      },
      setThemeMode: (params) => {
        saveThemeMode(params.mode);
        return { success: true };
      },
      rebuildLibrary: async () => libraryHandlers.rebuild(),
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

win.on("resize", (event: unknown) => {
  const e = event as { data: { x: number; y: number; width: number; height: number } };
  saveWindowState({ x: e.data.x, y: e.data.y, width: e.data.width, height: e.data.height });
});

win.on("move", () => {
  const frame = win.getFrame();
  saveWindowState({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
});
