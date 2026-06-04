import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadWatchedFolders, saveWatchedFolders } from "./watched-folders";

const testDir = join(import.meta.dir, "__test_watched_folders__");

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env["KOGORO_STATE_DIR"];
});

describe("loadWatchedFolders", () => {
  test("returns empty array when file does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns saved folders after saveWatchedFolders", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const folders = [{ path: "/media/anime", addedAt: "2026-01-01T00:00:00.000Z" }];
    saveWatchedFolders(folders);
    expect(loadWatchedFolders()).toEqual(folders);
  });

  test("returns empty array for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".watched-folders.json"), "not json");
    expect(loadWatchedFolders()).toEqual([]);
  });
});

describe("saveWatchedFolders", () => {
  test("writes folders to disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const folders = [
      { path: "/media/anime", addedAt: "2026-01-01T00:00:00.000Z" },
      {
        path: "/media/movies",
        addedAt: "2026-02-01T00:00:00.000Z",
        lastScannedAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    saveWatchedFolders(folders);
    const raw = readFileSync(join(testDir, ".watched-folders.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(folders);
  });

  test("overwrites previous folders", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    saveWatchedFolders([{ path: "/old", addedAt: "2026-01-01T00:00:00.000Z" }]);
    saveWatchedFolders([{ path: "/new", addedAt: "2026-06-01T00:00:00.000Z" }]);
    expect(loadWatchedFolders()).toEqual([{ path: "/new", addedAt: "2026-06-01T00:00:00.000Z" }]);
  });
});
