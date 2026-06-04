import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ThemeMode } from "../shared/types";

export type WindowFrame = { x: number; y: number; width: number; height: number };

export function stateDir(): string {
  return process.env["KOGORO_STATE_DIR"] ?? join(import.meta.dir, "../..");
}

export function readJsonFile<T>(file: string, defaultValue: T): T {
  try {
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return defaultValue;
}

export function writeJsonFile<T>(file: string, data: T) {
  try {
    writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {
    // ignore write errors
  }
}

export function loadWindowState(): WindowFrame | null {
  return readJsonFile<WindowFrame | null>(join(stateDir(), ".window-state.json"), null);
}

export function saveWindowState(state: WindowFrame) {
  writeJsonFile(join(stateDir(), ".window-state.json"), state);
}

export function loadThemeMode(): ThemeMode | null {
  const data = readJsonFile<{ mode?: string } | null>(join(stateDir(), ".theme-state.json"), null);
  if (data?.mode === "light" || data?.mode === "dark") return data.mode;
  return null;
}

export function saveThemeMode(mode: ThemeMode) {
  writeJsonFile(join(stateDir(), ".theme-state.json"), { mode });
}

export function loadSidebarCollapsed(): boolean {
  const data = readJsonFile<{ collapsed?: boolean } | null>(
    join(stateDir(), ".sidebar-state.json"),
    null,
  );
  return data?.collapsed ?? false;
}

export function saveSidebarCollapsed(collapsed: boolean) {
  writeJsonFile(join(stateDir(), ".sidebar-state.json"), { collapsed });
}
