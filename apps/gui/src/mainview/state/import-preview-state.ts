import type { ImportPreview, ImportResult, ImportSelection } from "@kogoro/core/tracker-import";
import type { RPCClient } from "../shared";

export type MatchStatus = "matched" | "unmatched" | "conflict";

export interface PreviewEntry {
  trackerId: string;
  title: string;
  entryType: string;
  watchStatus: string;
  episodesWatched: number;
  totalEpisodes: number;
  matchStatus: MatchStatus;
  existingAnimeId?: number;
  existingGroupId?: number;
  localWatchStatus?: string;
}

export interface PreviewSummary {
  totalEntries: number;
  statusCounts: Record<string, number>;
  matchedCount: number;
  unmatchedCount: number;
  conflictCount: number;
}

export interface LinkSelection {
  trackerId: string;
  groupId: number;
}

export interface ConflictSelection {
  trackerId: string;
  resolution: "keepLocal" | "acceptTracker";
}

export interface ImportPreviewState {
  loading: boolean;
  error: string | null;
  preview: PreviewSummary | null;
  matched: PreviewEntry[];
  unmatched: PreviewEntry[];
  conflicts: PreviewEntry[];
  linkSelections: Map<string, number>;
  conflictSelections: Map<string, "keepLocal" | "acceptTracker">;
  importing: boolean;
  result: ImportResult | null;
  loadPreview: (trackerName: string) => Promise<void>;
  linkEntry: (trackerId: string, groupId: number) => void;
  resolveConflict: (trackerId: string, resolution: "keepLocal" | "acceptTracker") => void;
  confirmImport: (trackerName: string) => Promise<void>;
  reset: () => void;
}

function mapPreviewEntry(entry: {
  trackerId: string;
  title: string;
  entryType: string;
  watchStatus: string;
  episodesWatched: number;
  totalEpisodes: number;
  matchStatus: string;
  existingAnimeId?: number;
  existingGroupId?: number;
  localWatchStatus?: string;
}): PreviewEntry {
  return {
    trackerId: entry.trackerId,
    title: entry.title,
    entryType: entry.entryType,
    watchStatus: entry.watchStatus,
    episodesWatched: entry.episodesWatched,
    totalEpisodes: entry.totalEpisodes,
    matchStatus: entry.matchStatus as MatchStatus,
    existingAnimeId: entry.existingAnimeId,
    existingGroupId: entry.existingGroupId,
    localWatchStatus: entry.localWatchStatus,
  };
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
  linkSelections: Map<string, number>,
  conflictSelections: Map<string, "keepLocal" | "acceptTracker">,
): ImportSelection[] {
  const selections: ImportSelection[] = [];
  const allIds = new Set([...linkSelections.keys(), ...conflictSelections.keys()]);

  for (const trackerId of allIds) {
    const selection: ImportSelection = { trackerId };
    const groupId = linkSelections.get(trackerId);
    if (groupId !== undefined) {
      selection.groupId = groupId;
    }
    const resolution = conflictSelections.get(trackerId);
    if (resolution) {
      selection.resolution = resolution;
    }
    selections.push(selection);
  }

  return selections;
}

export function createImportPreviewState(rpc: RPCClient): ImportPreviewState {
  let _loading = false;
  let _error: string | null = null;
  let _preview: PreviewSummary | null = null;
  let _matched: PreviewEntry[] = [];
  let _unmatched: PreviewEntry[] = [];
  let _conflicts: PreviewEntry[] = [];
  let _linkSelections = new Map<string, number>();
  let _conflictSelections = new Map<string, "keepLocal" | "acceptTracker">();
  let _importing = false;
  let _result: ImportResult | null = null;

  const state: ImportPreviewState = {
    get loading() {
      return _loading;
    },
    get error() {
      return _error;
    },
    get preview() {
      return _preview;
    },
    get matched() {
      return _matched;
    },
    get unmatched() {
      return _unmatched;
    },
    get conflicts() {
      return _conflicts;
    },
    get linkSelections() {
      return _linkSelections;
    },
    get conflictSelections() {
      return _conflictSelections;
    },
    get importing() {
      return _importing;
    },
    get result() {
      return _result;
    },

    async loadPreview(trackerName: string) {
      _loading = true;
      _error = null;
      _result = null;
      try {
        const response = (await rpc.request("getImportPreview", {
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
        _matched = response.preview.matched.map(mapPreviewEntry);
        _unmatched = response.preview.unmatched.map(mapPreviewEntry);
        _conflicts = response.preview.conflicts.map(mapPreviewEntry);
        _linkSelections = new Map();
        _conflictSelections = new Map();
      } catch (err) {
        _error = err instanceof Error ? err.message : String(err);
      } finally {
        _loading = false;
      }
    },

    linkEntry(trackerId: string, groupId: number) {
      _linkSelections = new Map(_linkSelections);
      _linkSelections.set(trackerId, groupId);
    },

    resolveConflict(trackerId: string, resolution: "keepLocal" | "acceptTracker") {
      _conflictSelections = new Map(_conflictSelections);
      _conflictSelections.set(trackerId, resolution);
    },

    async confirmImport(trackerName: string) {
      _importing = true;
      _error = null;
      try {
        const selections = buildSelections(_linkSelections, _conflictSelections);
        const response = (await rpc.request("confirmImport", {
          trackerName,
          selections: selections.length > 0 ? selections : undefined,
        })) as { result: ImportResult | null; error?: string };

        if (response.error) {
          _error = response.error;
          return;
        }

        _result = response.result;
      } catch (err) {
        _error = err instanceof Error ? err.message : String(err);
      } finally {
        _importing = false;
      }
    },

    reset() {
      _loading = false;
      _error = null;
      _preview = null;
      _matched = [];
      _unmatched = [];
      _conflicts = [];
      _linkSelections = new Map();
      _conflictSelections = new Map();
      _importing = false;
      _result = null;
    },
  };

  return state;
}
