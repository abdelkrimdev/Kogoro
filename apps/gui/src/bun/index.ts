import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BunSecretsKeytar,
  CacheService,
  CONFIG_DIR,
  ConfigManager,
  checkKeyring,
  createCredentialStore,
  createLibraryConnection,
  createMatchCacheConnection,
  LibraryService,
  resolveDbPaths,
  ScanStateService,
} from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";
import { BrowserView, BrowserWindow, Utils } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import {
  checkIncompleteOnboarding,
  shouldShowOnboarding,
  writeOnboardingConfig,
} from "./onboarding";
import { createScanHandlers } from "./scan";
import { applySettingsUpdate, buildSettingsFormData, togglePlugin, updateApiKey } from "./settings";
import {
  loadSidebarCollapsed,
  loadThemeMode,
  loadWindowState,
  saveSidebarCollapsed,
  saveThemeMode,
  saveWindowState,
} from "./state";
import {
  addWatchedFolderHandler,
  getWatchedFoldersHandler,
  markWatchedFolderScannedHandler,
  removeWatchedFolderHandler,
} from "./watched-folders";

const savedState = loadWindowState();

const configManager = new ConfigManager();
const credentialStore = createCredentialStore();
const pluginFactory = new PluginFactory(configManager, credentialStore);

const { cacheDbPath, libraryDbPath } = resolveDbPaths();
const { matchRepo, scanStateRepo } = createMatchCacheConnection(cacheDbPath);
const libraryRepo = createLibraryConnection(libraryDbPath);
const cacheService = new CacheService(matchRepo, scanStateRepo);
const scanStateService = new ScanStateService(scanStateRepo);
const libraryService = new LibraryService(libraryRepo);

const libraryHandlers = createLibraryHandlers({
  libraryService,
  getSourceDb: () => String(configManager.get("primary-db") ?? "tvdb"),
});

const enrichmentHandlers = createEnrichmentHandlers({
  pluginFactory,
  configManager,
  libraryService,
  cacheService,
  send: {
    enrichmentProgress: (data: {
      animeId: string;
      command: "artwork" | "metadata";
      completed: number;
      total: number;
      file: string;
      status: string;
    }) => rpc.send.enrichmentProgress(data),
    enrichmentComplete: (data: {
      animeId: string;
      command: "artwork" | "metadata";
      success: boolean;
      error?: string;
    }) => rpc.send.enrichmentComplete(data),
  },
});

const scanHandlers = createScanHandlers({
  pluginFactory,
  configManager,
  cacheService,
  libraryService,
  scanStateService,
  mergeMatches: (matches) => libraryHandlers.mergeMatches(matches),
  send: {
    scanProgress: (data) => rpc.send.scanProgress(data),
    scanPhaseComplete: (data) => rpc.send.scanPhaseComplete(data),
    scanReviewReady: (data) => rpc.send.scanReviewReady(data),
    scanExecutionProgress: (data) => rpc.send.scanExecutionProgress(data),
    scanComplete: (data) => rpc.send.scanComplete(data),
  },
});

const rpc = BrowserView.defineRPC<AppRPC>({
  handlers: {
    requests: {
      getWindowState: () => savedState,
      checkOnboarding: () => ({ needsOnboarding: shouldShowOnboarding(CONFIG_DIR) }),
      checkIncompleteOnboarding: async () =>
        checkIncompleteOnboarding(configManager, credentialStore),
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
      scanStart: (params) => scanHandlers.scanStart(params),
      approvePlan: (params) => scanHandlers.approvePlan(params),
      approveGroup: (params) => scanHandlers.approveGroup(params),
      rejectGroup: (params) => scanHandlers.rejectGroup(params),
      cancelScan: (params) => scanHandlers.cancelScan(params),
      swapFiles: (params) => scanHandlers.swapFiles(params),
      getResolveCandidates: (params) => scanHandlers.getResolveCandidates(params),
      searchAnimeByTitle: (params) => scanHandlers.searchAnimeByTitle(params),
      resolveMatch: (params) => scanHandlers.resolveMatch(params),
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
      getSidebarCollapsed: () => ({ collapsed: loadSidebarCollapsed() }),
      setSidebarCollapsed: (params) => {
        saveSidebarCollapsed(params.collapsed);
        return { success: true };
      },
      rebuildLibrary: async () => libraryHandlers.rebuild(),
      getWatchedFolders: async () => getWatchedFoldersHandler(),
      addWatchedFolder: async (params) => addWatchedFolderHandler(params.path),
      removeWatchedFolder: async (params) => removeWatchedFolderHandler(params.path),
      markWatchedFolderScanned: async (params) => markWatchedFolderScannedHandler(params.path),
      checkKeyring: async () => {
        const keytar = new BunSecretsKeytar();
        return checkKeyring(keytar, process.platform);
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

const webviewUrl =
  process.env["VITE_DEV_SERVER_URL"] ||
  pathToFileURL(join(import.meta.dirname, "..", "views", "mainview", "index.html")).href;

const isMac = process.platform === "darwin";

const win = new BrowserWindow({
  title: "Kogoro",
  ...(isMac ? { titleBarStyle: "hiddenInset" } : {}),
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
