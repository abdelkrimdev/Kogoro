import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface WatchedFolder {
  path: string;
  addedAt: string;
  lastScannedAt?: string;
}

function stateDir(): string {
  return process.env["KOGORO_STATE_DIR"] ?? join(import.meta.dir, "../..");
}

function watchedFoldersPath() {
  return join(stateDir(), ".watched-folders.json");
}

export function loadWatchedFolders(): WatchedFolder[] {
  try {
    const file = watchedFoldersPath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (Array.isArray(data)) return data;
    }
  } catch {}
  return [];
}

function saveWatchedFolders(folders: WatchedFolder[]) {
  try {
    writeFileSync(watchedFoldersPath(), JSON.stringify(folders, null, 2));
  } catch {}
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
