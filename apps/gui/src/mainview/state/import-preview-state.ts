import type {
  ImportPreview,
  ImportPreviewEntry,
  ImportResult,
  ImportSelection,
} from "@kogoro/core";
import type { RPCClient } from "../shared";

export type { MatchStatus } from "@kogoro/core";
export type TabId = "matched" | "new" | "conflicts";
export type ImportPhase = "preview" | "importing" | "success" | "error";

export interface PreviewSummary {
  totalEntries: number;
  statusCounts: Record<string, number>;
  matchedCount: number;
  unmatchedCount: number;
  conflictCount: number;
}

export type BulkMode = "keepLocal" | "acceptTracker" | null;

export interface ImportSnapshot {
  loading: boolean;
  error: string | null;
  preview: PreviewSummary | null;
  matched: ImportPreviewEntry[];
  unmatched: ImportPreviewEntry[];
  conflicts: ImportPreviewEntry[];
  activeTab: TabId;
  importPhase: ImportPhase;
  conflictSelections: Map<string, "keepLocal" | "acceptTracker">;
  bulkMode: BulkMode;
  result: ImportResult | null;
}

export interface ImportPreviewState {
  loadPreview: (trackerName: string) => Promise<void>;
  setActiveTab: (tab: TabId) => void;
  resolveConflict: (trackerId: string, resolution: "keepLocal" | "acceptTracker") => void;
  bulkResolveConflicts: (resolution: "keepLocal" | "acceptTracker") => void;
  confirmImport: (trackerName: string) => Promise<void>;
  reset: () => void;
  snapshot: () => ImportSnapshot;
  onChange: (listener: (snapshot: ImportSnapshot) => void) => () => void;
}

function buildSummary(preview: ImportPreview): PreviewSummary {
  return {
    totalEntries: preview.totalEntries,
    statusCounts: preview.statusCounts,
    matchedCount: preview.matched.length,
    unmatchedCount: preview.unmatched.length,
    conflictCount: preview.conflicts.length,
  };
}

function buildSelections(
  conflictSelections: Map<string, "keepLocal" | "acceptTracker">,
  unmatched: ImportPreviewEntry[],
): ImportSelection[] {
  const selections: ImportSelection[] = [];

  for (const [trackerId, resolution] of conflictSelections) {
    selections.push({ trackerId, resolution });
  }

  for (const entry of unmatched) {
    if (!conflictSelections.has(entry.trackerId)) {
      selections.push({
        trackerId: entry.trackerId,
      });
    }
  }

  return selections;
}

function getDefaultTab(preview: PreviewSummary): TabId {
  if (preview.conflictCount > 0) return "conflicts";
  if (preview.unmatchedCount > 0) return "new";
  return "matched";
}

export function createImportPreviewState(getRpc: () => RPCClient): ImportPreviewState {
  let _loading = false;
  let _error: string | null = null;
  let _preview: PreviewSummary | null = null;
  let _matched: ImportPreviewEntry[] = [];
  let _unmatched: ImportPreviewEntry[] = [];
  let _conflicts: ImportPreviewEntry[] = [];
  let _activeTab: TabId = "matched";
  let _importPhase: ImportPhase = "preview";
  let _conflictSelections = new Map<string, "keepLocal" | "acceptTracker">();
  let _bulkMode: BulkMode = null;
  let _result: ImportResult | null = null;

  const listeners = new Set<(s: ImportSnapshot) => void>();

  function notify() {
    const snap = computeSnapshot();
    for (const listener of listeners) {
      listener(snap);
    }
  }

  function computeSnapshot(): ImportSnapshot {
    return {
      loading: _loading,
      error: _error,
      preview: _preview,
      matched: _matched,
      unmatched: _unmatched,
      conflicts: _conflicts,
      activeTab: _activeTab,
      importPhase: _importPhase,
      conflictSelections: new Map(_conflictSelections),
      bulkMode: _bulkMode,
      result: _result,
    };
  }

  const state: ImportPreviewState = {
    snapshot: computeSnapshot,

    onChange(listener: (s: ImportSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async loadPreview(trackerName: string) {
      _loading = true;
      _error = null;
      _result = null;
      _importPhase = "preview";
      notify();
      try {
        const response = (await getRpc().request("getImportPreview", {
          trackerName,
        })) as { preview: ImportPreview | null; error?: string };

        if (response.error) {
          _error = response.error;
          return;
        }

        if (!response.preview) {
          _error = "No preview data received";
          return;
        }

        _preview = buildSummary(response.preview);
        _matched = response.preview.matched;
        _unmatched = response.preview.unmatched;
        _conflicts = response.preview.conflicts;
        _conflictSelections = new Map();
        _bulkMode = null;
        _activeTab = getDefaultTab(_preview);
      } catch (err) {
        _error = err instanceof Error ? err.message : String(err);
      } finally {
        _loading = false;
        notify();
      }
    },

    setActiveTab(tab: TabId) {
      _activeTab = tab;
      notify();
    },

    resolveConflict(trackerId: string, resolution: "keepLocal" | "acceptTracker") {
      _conflictSelections = new Map(_conflictSelections);
      _conflictSelections.set(trackerId, resolution);
      notify();
    },

    bulkResolveConflicts(resolution: "keepLocal" | "acceptTracker") {
      if (_conflicts.length === 0) return;
      if (_bulkMode === resolution) {
        _conflictSelections = new Map();
        _bulkMode = null;
      } else {
        const newSelections = new Map<string, "keepLocal" | "acceptTracker">();
        for (const entry of _conflicts) {
          newSelections.set(entry.trackerId, resolution);
        }
        _conflictSelections = newSelections;
        _bulkMode = resolution;
      }
      notify();
    },

    async confirmImport(trackerName: string) {
      _importPhase = "importing";
      _error = null;
      notify();
      try {
        const selections = buildSelections(_conflictSelections, _unmatched);
        const response = (await getRpc().request("confirmImport", {
          trackerName,
          selections: selections.length > 0 ? selections : undefined,
        })) as { result: ImportResult | null; error?: string };

        if (response.error) {
          _error = response.error;
          _importPhase = "error";
          return;
        }

        _result = response.result;
        _importPhase = "success";
      } catch (err) {
        _error = err instanceof Error ? err.message : String(err);
        _importPhase = "error";
      } finally {
        notify();
      }
    },

    reset() {
      _loading = false;
      _error = null;
      _preview = null;
      _matched = [];
      _unmatched = [];
      _conflicts = [];
      _activeTab = "matched";
      _importPhase = "preview";
      _conflictSelections = new Map();
      _bulkMode = null;
      _result = null;
      notify();
    },
  };

  return state;
}
