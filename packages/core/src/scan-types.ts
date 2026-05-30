export type ScanFileStatus =
  | "matched"
  | "cached"
  | "skipped"
  | "ambiguous"
  | "failed"
  | "pending"
  | "renamed"
  | "rename-failed";

export interface FileRow {
  fileId: string;
  sourcePath: string;
  proposedPath: string | null;
  status: ScanFileStatus;
  animeId: string | null;
  episodeId: string | null;
  episode: number | null;
  failureReason?: string;
}

export interface AnimeGroup {
  animeId: string;
  animeTitle: string;
  entryType: string;
  image?: string;
  files: FileRow[];
  swapPairs: SwapPair[];
}

export interface SwapPair {
  fileAId: string;
  fileBId: string;
}

export interface ReviewPlan {
  sessionId: string;
  groups: AnimeGroup[];
  totalFiles: number;
  ambiguousCount: number;
}

export interface ScanSummary {
  sessionId: string;
  totalFiles: number;
  matched: number;
  cached: number;
  ambiguous: number;
  failed: number;
  renamed: number;
  renameFailed: number;
}
