import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  AnimeAggregate,
  buildCredentialFromToken,
  CacheService,
  ConfigManager,
  type CredentialStore,
  createCredentialStore,
  createEventsConnection,
  createLibraryConnection,
  createMatchCacheConnection,
  HttpClient,
  MAL_CLIENT_ID,
  MAL_REDIRECT_URI,
  resolveDbPaths,
  ScanStateService,
  WatchTracker,
} from "@kogoro/core";
import { PluginFactory } from "@kogoro/plugins";
import { BrowserView, BrowserWindow, PATHS, Utils } from "electrobun/bun";
import type { AppRPC } from "../shared/types";
import { createDashboardHandlers } from "./dashboard";
import { createEnrichmentHandlers } from "./enrichment";
import { createLibraryHandlers } from "./library";
import {
  checkIncompleteOnboarding,
  checkKeyringStatus,
  checkOnboarding,
  writeOnboardingConfig,
} from "./onboarding";
import { createScanHandlers } from "./scan";
import { applySettingsUpdate, buildSettingsFormData, togglePlugin, updateApiKey } from "./settings";
import {
  getSidebarCollapsed,
  getThemeMode,
  loadWindowState,
  saveWindowState,
  setSidebarCollapsed,
  setThemeMode,
} from "./state";
import { createSyncHandlers } from "./sync";
import {
  cancelTrackerAuth,
  connectTracker,
  disconnectTracker,
  getTrackerAuthInfo,
  getTrackerConnectionFields,
  getTrackerStatus,
  startTrackerAuth,
  waitForTrackerCallback,
} from "./tracker-connections";
import { createTrackerImportHandlers } from "./tracker-import";
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

const { cacheDbPath, libraryDbPath, eventsDbPath } = resolveDbPaths();
const { matchRepo, scanStateRepo } = createMatchCacheConnection(cacheDbPath);
const libraryRepo = createLibraryConnection(libraryDbPath);
const eventsRepo = createEventsConnection(eventsDbPath);
const cacheService = new CacheService(matchRepo, scanStateRepo);
const scanStateService = new ScanStateService(scanStateRepo);
const animeAggregate = new AnimeAggregate({
  library: libraryRepo,
  replayUnpushedEvents: () => {},
  computeAndPersistLibraryState: () => {},
  enrichmentProviderFactory: () => pluginFactory.enrichmentProvider(),
});
const watchTracker = new WatchTracker({ library: libraryRepo, events: eventsRepo });

const syncHandlers = createSyncHandlers({
  animeAggregate,
  watchTracker,
  eventsRepo,
  pluginFactory,
  credentialStore,
});

const libraryHandlers = createLibraryHandlers({
  animeAggregate,
  watchTracker,
  getSourceDb: () => configManager.primaryDb,
});

const dashboardHandlers = createDashboardHandlers({ animeAggregate });

const trackerImportHandlers = createTrackerImportHandlers({
  animeAggregate,
  pluginFactory,
});

const enrichmentHandlers = createEnrichmentHandlers({
  pluginFactory,
  configManager,
  animeAggregate,
  watchTracker,
  cacheService,
  credentialStore,
  send: {
    enrichmentProgress: (data) => rpc.send.enrichmentProgress(data),
    enrichmentComplete: (data) => rpc.send.enrichmentComplete(data),
  },
});

const scanHandlers = createScanHandlers({
  pluginFactory,
  configManager,
  cacheService,
  animeAggregate,
  scanStateService,
  mergeMatches: async (matches) => animeAggregate.mergeFromMatches(matches),
  send: {
    scanProgress: (data) => rpc.send.scanProgress(data),
    scanPhaseComplete: (data) => rpc.send.scanPhaseComplete(data),
    scanReviewReady: (data) => rpc.send.scanReviewReady(data),
    scanExecutionProgress: (data) => rpc.send.scanExecutionProgress(data),
    scanComplete: (data) => rpc.send.scanComplete(data),
    scanError: (data) => rpc.send.scanError(data),
  },
});

function openDirectoryPickerResult(paths: string[]): { path: string } | null {
  const dir = paths[0];
  return dir ? { path: dir } : null;
}

