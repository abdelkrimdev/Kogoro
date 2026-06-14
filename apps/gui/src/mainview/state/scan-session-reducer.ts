import type { ReviewPlan, ScanFileStatus } from "@kogoro/core";
import {
  addScanProgressEvent,
  createScanProgressState,
  type ScanProgressState,
} from "./scan-progress-state";
import { deriveScanSummaries, mergeReviewPlans, type ScanSummaryEntry } from "./scan-state";

export interface ScanSessionSnapshot {
  sessionId: string | null;
  plan: ReviewPlan | null;
  statusText: string;
  isScanning: boolean;
  isExecuting: boolean;
  scanProgressState: ScanProgressState | null;
  isBatchScanning: boolean;
  currentScanFolder: string | null;
  batchFolderProgress: { current: number; total: number } | null;
  perFolderPlans: Map<string, ReviewPlan>;
  scanSummaries: ScanSummaryEntry[];
  showSummary: boolean;
}

export function createInitialSnapshot(): ScanSessionSnapshot {
  return {
    sessionId: null,
    plan: null,
    statusText: "Ready",
    isScanning: false,
    isExecuting: false,
    scanProgressState: null,
    isBatchScanning: false,
    currentScanFolder: null,
    batchFolderProgress: null,
    perFolderPlans: new Map(),
    scanSummaries: [],
    showSummary: false,
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
    case "enrichmentComplete": {
      const event = data as {
        command: string;
        success: boolean;
        error?: string;
      };
      const label = event.command === "artwork" ? "Cover art" : "Metadata";
      if (event.success) {
        return { ...state, statusText: `Complete: ${label.toLowerCase()}` };
      }
      return { ...state, statusText: `Complete: ${label.toLowerCase()} failed` };
    }
    default:
      return state;
  }
}

export function reduceOnViewResults(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    scanProgressState: null,
    statusText: "Review ready",
    showSummary: false,
    scanSummaries: [],
    currentScanFolder: null,
    batchFolderProgress: null,
  };
}

export function reduceOnDismissSummary(state: ScanSessionSnapshot): ScanSessionSnapshot {
  return {
    ...state,
    showSummary: false,
    scanSummaries: [],
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
    isBatchScanning: false,
    currentScanFolder: null,
    batchFolderProgress: null,
    perFolderPlans: new Map(),
    scanSummaries: [],
    showSummary: false,
  };
}

export function reduceOnBatchScanStarted(
  state: ScanSessionSnapshot,
  folderCount: number,
): ScanSessionSnapshot {
  return {
    ...state,
    isBatchScanning: true,
    batchFolderProgress: { current: 0, total: folderCount },
    perFolderPlans: new Map(),
    scanSummaries: [],
    showSummary: false,
    plan: null,
    sessionId: null,
    statusText: "Ready",
  };
}

export function reduceOnBatchFolderStarted(
  state: ScanSessionSnapshot,
  _folderPath: string,
  folderBasename: string,
): ScanSessionSnapshot {
  const prev = state.batchFolderProgress ?? { current: 0, total: 0 };
  return {
    ...state,
    currentScanFolder: folderBasename,
    batchFolderProgress: { ...prev, current: prev.current + 1 },
    scanProgressState: createScanProgressState(),
  };
}

export function reduceOnBatchFolderComplete(
  state: ScanSessionSnapshot,
  folderPath: string,
  plan: ReviewPlan,
): ScanSessionSnapshot {
  const plans = new Map(state.perFolderPlans);
  plans.set(folderPath, plan);
  return {
    ...state,
    perFolderPlans: plans,
    scanProgressState: null,
  };
}

export function reduceOnBatchScanComplete(
  state: ScanSessionSnapshot,
  folders: { path: string; basename: string }[],
): ScanSessionSnapshot {
  const summaries = deriveScanSummaries(state.perFolderPlans, folders);
  const plans = [...state.perFolderPlans.values()];
  const merged = plans.length > 0 ? mergeReviewPlans(plans) : null;
  return {
    ...state,
    isBatchScanning: false,
    isScanning: false,
    currentScanFolder: null,
    batchFolderProgress: null,
    scanSummaries: summaries,
    showSummary: true,
    plan: merged,
    sessionId: merged?.sessionId ?? null,
  };
}
