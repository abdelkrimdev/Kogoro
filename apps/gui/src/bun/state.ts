import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThemeMode, WatchedFolder } from "../shared/types";

export type WindowFrame = { x: number; y: number; width: number; height: number };

function stateDir(): string {
  return process.env["KOGORO_STATE_DIR"] ?? join(import.meta.dir, "../..");
}

function statePath() {
  return join(stateDir(), ".window-state.json");
}

function themePath() {
  return join(stateDir(), ".theme-state.json");
}

export function loadWindowState(): WindowFrame | null {
  try {
    const file = statePath();
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

export function saveWindowState(state: WindowFrame) {
  try {
    writeFileSync(statePath(), JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

export function loadThemeMode(): ThemeMode | null {
  try {
    const file = themePath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (data.mode === "light" || data.mode === "dark") return data.mode;
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

export function saveThemeMode(mode: ThemeMode) {
  try {
    writeFileSync(themePath(), JSON.stringify({ mode }, null, 2));
  } catch {
    // ignore write errors
  }
}

type WatchedFolderStored = Omit<WatchedFolder, "exists">;

function watchedFoldersPath() {
  return join(stateDir(), ".watched-folders.json");
}

export function loadWatchedFolders(): WatchedFolder[] {
  try {
    const file = watchedFoldersPath();
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (!Array.isArray(data)) return [];
      return data
        .filter(
          (f: unknown): f is WatchedFolderStored =>
            typeof f === "object" && f !== null && "path" in f && "addedAt" in f,
        )
        .map((f) => ({ ...f, exists: existsSync(f.path) }));
    }
  } catch {
    // ignore corrupt state
  }
  return [];
}

export function saveWatchedFolders(folders: WatchedFolder[]) {
  try {
    const stored = folders.map(({ exists: _, ...rest }) => rest);
    writeFileSync(watchedFoldersPath(), JSON.stringify(stored, null, 2));
  } catch {
    // ignore write errors
  }
}
