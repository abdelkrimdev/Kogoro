import type { ReviewGroup } from "../types";

export function swapFilesInGroup(groups: ReviewGroup[], fileAId: string, fileBId: string): boolean {
  let targetGroup: ReviewGroup | null = null;
  for (const group of groups) {
    const hasA = group.files.some((f) => f.fileId === fileAId);
    const hasB = group.files.some((f) => f.fileId === fileBId);
    if (hasA && hasB) {
      targetGroup = group;
      break;
    }
  }

  if (!targetGroup) {
    return false;
  }

  const fileA = targetGroup.files.find((f) => f.fileId === fileAId);
  const fileB = targetGroup.files.find((f) => f.fileId === fileBId);

  if (!fileA || !fileB) {
    return false;
  }

  const tempPath = fileA.proposedPath;
  fileA.proposedPath = fileB.proposedPath;
  fileB.proposedPath = tempPath;

  const tempEpisodeId = fileA.episodeId;
  fileA.episodeId = fileB.episodeId;
  fileB.episodeId = tempEpisodeId;

  const tempEpisode = fileA.episode;
  fileA.episode = fileB.episode;
  fileB.episode = tempEpisode;

  const existingIndex = targetGroup.swapPairs.findIndex(
    (p) =>
      (p.fileAId === fileAId && p.fileBId === fileBId) ||
      (p.fileAId === fileBId && p.fileBId === fileAId),
  );

  if (existingIndex >= 0) {
    targetGroup.swapPairs.splice(existingIndex, 1);
  } else {
    targetGroup.swapPairs.push({ fileAId, fileBId });
  }

  return true;
}
