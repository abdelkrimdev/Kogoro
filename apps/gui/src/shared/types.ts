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
    };
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
    };
  }>;
  webview: RPCSchema<{
    requests: {
      getLibrary: {
        params: Record<string, never>;
        response: Array<{
          id: string;
          titleEn: string;
          entryType: string;
          image?: string;
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
            image?: string;
          };
          episodes: Array<{
            id: string;
            season: number;
            episode: number;
            titleEn: string;
          }>;
        } | null;
      };
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
