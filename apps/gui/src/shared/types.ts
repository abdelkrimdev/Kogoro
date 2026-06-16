import type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";
import type { RPCSchema } from "electrobun";
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
import type {
  addWatchedFolderHandler,
  getWatchedFoldersHandler,
  markWatchedFolderScannedHandler,
  removeWatchedFolderHandler,
} from "../bun/watched-folders";

export type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";
export type { LibraryAnimeDetail as AnimeDetail } from "../bun/library";
export type { ResolveCandidateEntry as ResolveCandidate } from "../bun/scan";
export type { ThemeMode } from "../bun/state";
export type { WatchedFolder } from "../bun/watched-folders";

type Res<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>;

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
        response: Res<typeof checkIncompleteOnboarding>;
      };
      writeOnboardingConfig: {
        params: Parameters<typeof writeOnboardingConfig>[2];
        response: Res<typeof writeOnboardingConfig>;
      };
      getLibrary: {
        params: Record<string, never>;
        response: Res<LibraryHandlers["getLibrary"]>;
      };
      getLibraryStats: {
        params: Record<string, never>;
        response: Res<LibraryHandlers["getLibraryStats"]>;
      };
      getAnimeDetail: {
        params: Parameters<LibraryHandlers["getAnimeDetail"]>[0];
        response: Res<LibraryHandlers["getAnimeDetail"]>;
      };
      getWatchStatusByAnime: {
        params: Parameters<LibraryHandlers["getWatchStatusByAnime"]>[0];
        response: Res<LibraryHandlers["getWatchStatusByAnime"]>;
      };
      setWatchStatus: {
        params: Parameters<LibraryHandlers["setWatchStatus"]>[0];
        response: Res<LibraryHandlers["setWatchStatus"]>;
      };
      getSettingsData: {
        params: Record<string, never>;
        response: Res<typeof buildSettingsFormData>;
      };
      updateSettings: {
        params: Parameters<typeof applySettingsUpdate>[1];
        response: ReturnType<typeof applySettingsUpdate>;
      };
      updateApiKey: {
        params: Parameters<typeof updateApiKey>[1];
        response: Res<typeof updateApiKey>;
      };
      togglePlugin: {
        params: Parameters<typeof togglePlugin>[1];
        response: ReturnType<typeof togglePlugin>;
      };
      scanStart: {
        params: Parameters<ScanHandlers["scanStart"]>[0];
        response: Res<ScanHandlers["scanStart"]>;
      };
      approvePlan: {
        params: Parameters<ScanHandlers["approvePlan"]>[0];
        response: Res<ScanHandlers["approvePlan"]>;
      };
      approveGroup: {
        params: Parameters<ScanHandlers["approveGroup"]>[0];
        response: Res<ScanHandlers["approveGroup"]>;
      };
      rejectGroup: {
        params: Parameters<ScanHandlers["rejectGroup"]>[0];
        response: Res<ScanHandlers["rejectGroup"]>;
      };
      cancelScan: {
        params: Parameters<ScanHandlers["cancelScan"]>[0];
        response: Res<ScanHandlers["cancelScan"]>;
      };
      swapFiles: {
        params: Parameters<ScanHandlers["swapFiles"]>[0];
        response: Res<ScanHandlers["swapFiles"]>;
      };
      getResolveCandidates: {
        params: Parameters<ScanHandlers["getResolveCandidates"]>[0];
        response: Res<ScanHandlers["getResolveCandidates"]>;
      };
      searchAnimeByTitle: {
        params: Parameters<ScanHandlers["searchAnimeByTitle"]>[0];
        response: Res<ScanHandlers["searchAnimeByTitle"]>;
      };
      resolveMatch: {
        params: Parameters<ScanHandlers["resolveMatch"]>[0];
        response: Res<ScanHandlers["resolveMatch"]>;
      };
      enrichArtwork: {
        params: Parameters<EnrichmentHandlers["enrichArtwork"]>[0];
        response: Res<EnrichmentHandlers["enrichArtwork"]>;
      };
      enrichMetadata: {
        params: Parameters<EnrichmentHandlers["enrichMetadata"]>[0];
        response: Res<EnrichmentHandlers["enrichMetadata"]>;
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
        response: Res<LibraryHandlers["rebuild"]>;
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
        response: Res<typeof checkKeyringStatus>;
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
