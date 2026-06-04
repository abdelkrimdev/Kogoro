import { existsSync } from "node:fs";
import {
  addWatchedFolder,
  loadWatchedFolders,
  removeWatchedFolder,
  type WatchedFolder,
} from "./watched-folders";

export interface WatchedFolderResponse {
  path: string;
  addedAt: string;
  lastScannedAt?: string;
  exists: boolean;
}

export function getWatchedFoldersHandler(): WatchedFolderResponse[] {
  const folders = loadWatchedFolders();
  return folders.map((f: WatchedFolder) => ({
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
