import type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";
import type { RPCSchema } from "electrobun";

export type { ReviewPlan, ScanFileStatus, ScanState, ScanSummary } from "@kogoro/core";

export type ThemeMode = "light" | "dark";

export interface WatchedFolder {
  path: string;
  addedAt: string;
  lastScannedAt?: string;
  exists: boolean;
}

export interface ResolveCandidate {
  animeId: string;
  animeTitle: string;
  entryType: string;
  episodeId: string;
  episodeNumber: number;
  season: number;
  score: number;
}

export interface AnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    entryType: string;
    sourceDb: string;
    totalEpisodes: number;
    coverArt?: string;
  };
  episodes: Array<{
    id: string;
    season: number;
    episode: number;
    titleEn: string;
    filePath: string;
    missing: boolean;
  }>;
  filesOnDisk: number;
}

export type AppRPC = {
  bun: RPCSchema<{
    requests: {
      getWindowState: {
        params: Record<string, never>;
        response: { x: number; y: number; width: number; height: number } | null;
      };
      writeOnboardingConfig: {
        params: {
          primaryDb: string;
          apiKey: string;
          templatePreset: string;
          templateCustom?: string;
        };
        response: { success: boolean; error?: string };
      };
      checkOnboarding: {
        params: Record<string, never>;
        response: { needsOnboarding: boolean };
      };
      getLibrary: {
        params: Record<string, never>;
        response: Array<{
          id: string;
          titleEn: string;
          entryType: string;
          episodeCount: number;
          filesOnDisk: number;
          coverArt?: string;
        }>;
      };
      getLibraryStats: {
        params: Record<string, never>;
        response: { animeCount: number; episodeCount: number };
      };
      getAnimeDetail: {
        params: { id: string };
        response: {
          anime: {
            id: string;
            titleEn: string;
            titleJa?: string;
            entryType: string;
            sourceDb: string;
            totalEpisodes: number;
            coverArt?: string;
          };
          episodes: Array<{
            id: string;
            season: number;
            episode: number;
            titleEn: string;
            filePath: string;
            missing: boolean;
          }>;
          filesOnDisk: number;
        } | null;
      };
      scanStart: {
        params: { path: string };
        response: { sessionId: string };
      };
      resolveMatch: {
        params: {
          sessionId: string;
          fileId: string;
          animeId: string;
          episodeId: string;
        };
        response: undefined;
      };
      getResolveCandidates: {
        params: {
          sessionId: string;
          fileId: string;
        };
        response: {
          candidates: Array<{
            animeId: string;
            animeTitle: string;
            entryType: string;
            episodeId: string;
            episodeNumber: number;
            season: number;
            score: number;
          }>;
        };
      };
      approvePlan: {
        params: { sessionId: string };
        response: undefined;
      };
      rejectPlan: {
        params: { sessionId: string };
        response: undefined;
      };
      approveGroup: {
        params: { sessionId: string; animeId: string };
        response: undefined;
      };
      rejectGroup: {
        params: { sessionId: string; animeId: string };
        response: undefined;
      };
      cancelScan: {
        params: { sessionId: string };
        response: undefined;
      };
      swapFiles: {
        params: { sessionId: string; fileAId: string; fileBId: string };
        response: undefined;
      };
      getSettingsData: {
        params: Record<string, never>;
        response: {
          primaryDb: string;
          secondaryDbs: string[];
          templatePreset: string;
          templateCustom: string;
          directoryTemplate: string;
          mediaExtensions: string[];
          excludePatterns: string[];
          scanConcurrency: number;
          fetchConcurrency: number;
          episodeNumbering: string;
          renameAction: string;
          subtitleLanguage: string;
          apiKeys: Record<string, string>;
          plugins: Array<{
            name: string;
            type: "database" | "subtitle";
            source: "built-in" | "external";
            enabled: boolean;
          }>;
        };
      };
      updateSettings: {
        params: {
          primaryDb?: string;
          secondaryDbs?: string[];
          templatePreset?: string;
          templateCustom?: string;
          directoryTemplate?: string;
          mediaExtensions?: string[];
          excludePatterns?: string[];
          scanConcurrency?: number;
          fetchConcurrency?: number;
          episodeNumbering?: string;
          renameAction?: string;
          subtitleLanguage?: string;
        };
        response: { success: boolean; error?: string };
      };
      updateApiKey: {
        params: { plugin: string; apiKey: string };
        response: { success: boolean; error?: string };
      };
      togglePlugin: {
        params: { plugin: string; enabled: boolean };
        response: { success: boolean; error?: string };
      };
      enrichArtwork: {
        params: { id: string };
        response: {
          success: boolean;
          summary?: { total: number; downloaded: number; skipped: number; noArtwork: number };
          error?: string;
        };
      };
      enrichMetadata: {
        params: { id: string };
        response: {
          success: boolean;
          summary?: { total: number; written: number; skipped: number; failed: number };
          error?: string;
        };
      };
      getThemeMode: {
        params: Record<string, never>;
        response: { mode: "light" | "dark" } | null;
      };
      setThemeMode: {
        params: { mode: "light" | "dark" };
        response: { success: boolean };
      };
      getWatchStatusByAnime: {
        params: { animeId: string };
        response: Array<{
          episodeId: string;
          watched: boolean;
          notes?: string;
          updatedAt: string;
        }>;
      };
      setWatchStatus: {
        params: { episodeId: string; watched: boolean; notes?: string };
        response: { success: boolean };
      };
      openDirectoryPicker: {
        params: Record<string, never>;
        response: { path: string } | null;
      };
      rebuildLibrary: {
        params: Record<string, never>;
        response: { success: boolean; error?: string };
      };
      getWatchedFolders: {
        params: Record<string, never>;
        response: Array<{
          path: string;
          addedAt: string;
          lastScannedAt?: string;
          exists: boolean;
        }>;
      };
      addWatchedFolder: {
        params: { path: string };
        response: { success: boolean };
      };
      removeWatchedFolder: {
        params: { path: string };
        response: { success: boolean };
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
