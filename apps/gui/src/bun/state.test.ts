import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadThemeMode, loadWindowState, saveThemeMode, saveWindowState } from "./state";

const testDir = join(import.meta.dir, "__test_state__");

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("loadWindowState", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    expect(loadWindowState(testDir)).toBeNull();
  });

  test("returns saved frame after saveWindowState", () => {
    mkdirSync(testDir, { recursive: true });
    const frame = { x: 100, y: 200, width: 1200, height: 800 };
    saveWindowState(frame, testDir);
    expect(loadWindowState(testDir)).toEqual(frame);
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, ".window-state.json"), "not json");
    expect(loadWindowState(testDir)).toBeNull();
  });
});

describe("saveWindowState", () => {
  test("writes frame to disk", () => {
    mkdirSync(testDir, { recursive: true });
    const frame = { x: 10, y: 20, width: 800, height: 600 };
    saveWindowState(frame, testDir);
    const raw = readFileSync(join(testDir, ".window-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(frame);
  });

  test("overwrites previous state", () => {
    mkdirSync(testDir, { recursive: true });
    saveWindowState({ x: 0, y: 0, width: 100, height: 100 }, testDir);
    saveWindowState({ x: 50, y: 50, width: 200, height: 200 }, testDir);
    expect(loadWindowState(testDir)).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });
});

describe("loadThemeMode", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    expect(loadThemeMode(testDir)).toBeNull();
  });

  test("returns saved mode after saveThemeMode", () => {
    mkdirSync(testDir, { recursive: true });
    saveThemeMode("dark", testDir);
    expect(loadThemeMode(testDir)).toBe("dark");
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, ".theme-state.json"), "{bad");
    expect(loadThemeMode(testDir)).toBeNull();
  });

  test("returns null for invalid mode value", () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, ".theme-state.json"), JSON.stringify({ mode: "blue" }));
    expect(loadThemeMode(testDir)).toBeNull();
  });
});

describe("saveThemeMode", () => {
  test("writes mode to disk", () => {
    mkdirSync(testDir, { recursive: true });
    saveThemeMode("light", testDir);
    const raw = readFileSync(join(testDir, ".theme-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ mode: "light" });
  });

  test("overwrites previous mode", () => {
    mkdirSync(testDir, { recursive: true });
    saveThemeMode("light", testDir);
    saveThemeMode("dark", testDir);
    expect(loadThemeMode(testDir)).toBe("dark");
  });
});
