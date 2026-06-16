import type { ReviewGroup } from "../types";

export function findFileSourcePath(groups: ReviewGroup[], fileId: string): string | null {
  for (const group of groups) {
    for (const file of group.files) {
      if (file.fileId === fileId) {
        return file.sourcePath;
      }
    }
  }
  return null;
}
