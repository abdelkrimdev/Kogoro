import { existsSync } from "node:fs";
import {
  addWatchedFolder,
  loadWatchedFolders,
  markWatchedFolderScanned,
  removeWatchedFolder,
} from "./watched-folders";

export interface WatchedFolderResponse {
  path: string;
  addedAt: string;
  lastScannedAt?: string;
  exists: boolean;
}

export function getWatchedFoldersHandler(): WatchedFolderResponse[] {
  const folders = loadWatchedFolders();
  return folders.map((f) => ({
    ...f,
    exists: existsSync(f.path),
  }));
}

export function addWatchedFolderHandler(path: string): { success: boolean } {
  addWatchedFolder(path);
  return { success: true };
}

export function removeWatchedFolderHandler(path: string): { success: boolean } {
  removeWatchedFolder(path);
  return { success: true };
}

export function markWatchedFolderScannedHandler(path: string): {
  success: boolean;
  lastScannedAt?: string;
} {
  const entry = markWatchedFolderScanned(path);
  if (!entry) return { success: false };
  return { success: true, lastScannedAt: entry.lastScannedAt };
}
