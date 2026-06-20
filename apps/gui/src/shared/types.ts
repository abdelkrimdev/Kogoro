import type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";
import type { RPCSchema } from "electrobun";
import type { DashboardHandlers } from "../bun/dashboard";
import type { EnrichmentHandlers } from "../bun/enrichment";
import type { LibraryHandlers } from "../bun/library";
import type {
  checkIncompleteOnboarding,
  checkKeyringStatus,
  checkOnboarding,
  writeOnboardingConfig,
} from "../bun/onboarding";
import type { ScanHandlers } from "../bun/scan";
import type {
  applySettingsUpdate,
  buildSettingsFormData,
  togglePlugin,
  updateApiKey,
} from "../bun/settings";
import type {
  getSidebarCollapsed,
  getThemeMode,
  loadWindowState,
  setSidebarCollapsed,
  setThemeMode,
} from "../bun/state";
import type { SyncHandlers } from "../bun/sync";
import type {
  connectTracker,
  disconnectTracker,
  getTrackerConnectionFields,
  getTrackerStatus,
} from "../bun/tracker-connections";
import type { createTrackerImportHandlers } from "../bun/tracker-import";
import type {
  addWatchedFolderHandler,
  getWatchedFoldersHandler,
  markWatchedFolderScannedHandler,
  removeWatchedFolderHandler,
} from "../bun/watched-folders";

export type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";
export type {
  DashboardContinueWatching,
  DashboardCurrentlyWatching,
  DashboardData,
  DashboardStats,
} from "../bun/dashboard";
export type { LibraryAnimeDetail as AnimeDetail } from "../bun/library";
export type { ResolveCandidateEntry as ResolveCandidate } from "../bun/scan";
export type { ThemeMode } from "../bun/state";
export type { SyncConflictInfo } from "../bun/sync";
export type { WatchedFolder } from "../bun/watched-folders";

