import type { ReviewPlan, ScanFileStatus } from "@kogoro/core";
import {
  addScanProgressEvent,
  createScanProgressState,
  type ScanProgressState,
} from "./scan-progress-state";

export interface ScanSessionSnapshot {
  sessionId: string | null;
  plan: ReviewPlan | null;
  statusText: string;
  isScanning: boolean;
  isExecuting: boolean;
  scanProgressState: ScanProgressState | null;
}

export function createInitialSnapshot(): ScanSessionSnapshot {
  return {
    sessionId: null,
    plan: null,
    statusText: "Ready",
    isScanning: false,
    isExecuting: false,
    scanProgressState: null,
  };
}

export function reduceMessage(
  state: ScanSessionSnapshot,
  message: string,
  data: unknown,
): ScanSessionSnapshot {
  switch (message) {
    case "scanProgress": {
      const event = data as {
        completed: number;
        total: number;
        file: string;
        status: string;
      };
      const progress = state.scanProgressState ?? createScanProgressState();
      addScanProgressEvent(progress, {
        file: event.file,
        status: event.status as ScanFileStatus,
        completed: event.completed,
        total: event.total,
      });
      return {
        ...state,
        statusText: `Scanning: ${event.completed}/${event.total} - ${event.status}`,
        isScanning: true,
        scanProgressState: progress,
      };
    }
    case "scanPhaseComplete": {
      const event = data as { phase: string; summary: { totalFiles: number } };
      return {
        ...state,
        statusText: `Phase complete: ${event.phase}`,
      };
    }
    case "scanReviewReady": {
      const event = data as { sessionId: string; plan: ReviewPlan };
      return {
        ...state,
        sessionId: event.sessionId,
        plan: event.plan,
        isScanning: false,
        statusText: "Scan complete — review results",
      };
    }
    case "scanExecutionProgress": {
      const event = data as {
        completed: number;
        total: number;
        file: string;
        status: string;
      };
      const fileName = event.file.split("/").pop() ?? event.file;
      return {
        ...state,
        statusText: `Executing: ${event.completed}/${event.total} - ${fileName} - ${event.status}`,
        isExecuting: true,
      };
    }
    case "scanComplete": {
      const event = data as {
        summary: {
          renamed: number;
          renameFailed: number;
          renameFailures: Array<{ file: string; reason: string }>;
        };
      };
      let text = `Complete: ${event.summary.renamed} renamed, ${event.summary.renameFailed} failed`;
      if (event.summary.renameFailures.length > 0) {
        const reasons = [...new Set(event.summary.renameFailures.map((f) => f.reason))].join(", ");
        text += ` (${reasons})`;
      }
      return {
        ...state,
        statusText: text,
      };
    }
    case "enrichmentProgress": {
      const event = data as {
        command: string;
        completed: number;
        total: number;
        status: string;
      };
      const label = event.command === "artwork" ? "Cover art" : "Metadata";
      return {
        ...state,
        statusText: `${label}: ${event.completed}/${event.total} - ${event.status}`,
      };
    }
    default:
      return state;
  }
}

export function reduceOnScanStarted(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    scanProgressState: createScanProgressState(),
  };
}

export function reduceOnViewResults(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    scanProgressState: null,
    statusText: "Review ready",
  };
}

export function reduceClearAfterReview(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    sessionId: null,
    plan: null,
  };
}

export function reduceClearAfterComplete(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    sessionId: null,
    plan: null,
    isScanning: false,
    isExecuting: false,
    scanProgressState: null,
  };
}
