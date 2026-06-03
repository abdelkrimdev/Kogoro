import type { ScanFileStatus } from "@kogoro/core";

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

const STATUS_COLORS: Partial<Record<ScanFileStatus, string>> = {
  matched: "preset-tonal-success",
  cached: "preset-tonal-success",
  ambiguous: "preset-tonal-warning",
  failed: "preset-tonal-error",
  skipped: "preset-tonal-surface",
  pending: "preset-tonal-surface",
};

export function getStatusColor(status: ScanFileStatus): string {
  return STATUS_COLORS[status] ?? "preset-tonal-surface";
}
