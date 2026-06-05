import { join } from "node:path";
import type { WatchedFolder } from "../shared/types";
import { readJsonFile, stateDir, writeJsonFile } from "./state";

function watchedFoldersPath() {
  return join(stateDir(), ".watched-folders.json");
}

export function loadWatchedFolders(): WatchedFolder[] {
  const data = readJsonFile<unknown>(watchedFoldersPath(), []);
  if (!Array.isArray(data)) return [];
  return data;
}

function saveWatchedFolders(folders: WatchedFolder[]) {
  writeJsonFile(watchedFoldersPath(), folders);
}

export function addWatchedFolder(path: string): WatchedFolder {
  const folders = loadWatchedFolders();
  const found = folders.find((f) => f.path === path);
  if (found) return found;

  const entry: WatchedFolder = { path, addedAt: new Date().toISOString() };
  folders.push(entry);
  saveWatchedFolders(folders);
  return entry;
}

export function removeWatchedFolder(path: string) {
  const folders = loadWatchedFolders();
  const filtered = folders.filter((f) => f.path !== path);
  saveWatchedFolders(filtered);
}

export function markWatchedFolderScanned(path: string): WatchedFolder | null {
  const folders = loadWatchedFolders();
  const entry = folders.find((f) => f.path === path);
  if (!entry) return null;
  entry.lastScannedAt = new Date().toISOString();
  saveWatchedFolders(folders);
  return entry;
}
