import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  addWatchedFolder,
  addWatchedFolderHandler,
  getWatchedFoldersHandler,
  loadWatchedFolders,
  markWatchedFolderScanned,
  removeWatchedFolder,
  removeWatchedFolderHandler,
} from "./watched-folders";

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

  test("returns empty array for corrupt JSON", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    writeFileSync(join(testDir, ".watched-folders.json"), "not json");
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns folders from saved file", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const folders = [
      { path: "/anime/One Piece", addedAt: "2026-01-01T00:00:00.000Z" },
      {
        path: "/anime/Naruto",
        addedAt: "2026-01-02T00:00:00.000Z",
        lastScannedAt: "2026-01-03T00:00:00.000Z",
      },
    ];
    writeFileSync(join(testDir, ".watched-folders.json"), JSON.stringify(folders));
    expect(loadWatchedFolders()).toEqual(folders);
  });
});

describe("addWatchedFolder", () => {
  test("adds a folder to an empty list", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/One Piece");
    expect(folders[0]?.addedAt).toBeDefined();
  });

  test("prevents duplicate folders", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
  });

  test("adds second folder", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(2);
  });
});

describe("removeWatchedFolder", () => {
  test("removes a folder by path", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/Naruto");
    removeWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/Naruto");
  });

  test("does nothing when path not found", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    removeWatchedFolder("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/One Piece");
  });
});

describe("markWatchedFolderScanned", () => {
  test("sets lastScannedAt for an existing folder", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/One Piece");
    const result = markWatchedFolderScanned("/anime/One Piece");
    expect(result).not.toBeNull();
    expect(result?.lastScannedAt).toBeDefined();
    const folders = loadWatchedFolders();
    expect(folders[0]?.lastScannedAt).toBe(result?.lastScannedAt);
  });

  test("returns null for a folder that does not exist", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(markWatchedFolderScanned("/nonexistent")).toBeNull();
  });

  test("persists lastScannedAt to disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolder("/anime/Naruto");
    markWatchedFolderScanned("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders[0]?.lastScannedAt).toBeDefined();
  });
});

describe("getWatchedFoldersHandler", () => {
  test("returns empty array when no folders tracked", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    expect(getWatchedFoldersHandler()).toEqual([]);
  });

  test("returns exists:false for folders that do not exist on disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolderHandler("/nonexistent/folder");
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.exists).toBe(false);
  });

  test("returns exists:true for folders that exist on disk", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolderHandler(testDir);
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.exists).toBe(true);
  });
});

describe("addWatchedFolderHandler", () => {
  test("adds a folder and returns success", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    const result = addWatchedFolderHandler("/anime/One Piece");
    expect(result).toEqual({ success: true });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
  });
});

describe("removeWatchedFolderHandler", () => {
  test("removes a folder and returns success", () => {
    mkdirSync(testDir, { recursive: true });
    process.env["KOGORO_STATE_DIR"] = testDir;
    addWatchedFolderHandler("/anime/One Piece");
    addWatchedFolderHandler("/anime/Naruto");
    const result = removeWatchedFolderHandler("/anime/One Piece");
    expect(result).toEqual({ success: true });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/Naruto");
  });
});
