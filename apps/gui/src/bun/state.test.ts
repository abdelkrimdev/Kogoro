import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadThemeMode,
  loadWindowState,
  saveThemeMode,
  saveWindowState,
  setStateDir,
} from "./state";

const testDir = join(import.meta.dir, "__test_state__");

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  setStateDir(join(import.meta.dir, "../.."));
});

describe("loadWindowState", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    expect(loadWindowState()).toBeNull();
  });

  test("returns saved frame after saveWindowState", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    const frame = { x: 100, y: 200, width: 1200, height: 800 };
    saveWindowState(frame);
    expect(loadWindowState()).toEqual(frame);
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    writeFileSync(join(testDir, ".window-state.json"), "not json");
    expect(loadWindowState()).toBeNull();
  });
});

describe("saveWindowState", () => {
  test("writes frame to disk", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    const frame = { x: 10, y: 20, width: 800, height: 600 };
    saveWindowState(frame);
    const raw = readFileSync(join(testDir, ".window-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(frame);
  });

  test("overwrites previous state", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    saveWindowState({ x: 0, y: 0, width: 100, height: 100 });
    saveWindowState({ x: 50, y: 50, width: 200, height: 200 });
    expect(loadWindowState()).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });
});

describe("loadThemeMode", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    expect(loadThemeMode()).toBeNull();
  });

  test("returns saved mode after saveThemeMode", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    writeFileSync(join(testDir, ".theme-state.json"), "{bad");
    expect(loadThemeMode()).toBeNull();
  });

  test("returns null for invalid mode value", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    writeFileSync(join(testDir, ".theme-state.json"), JSON.stringify({ mode: "blue" }));
    expect(loadThemeMode()).toBeNull();
  });
});

describe("saveThemeMode", () => {
  test("writes mode to disk", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    saveThemeMode("light");
    const raw = readFileSync(join(testDir, ".theme-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ mode: "light" });
  });

  test("overwrites previous mode", () => {
    mkdirSync(testDir, { recursive: true });
    setStateDir(testDir);
    saveThemeMode("light");
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });
});
