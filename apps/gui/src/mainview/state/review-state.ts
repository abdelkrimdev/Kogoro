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
  ambiguousCount: number;
  issuesCount: number;
  swapsCount: number;
}

export function deriveReviewStats(plan: ReviewPlan): ReviewStats {
  let ambiguousCount = 0;
  let issuesCount = 0;
  let swapsCount = 0;

  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.status === "ambiguous") ambiguousCount++;
      if (file.status === "ambiguous" || file.status === "failed") issuesCount++;
    }
    if (group.swapPairs.length > 0) swapsCount++;
  }

  return {
    totalFiles: plan.totalFiles,
    totalGroups: plan.groups.length,
    ambiguousCount,
    issuesCount,
    swapsCount,
  };
}
