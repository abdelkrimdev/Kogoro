import type { AnimeGroup, ReviewPlan } from "@kogoro/core";

export type FolderStatus = "new" | "indexed" | "missing";
export type BatchScanFolderStatus = "pending" | "scanning" | "completed";

export interface EnrichedFolder {
  path: string;
  basename: string;
  addedAt: string;
  lastScannedAt?: string;
  exists: boolean;
  status: FolderStatus;
  relativeTimestamp?: string;
  selected: boolean;
  batchStatus?: BatchScanFolderStatus;
}

export function deriveFolderStatus(
  lastScannedAt: string | undefined,
  exists: boolean,
): FolderStatus {
  if (!exists) return "missing";
  if (!lastScannedAt) return "new";
  return "indexed";
}

export function deriveScanFolders(
  folders: { path: string; addedAt: string; lastScannedAt?: string; exists?: boolean }[],
): EnrichedFolder[] {
  return folders.map((f) => {
    const exists = f.exists ?? false;
    const status = deriveFolderStatus(f.lastScannedAt, exists);
    const basename = f.path === "/" ? "/" : (f.path.split("/").filter(Boolean).pop() ?? f.path);

    return {
      path: f.path,
      basename,
      addedAt: f.addedAt,
      lastScannedAt: f.lastScannedAt,
      exists,
      status,
      selected: false,
      ...(f.lastScannedAt ? { relativeTimestamp: relativeTimestamp(f.lastScannedAt) } : {}),
    };
  });
}

export function relativeTimestamp(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 1) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function toggleFolder(folders: EnrichedFolder[], path: string): EnrichedFolder[] {
  return folders.map((f) => (f.path === path && f.exists ? { ...f, selected: !f.selected } : f));
}

export function toggleAll(folders: EnrichedFolder[]): EnrichedFolder[] {
  const selectable = folders.filter((f) => f.exists);
  const allSelected = selectable.length > 0 && selectable.every((f) => f.selected);
  const newSelected = !allSelected;
  return folders.map((f) => (f.exists ? { ...f, selected: newSelected } : f));
}

export interface ScanToolbarState {
  allSelected: boolean;
  someSelected: boolean;
  noneSelected: boolean;
  selectableCount: number;
}

export interface BatchScanProgress {
  current: number;
  total: number;
  folderBasename: string;
}

export function deriveBatchProgress(
  folders: EnrichedFolder[],
  currentPath: string,
): BatchScanProgress {
  const selected = folders.filter((f) => f.selected && f.exists);
  const currentIndex = selected.findIndex((f) => f.path === currentPath);
  const current = currentIndex === -1 ? 0 : currentIndex + 1;
  return {
    current,
    total: selected.length,
    folderBasename: selected[currentIndex]?.basename ?? "",
  };
}

export function deriveScanToolbar(folders: EnrichedFolder[]): ScanToolbarState {
  const selectable = folders.filter((f) => f.exists);
  const selectedCount = selectable.filter((f) => f.selected).length;
  const selectableCount = selectable.length;
  return {
    allSelected: selectableCount > 0 && selectedCount === selectableCount,
    someSelected: selectedCount > 0 && selectedCount < selectableCount,
    noneSelected: selectableCount > 0 && selectedCount === 0,
    selectableCount,
  };
}

export interface ScanSummaryEntry {
  basename: string;
  fileCount: number;
  matchCount: number;
}

export function deriveScanSummaries(
  plans: Map<string, ReviewPlan>,
  folders: EnrichedFolder[],
): ScanSummaryEntry[] {
  const entries: ScanSummaryEntry[] = [];
  for (const f of folders) {
    const plan = plans.get(f.path);
    if (!plan) continue;
    const matchCount = plan.groups.reduce(
      (sum, g) =>
        sum +
        g.files.filter((file) => file.status === "matched" || file.status === "cached").length,
      0,
    );
    entries.push({ basename: f.basename, fileCount: plan.totalFiles, matchCount });
  }
  return entries;
}

export function mergeReviewPlans(plans: ReviewPlan[]): ReviewPlan {
  const groupMap = new Map<string, AnimeGroup>();

  for (const plan of plans) {
    for (const group of plan.groups) {
      const existing = groupMap.get(group.animeId);
      if (existing) {
        existing.files.push(...group.files);
      } else {
        groupMap.set(group.animeId, { ...group, files: [...group.files] });
      }
    }
  }

  const groups = Array.from(groupMap.values());
  return {
    sessionId: plans[plans.length - 1]?.sessionId ?? "merged",
    groups,
    totalFiles: groups.reduce((sum, g) => sum + g.files.length, 0),
    ambiguousCount: groups.reduce(
      (sum, g) => sum + g.files.filter((f) => f.status === "ambiguous").length,
      0,
    ),
  };
}
