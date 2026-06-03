import type { ScanFileStatus } from "@kogoro/core";
import { statusColorClass } from "../shared";

export interface ScanProgressEntry {
  file: string;
  status: ScanFileStatus;
}

export type ScanProgressPhase = "walk" | "scan";

export interface ScanProgressState {
  entries: ScanProgressEntry[];
  completed: number;
  total: number;
  phase: ScanProgressPhase;
}

export function createScanProgressState(): ScanProgressState {
  return {
    entries: [],
    completed: 0,
    total: 0,
    phase: "walk",
  };
}

export function addScanProgressEvent(
  state: ScanProgressState,
  event: ScanProgressEntry & { completed: number; total: number },
): void {
  state.entries.push({ file: event.file, status: event.status });
  state.completed = event.completed;
  state.total = event.total;
  state.phase = "scan";
}

export function deriveProgressPercent(state: ScanProgressState): number {
  if (state.phase === "walk" || state.total === 0) return 0;
  const pct = Math.round((state.completed / state.total) * 100);
  return Math.min(pct, 100);
}

export function isIndeterminate(state: ScanProgressState): boolean {
  return state.phase === "walk";
}

export function getStatusColor(status: ScanFileStatus): string {
  return statusColorClass(status);
}

export interface ScanBreakdown {
  matchedCount: number;
  ambiguousCount: number;
  failedCount: number;
}

export function deriveBreakdown(state: ScanProgressState): ScanBreakdown {
  let matchedCount = 0;
  let ambiguousCount = 0;
  let failedCount = 0;
  for (const entry of state.entries) {
    if (entry.status === "matched" || entry.status === "cached") {
      matchedCount++;
    } else if (entry.status === "ambiguous") {
      ambiguousCount++;
    } else if (entry.status === "failed") {
      failedCount++;
    }
  }
  return { matchedCount, ambiguousCount, failedCount };
}
