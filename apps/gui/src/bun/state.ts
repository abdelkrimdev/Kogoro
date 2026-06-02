import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type WindowFrame = { x: number; y: number; width: number; height: number };
export type ThemeMode = "light" | "dark";

const DEFAULT_BASE = join(import.meta.dir, "../..");

function statePath(base: string) {
  return join(base, ".window-state.json");
}

function themePath(base: string) {
  return join(base, ".theme-state.json");
}

export function loadWindowState(base: string = DEFAULT_BASE): WindowFrame | null {
  try {
    const file = statePath(base);
    if (existsSync(file)) {
      return JSON.parse(readFileSync(file, "utf-8"));
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

export function saveWindowState(state: WindowFrame, base: string = DEFAULT_BASE) {
  try {
    writeFileSync(statePath(base), JSON.stringify(state, null, 2));
  } catch {
    // ignore write errors
  }
}

export function loadThemeMode(base: string = DEFAULT_BASE): ThemeMode | null {
  try {
    const file = themePath(base);
    if (existsSync(file)) {
      const data = JSON.parse(readFileSync(file, "utf-8"));
      if (data.mode === "light" || data.mode === "dark") return data.mode;
    }
  } catch {
    // ignore corrupt state
  }
  return null;
}

export function saveThemeMode(mode: ThemeMode, base: string = DEFAULT_BASE) {
  try {
    writeFileSync(themePath(base), JSON.stringify({ mode }, null, 2));
  } catch {
    // ignore write errors
  }
}
