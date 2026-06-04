import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function watchedFoldersPath(): string {
  const dir = process.env["KOGORO_STATE_DIR"] ?? join(import.meta.dir, "../..");
  return join(dir, ".watched-folders.json");
}

export interface RawWatchedFolder {
  path: string;
  addedAt: string;
  lastScannedAt?: string;
}

export function loadWatchedFolders(): RawWatchedFolder[] {
  try {
    const file = watchedFoldersPath();
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return [];
}

export function saveWatchedFolders(folders: RawWatchedFolder[]) {
  try {
    writeFileSync(watchedFoldersPath(), JSON.stringify(folders, null, 2));
  } catch {
    // ignore write errors
  }
}
