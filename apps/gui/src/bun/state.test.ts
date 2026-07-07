import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withKogoroEnv } from "@kogoro/core/testing";
import {
  loadSidebarCollapsed,
  loadThemeMode,
  loadWindowState,
  saveSidebarCollapsed,
  saveThemeMode,
  saveWindowState,
} from "./state";

const testDir = join(import.meta.dir, "__test_state__");

let cleanupKogoroEnv: () => void;

beforeEach(() => {
  cleanupKogoroEnv = withKogoroEnv();
  mkdirSync(testDir, { recursive: true });
  process.env["KOGORO_STATE_DIR"] = testDir;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  cleanupKogoroEnv();
});

describe("loadWindowState", () => {
  test("returns null when file does not exist", () => {
    expect(loadWindowState()).toBeNull();
  });

  test("returns saved frame after saveWindowState", () => {
    const frame = { x: 100, y: 200, width: 1200, height: 800 };
    saveWindowState(frame);
    expect(loadWindowState()).toEqual(frame);
  });

  test("returns null for corrupt JSON", () => {
    writeFileSync(join(testDir, ".window-state.json"), "not json");
    expect(loadWindowState()).toBeNull();
  });
});

describe("saveWindowState", () => {
  test("writes frame to disk", () => {
    const frame = { x: 10, y: 20, width: 800, height: 600 };
    saveWindowState(frame);
    const raw = readFileSync(join(testDir, ".window-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(frame);
  });

  test("overwrites previous state", () => {
    saveWindowState({ x: 0, y: 0, width: 100, height: 100 });
    saveWindowState({ x: 50, y: 50, width: 200, height: 200 });
    expect(loadWindowState()).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });
});

describe("loadThemeMode", () => {
  test("returns null when file does not exist", () => {
    expect(loadThemeMode()).toBeNull();
  });

  test("returns saved mode after saveThemeMode", () => {
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });

  test("returns null for corrupt JSON", () => {
    writeFileSync(join(testDir, ".theme-state.json"), "{bad");
    expect(loadThemeMode()).toBeNull();
  });

  test("returns null for invalid mode value", () => {
    writeFileSync(join(testDir, ".theme-state.json"), JSON.stringify({ mode: "blue" }));
    expect(loadThemeMode()).toBeNull();
  });
});

describe("saveThemeMode", () => {
  test("writes mode to disk", () => {
    saveThemeMode("light");
    const raw = readFileSync(join(testDir, ".theme-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ mode: "light" });
  });

  test("overwrites previous mode", () => {
    saveThemeMode("light");
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });
});

describe("loadSidebarCollapsed", () => {
  test("returns false when file does not exist", () => {
    expect(loadSidebarCollapsed()).toBe(false);
  });

  test("returns saved value after saveSidebarCollapsed", () => {
    saveSidebarCollapsed(true);
    expect(loadSidebarCollapsed()).toBe(true);
  });

  test("returns false for corrupt JSON", () => {
    writeFileSync(join(testDir, ".sidebar-state.json"), "{bad");
    expect(loadSidebarCollapsed()).toBe(false);
  });
});

describe("saveSidebarCollapsed", () => {
  test("writes collapsed state to disk", () => {
    saveSidebarCollapsed(true);
    const raw = readFileSync(join(testDir, ".sidebar-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ collapsed: true });
  });

  test("overwrites previous state", () => {
    saveSidebarCollapsed(true);
    saveSidebarCollapsed(false);
    expect(loadSidebarCollapsed()).toBe(false);
  });
});
