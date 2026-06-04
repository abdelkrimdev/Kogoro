import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import {
  addWatchedFolderHandler,
  getWatchedFoldersHandler,
  removeWatchedFolderHandler,
} from "./watched-folders-handlers";

const testDir = `${import.meta.dir}/__test_watched_handlers__`;

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env["KOGORO_STATE_DIR"];
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