async function exchangeMalCode(
  code: string,
  credentialStore: CredentialStore,
): Promise<string | null> {
  const verifier = await credentialStore.getCredential("mal_code_verifier");
  if (!verifier) return null;

  const body = new URLSearchParams({
    client_id: MAL_CLIENT_ID,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: MAL_REDIRECT_URI,
  });

  const httpClient = new HttpClient({ minDelay: 0, maxRetries: 0 });
  const response = await httpClient.fetch("https://myanimelist.net/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  let json: Record<string, string>;
  try {
    json = (await response.json()) as Record<string, string>;
  } catch {
    return null;
  }

  if (!response.ok || !json["access_token"]) return null;

  await credentialStore.deleteCredential("mal_code_verifier");
  return JSON.stringify(
    buildCredentialFromToken(
      json["access_token"],
      Number(json["expires_in"]),
      json["refresh_token"],
    ),
  );
}

const rpc = BrowserView.defineRPC<AppRPC>({
  handlers: {
    requests: {
      getWindowState: () => savedState,
      checkOnboarding: () => checkOnboarding(),
      checkIncompleteOnboarding: async () =>
        checkIncompleteOnboarding(configManager, credentialStore),
      writeOnboardingConfig: (params) =>
        writeOnboardingConfig(configManager, credentialStore, params),
      getLibrary: () => libraryHandlers.getLibrary(),
      getLibraryStats: () => libraryHandlers.getLibraryStats(),
      getAnimeDetail: (params) => libraryHandlers.getAnimeDetail(params),
      getWatchStatusByAnime: (params) => libraryHandlers.getWatchStatusByAnime(params),
      setWatchStatus: (params) => libraryHandlers.setWatchStatus(params),
      updateGroupStatus: (params) => libraryHandlers.updateGroupStatus(params),
      toggleEpisodeWatched: (params) => libraryHandlers.toggleEpisodeWatched(params),
      updateEpisodeNotes: (params) => libraryHandlers.updateEpisodeNotes(params),
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
        return openDirectoryPickerResult(paths);
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
      enrichTracker: (params) => enrichmentHandlers.enrichTracker(params),
      getThemeMode: () => getThemeMode(),
      setThemeMode: (params) => setThemeMode(params),
      getSidebarCollapsed: () => getSidebarCollapsed(),
      setSidebarCollapsed: (params) => setSidebarCollapsed(params),
      rebuildLibrary: async () => libraryHandlers.rebuild(),
      getWatchedFolders: async () => getWatchedFoldersHandler(),
      addWatchedFolder: async (params) => addWatchedFolderHandler(params),
      removeWatchedFolder: async (params) => removeWatchedFolderHandler(params),
      markWatchedFolderScanned: async (params) => markWatchedFolderScannedHandler(params),
      checkKeyring: async () => checkKeyringStatus(),
      getTrackerStatus: async () => getTrackerStatus(credentialStore),
      getTrackerConnectionFields: (params) => getTrackerConnectionFields(params),
      getTrackerAuthInfo: (params) => getTrackerAuthInfo(params),
      openExternal: (params) => {
        try {
          Utils.openExternal(params.url);
          return { success: true };
        } catch {
          return { success: false, url: params.url };
        }
      },
      connectTracker: async (params) => {
        const result = await connectTracker(credentialStore, {
          ...params,
          onBeforeStore: async (name, values) => {
            if (name === "anilist") {
              const accessToken = values["code"] ?? "";
              if (!accessToken) return null;
              return JSON.stringify(buildCredentialFromToken(accessToken, 365 * 24 * 60 * 60));
            }
            if (name === "mal") {
              const code = values["code"] ?? "";
              if (!code) return null;
              return exchangeMalCode(code, credentialStore);
            }
            return null;
          },
        });
        if (result.success) {
          syncHandlers.syncAll().catch(() => {});
        }
        return result;
      },
      startTrackerAuth: async (params) => startTrackerAuth(params.trackerName, credentialStore),
      waitForTrackerCallback: async (params) => waitForTrackerCallback(params.state),
      cancelTrackerAuth: async () => cancelTrackerAuth(),
      disconnectTracker: async (params) =>
        disconnectTracker(credentialStore, animeAggregate, eventsRepo, params),
      getImportPreview: async (params) => trackerImportHandlers.getImportPreview(params),
      confirmImport: async (params) => trackerImportHandlers.confirmImport(params),
      syncAll: async () => syncHandlers.syncAll(),
      syncAnime: async (params) => syncHandlers.syncAnime(params),
      pushAnime: async (params) => syncHandlers.pushAnime(params),
      triggerManualSync: async () => syncHandlers.triggerManualSync(),
      resolveSyncConflict: async (params) => syncHandlers.resolveSyncConflict(params),
      getDashboardData: async () => dashboardHandlers.getDashboardData(),
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
  pathToFileURL(join(PATHS.VIEWS_FOLDER, "mainview", "index.html")).href;

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
