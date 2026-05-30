import type { ReviewPlan, ScanFileStatus, ScanSummary } from "@kogoro/core";
import type { RPCSchema } from "electrobun";

export type { ReviewPlan, ScanFileStatus, ScanSummary } from "@kogoro/core";

export type ScanPhase = "scan" | "plan" | "review" | "execute";

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
          coverArt?: string;
        }>;
      };
      getAnimeDetail: {
        params: { id: string };
        response: {
          anime: {
            id: string;
            titleEn: string;
            titleJa?: string;
            entryType: string;
            coverArt?: string;
          };
          episodes: Array<{
            id: string;
            season: number;
            episode: number;
            titleEn: string;
          }>;
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
      approvePlan: {
        params: { sessionId: string };
        response: undefined;
      };
      rejectPlan: {
        params: { sessionId: string };
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
          secondaryDbs: string;
          templatePreset: string;
          templateCustom: string;
          directoryTemplate: string;
          mediaExtensions: string;
          excludePatterns: string;
          scanConcurrency: number;
          fetchConcurrency: number;
          episodeNumbering: string;
          renameAction: string;
          subtitleLanguage: string;
          apiKeys: Record<string, string>;
          plugins: Array<{
            name: string;
            type: "database" | "subtitle";
            source: "built-in";
            enabled: boolean;
          }>;
        };
      };
      updateSettings: {
        params: {
          primaryDb?: string;
          secondaryDbs?: string;
          templatePreset?: string;
          templateCustom?: string;
          directoryTemplate?: string;
          mediaExtensions?: string;
          excludePatterns?: string;
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
    };
    messages: {
      showOnboarding: Record<string, never>;
      showMainApp: Record<string, never>;
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
        phase: ScanPhase;
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
  webview: RPCSchema<{
    requests: {
      getConfig: {
        params: Record<string, never>;
        response: Record<string, unknown> | null;
      };
      updateConfig: {
        params: Record<string, unknown>;
        response: undefined;
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
};
