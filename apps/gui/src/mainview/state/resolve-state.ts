import type { AnimeGroup, FileRow, ReviewPlan } from "@kogoro/core";

export interface ResolveCandidate {
  animeId: string;
  animeTitle: string;
  entryType: string;
  episodeId: string;
  episodeNumber: number;
  season: number;
  score: number;
}

export function findAmbiguousFiles(
  plan: ReviewPlan,
): Array<{ fileId: string; sourcePath: string; animeTitle: string }> {
  const results: Array<{ fileId: string; sourcePath: string; animeTitle: string }> = [];

  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.status === "ambiguous") {
        results.push({
          fileId: file.fileId,
          sourcePath: file.sourcePath,
          animeTitle: group.animeTitle,
        });
      }
    }
  }

  return results;
}

export function deriveResolveStats(plan: ReviewPlan): {
  ambiguousCount: number;
  resolvedCount: number;
} {
  let ambiguousCount = 0;
  let resolvedCount = 0;

  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.status === "ambiguous") ambiguousCount++;
      if (file.status === "matched" && file.animeId !== null) resolvedCount++;
    }
  }

  return { ambiguousCount, resolvedCount };
}

export function findFileInPlan(
  plan: ReviewPlan,
  fileId: string,
): { file: FileRow; group: AnimeGroup } | null {
  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.fileId === fileId) {
        return { file, group };
      }
    }
  }
  return null;
}

export function isResolveEnabled(plan: ReviewPlan, fileId: string): boolean {
  const result = findFileInPlan(plan, fileId);
  return result !== null && result.file.status === "ambiguous";
}
