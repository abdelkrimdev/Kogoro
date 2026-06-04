import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadThemeMode,
  loadWatchedFolders,
  loadWindowState,
  saveThemeMode,
  saveWatchedFolders,
  saveWindowState,
} from "./state";

const testDir = join(import.meta.dir, "__test_state__");

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env["KOGORO_STATE_DIR"];
});

describe("loadWindowState", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(loadWindowState()).toBeNull();
  });

  test("returns saved frame after saveWindowState", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const frame = { x: 100, y: 200, width: 1200, height: 800 };
    saveWindowState(frame);
    expect(loadWindowState()).toEqual(frame);
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".window-state.json"), "not json");
    expect(loadWindowState()).toBeNull();
  });
});

describe("saveWindowState", () => {
  test("writes frame to disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const frame = { x: 10, y: 20, width: 800, height: 600 };
    saveWindowState(frame);
    const raw = readFileSync(join(testDir, ".window-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(frame);
  });

  test("overwrites previous state", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveWindowState({ x: 0, y: 0, width: 100, height: 100 });
    saveWindowState({ x: 50, y: 50, width: 200, height: 200 });
    expect(loadWindowState()).toEqual({ x: 50, y: 50, width: 200, height: 200 });
  });
});

describe("loadThemeMode", () => {
  test("returns null when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(loadThemeMode()).toBeNull();
  });

  test("returns saved mode after saveThemeMode", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });

  test("returns null for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".theme-state.json"), "{bad");
    expect(loadThemeMode()).toBeNull();
  });

  test("returns null for invalid mode value", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".theme-state.json"), JSON.stringify({ mode: "blue" }));
    expect(loadThemeMode()).toBeNull();
  });
});

describe("saveThemeMode", () => {
  test("writes mode to disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveThemeMode("light");
    const raw = readFileSync(join(testDir, ".theme-state.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual({ mode: "light" });
  });

  test("overwrites previous mode", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveThemeMode("light");
    saveThemeMode("dark");
    expect(loadThemeMode()).toBe("dark");
  });
});

describe("loadWatchedFolders", () => {
  test("returns empty array when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns empty array for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".watched-folders.json"), "not json");
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns empty array for non-array JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".watched-folders.json"), JSON.stringify({ foo: "bar" }));
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns saved folders with exists flags", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const folders = [{ path: "/fake/path", addedAt: "2026-01-01T00:00:00.000Z", exists: false }];
    saveWatchedFolders(folders);
    const result = loadWatchedFolders();
    expect(result).toEqual([
      { path: "/fake/path", addedAt: "2026-01-01T00:00:00.000Z", exists: false },
    ]);
  });

  test("returns exists true for paths that exist on disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    mkdirSync(join(testDir, "real-folder"), { recursive: true });
    const folders = [
      { path: join(testDir, "real-folder"), addedAt: "2026-01-01T00:00:00.000Z", exists: false },
    ];
    saveWatchedFolders(folders);
    const result = loadWatchedFolders();
    expect(result).toEqual([
      { path: join(testDir, "real-folder"), addedAt: "2026-01-01T00:00:00.000Z", exists: true },
    ]);
  });
});

describe("saveWatchedFolders", () => {
  test("writes folders to disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const folders = [
      {
        path: "/media/anime",
        addedAt: "2026-01-01T00:00:00.000Z",
        lastScannedAt: "2026-06-01T00:00:00.000Z",
        exists: false,
      },
    ];
    saveWatchedFolders(folders);
    const raw = readFileSync(join(testDir, ".watched-folders.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual([
      {
        path: "/media/anime",
        addedAt: "2026-01-01T00:00:00.000Z",
        lastScannedAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
  });

  test("overwrites previous folders", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveWatchedFolders([{ path: "/old", addedAt: "2026-01-01T00:00:00.000Z", exists: false }]);
    saveWatchedFolders([{ path: "/new", addedAt: "2026-02-01T00:00:00.000Z", exists: false }]);
    const result = loadWatchedFolders();
    expect(result).toEqual([{ path: "/new", addedAt: "2026-02-01T00:00:00.000Z", exists: false }]);
  });
});
