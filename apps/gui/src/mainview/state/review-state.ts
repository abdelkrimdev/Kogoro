import type { AnimeGroup, FileRow, ReviewPlan } from "@kogoro/core";

export type { AnimeGroup, FileRow, ReviewPlan };

export type StatusFilter = "all" | "matched" | "ambiguous" | "needs-attention";

export interface ReviewState {
  plan: ReviewPlan;
  searchQuery: string;
  statusFilter: StatusFilter;
}

function matchesSearch(file: FileRow, animeTitle: string, query: string): boolean {
  const q = query.toLowerCase();
  return (
    file.sourcePath.toLowerCase().includes(q) ||
    (file.proposedPath?.toLowerCase().includes(q) ?? false) ||
    animeTitle.toLowerCase().includes(q)
  );
}

function matchesStatus(file: FileRow, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs-attention") return file.status === "ambiguous" || file.status === "failed";
  return file.status === filter;
}

export function filterReviewGroups(state: ReviewState): AnimeGroup[] {
  const { plan, searchQuery, statusFilter } = state;

  return plan.groups
    .map((group) => {
      const filteredFiles = group.files.filter(
        (file) =>
          (!searchQuery || matchesSearch(file, group.animeTitle, searchQuery)) &&
          matchesStatus(file, statusFilter),
      );
      return { ...group, files: filteredFiles };
    })
    .filter((group) => group.files.length > 0);
}

export interface ReviewStats {
  totalFiles: number;
  totalGroups: number;
  matchedCount: number;
  ambiguousCount: number;
  failedCount: number;
  swapsCount: number;
}

export function findSwapPairForFile(group: AnimeGroup, fileId: string): string | null {
  for (const pair of group.swapPairs) {
    if (pair.fileAId === fileId) return pair.fileBId;
    if (pair.fileBId === fileId) return pair.fileAId;
  }
  return null;
}

export function deriveReviewStats(plan: ReviewPlan): ReviewStats {
  let matchedCount = 0;
  let ambiguousCount = 0;
  let failedCount = 0;
  let swapsCount = 0;

  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.status === "matched" || file.status === "cached") matchedCount++;
      else if (file.status === "ambiguous") ambiguousCount++;
      else if (file.status === "failed") failedCount++;
    }
    if (group.swapPairs.length > 0) swapsCount++;
  }

  return {
    totalFiles: plan.totalFiles,
    totalGroups: plan.groups.length,
    matchedCount,
    ambiguousCount,
    failedCount,
    swapsCount,
  };
}