type AwaitedReturnType<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getWindowState: {
        params: Record<string, never>;
        response: ReturnType<typeof loadWindowState>;
      };
      checkOnboarding: {
        params: Record<string, never>;
        response: ReturnType<typeof checkOnboarding>;
      };
      checkIncompleteOnboarding: {
        params: Record<string, never>;
        response: AwaitedReturnType<typeof checkIncompleteOnboarding>;
      };
      writeOnboardingConfig: {
        params: Parameters<typeof writeOnboardingConfig>[2];
        response: AwaitedReturnType<typeof writeOnboardingConfig>;
      };
      getLibrary: {
        params: Record<string, never>;
        response: AwaitedReturnType<LibraryHandlers["getLibrary"]>;
      };
      getLibraryStats: {
        params: Record<string, never>;
        response: AwaitedReturnType<LibraryHandlers["getLibraryStats"]>;
      };
      getAnimeDetail: {
        params: Parameters<LibraryHandlers["getAnimeDetail"]>[0];
        response: AwaitedReturnType<LibraryHandlers["getAnimeDetail"]>;
      };
      getWatchStatusByAnime: {
        params: Parameters<LibraryHandlers["getWatchStatusByAnime"]>[0];
        response: AwaitedReturnType<LibraryHandlers["getWatchStatusByAnime"]>;
      };
      setWatchStatus: {
        params: Parameters<LibraryHandlers["setWatchStatus"]>[0];
        response: AwaitedReturnType<LibraryHandlers["setWatchStatus"]>;
      };
      updateGroupStatus: {
        params: Parameters<LibraryHandlers["updateGroupStatus"]>[0];
        response: AwaitedReturnType<LibraryHandlers["updateGroupStatus"]>;
      };
      toggleEpisodeWatched: {
        params: Parameters<LibraryHandlers["toggleEpisodeWatched"]>[0];
        response: AwaitedReturnType<LibraryHandlers["toggleEpisodeWatched"]>;
      };
      getSettingsData: {
        params: Record<string, never>;
        response: AwaitedReturnType<typeof buildSettingsFormData>;
      };
      updateSettings: {
        params: Parameters<typeof applySettingsUpdate>[1];
        response: ReturnType<typeof applySettingsUpdate>;
      };
      updateApiKey: {
        params: Parameters<typeof updateApiKey>[1];
        response: AwaitedReturnType<typeof updateApiKey>;
      };
      togglePlugin: {
        params: Parameters<typeof togglePlugin>[1];
        response: ReturnType<typeof togglePlugin>;
      };
      scanStart: {
        params: Parameters<ScanHandlers["scanStart"]>[0];
        response: AwaitedReturnType<ScanHandlers["scanStart"]>;
      };
      approvePlan: {
        params: Parameters<ScanHandlers["approvePlan"]>[0];
        response: AwaitedReturnType<ScanHandlers["approvePlan"]>;
      };
      approveGroup: {
        params: Parameters<ScanHandlers["approveGroup"]>[0];
        response: AwaitedReturnType<ScanHandlers["approveGroup"]>;
      };
      rejectGroup: {
        params: Parameters<ScanHandlers["rejectGroup"]>[0];
        response: AwaitedReturnType<ScanHandlers["rejectGroup"]>;
      };
      cancelScan: {
        params: Parameters<ScanHandlers["cancelScan"]>[0];
        response: AwaitedReturnType<ScanHandlers["cancelScan"]>;
      };
      swapFiles: {
        params: Parameters<ScanHandlers["swapFiles"]>[0];
        response: AwaitedReturnType<ScanHandlers["swapFiles"]>;
      };
      getResolveCandidates: {
        params: Parameters<ScanHandlers["getResolveCandidates"]>[0];
        response: AwaitedReturnType<ScanHandlers["getResolveCandidates"]>;
      };
      searchAnimeByTitle: {
        params: Parameters<ScanHandlers["searchAnimeByTitle"]>[0];
        response: AwaitedReturnType<ScanHandlers["searchAnimeByTitle"]>;
      };
      resolveMatch: {
        params: Parameters<ScanHandlers["resolveMatch"]>[0];
        response: AwaitedReturnType<ScanHandlers["resolveMatch"]>;
      };
      enrichArtwork: {
        params: Parameters<EnrichmentHandlers["enrichArtwork"]>[0];
        response: AwaitedReturnType<EnrichmentHandlers["enrichArtwork"]>;
      };
      enrichMetadata: {
        params: Parameters<EnrichmentHandlers["enrichMetadata"]>[0];
        response: AwaitedReturnType<EnrichmentHandlers["enrichMetadata"]>;
      };
      getThemeMode: {
        params: Record<string, never>;
        response: ReturnType<typeof getThemeMode>;
      };
      setThemeMode: {
        params: Parameters<typeof setThemeMode>[0];
        response: ReturnType<typeof setThemeMode>;
      };
      getSidebarCollapsed: {
        params: Record<string, never>;
        response: ReturnType<typeof getSidebarCollapsed>;
      };
      setSidebarCollapsed: {
        params: Parameters<typeof setSidebarCollapsed>[0];
        response: ReturnType<typeof setSidebarCollapsed>;
      };
      openDirectoryPicker: {
        params: Record<string, never>;
        response: { path: string } | null;
      };
      rebuildLibrary: {
        params: Record<string, never>;
        response: AwaitedReturnType<LibraryHandlers["rebuild"]>;
      };
      getWatchedFolders: {
        params: Record<string, never>;
        response: ReturnType<typeof getWatchedFoldersHandler>;
      };
      addWatchedFolder: {
        params: Parameters<typeof addWatchedFolderHandler>[0];
        response: ReturnType<typeof addWatchedFolderHandler>;
      };
      removeWatchedFolder: {
        params: Parameters<typeof removeWatchedFolderHandler>[0];
        response: ReturnType<typeof removeWatchedFolderHandler>;
      };
      markWatchedFolderScanned: {
        params: Parameters<typeof markWatchedFolderScannedHandler>[0];
        response: ReturnType<typeof markWatchedFolderScannedHandler>;
      };
      checkKeyring: {
        params: Record<string, never>;
        response: AwaitedReturnType<typeof checkKeyringStatus>;
      };
      getTrackerStatus: {
        params: Record<string, never>;
        response: AwaitedReturnType<typeof getTrackerStatus>;
      };
      getTrackerConnectionFields: {
        params: Parameters<typeof getTrackerConnectionFields>[0];
        response: ReturnType<typeof getTrackerConnectionFields>;
      };
      connectTracker: {
        params: Parameters<typeof connectTracker>[1];
        response: AwaitedReturnType<typeof connectTracker>;
      };
      disconnectTracker: {
        params: Parameters<typeof disconnectTracker>[2];
        response: AwaitedReturnType<typeof disconnectTracker>;
      };
      getImportPreview: {
        params: { trackerName: string };
        response: AwaitedReturnType<
          ReturnType<typeof createTrackerImportHandlers>["getImportPreview"]
        >;
      };
      confirmImport: {
        params: {
          trackerName: string;
          selections?: Array<{
            trackerId: string;
            groupId?: number;
            resolution?: "keepLocal" | "acceptTracker";
          }>;
        };
        response: AwaitedReturnType<
          ReturnType<typeof createTrackerImportHandlers>["confirmImport"]
        >;
      };
      getDashboardData: {
        params: Record<string, never>;
        response: AwaitedReturnType<DashboardHandlers["getDashboardData"]>;
      };
      syncAll: {
        params: Record<string, never>;
        response: AwaitedReturnType<SyncHandlers["syncAll"]>;
      };
      syncAnime: {
        params: { animeId: string };
        response: AwaitedReturnType<SyncHandlers["syncAnime"]>;
      };
      triggerManualSync: {
        params: Record<string, never>;
        response: AwaitedReturnType<SyncHandlers["triggerManualSync"]>;
      };
      resolveSyncConflict: {
        params: Parameters<SyncHandlers["resolveSyncConflict"]>[0];
        response: AwaitedReturnType<SyncHandlers["resolveSyncConflict"]>;
      };
    };
    messages: {
      windowWillClose: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  }>;
  webview: RPCSchema<{
    requests: Record<string, never>;
    messages: {
      scanProgress: {
        sessionId: string;
        file: string;
        status: ScanFileStatus;
        matched: boolean;
        completed: number;
        total: number;
      };
      scanPhaseComplete: {
        sessionId: string;
        phase: ScanState;
        summary: ScanSummary;
      };
      scanReviewReady: {
        sessionId: string;
        plan: ReviewPlan;
      };
      scanExecutionProgress: {
        sessionId: string;
        completed: number;
        total: number;
        file: string;
        status: ScanFileStatus;
      };
      scanComplete: {
        sessionId: string;
        summary: ScanSummary;
      };
      scanError: {
        sessionId: string;
        error: string;
      };
      enrichmentProgress: {
        animeId: string;
        command: "artwork" | "metadata";
        completed: number;
        total: number;
        file: string;
        status: string;
      };
      enrichmentComplete: {
        animeId: string;
        command: "artwork" | "metadata";
        success: boolean;
        error?: string;
      };
    };
  }>;
};
