import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withKogoroEnv } from "@kogoro/core/testing";
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

describe("loadWatchedFolders", () => {
  test("returns empty array when file does not exist", () => {
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns empty array for corrupt JSON", () => {
    writeFileSync(join(testDir, ".watched-folders.json"), "not json");
    expect(loadWatchedFolders()).toEqual([]);
  });

  test("returns folders from saved file", () => {
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
    addWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/One Piece");
    expect(folders[0]?.addedAt).toBeDefined();
  });

  test("prevents duplicate folders", () => {
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
  });

  test("adds second folder", () => {
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(2);
  });
});

describe("removeWatchedFolder", () => {
  test("removes a folder by path", () => {
    addWatchedFolder("/anime/One Piece");
    addWatchedFolder("/anime/Naruto");
    removeWatchedFolder("/anime/One Piece");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/Naruto");
  });

  test("does nothing when path not found", () => {
    addWatchedFolder("/anime/One Piece");
    removeWatchedFolder("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/One Piece");
  });
});

describe("markWatchedFolderScanned", () => {
  test("sets lastScannedAt for an existing folder", () => {
    addWatchedFolder("/anime/One Piece");
    const result = markWatchedFolderScanned("/anime/One Piece");
    expect(result).not.toBeNull();
    expect(result?.lastScannedAt).toBeDefined();
    const folders = loadWatchedFolders();
    expect(folders[0]?.lastScannedAt).toBe(result?.lastScannedAt);
  });

  test("returns null for a folder that does not exist", () => {
    expect(markWatchedFolderScanned("/nonexistent")).toBeNull();
  });

  test("persists lastScannedAt to disk", () => {
    addWatchedFolder("/anime/Naruto");
    markWatchedFolderScanned("/anime/Naruto");
    const folders = loadWatchedFolders();
    expect(folders[0]?.lastScannedAt).toBeDefined();
  });
});

describe("getWatchedFoldersHandler", () => {
  test("returns empty array when no folders tracked", () => {
    expect(getWatchedFoldersHandler()).toEqual([]);
  });

  test("returns exists:false for folders that do not exist on disk", () => {
    addWatchedFolderHandler({ path: "/nonexistent/folder" });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.exists).toBe(false);
  });

  test("returns exists:true for folders that exist on disk", () => {
    addWatchedFolderHandler({ path: testDir });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.exists).toBe(true);
  });
});

describe("addWatchedFolderHandler", () => {
  test("adds a folder and returns success", () => {
    const result = addWatchedFolderHandler({ path: "/anime/One Piece" });
    expect(result).toEqual({ success: true });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
  });
});

describe("removeWatchedFolderHandler", () => {
  test("removes a folder and returns success", () => {
    addWatchedFolderHandler({ path: "/anime/One Piece" });
    addWatchedFolderHandler({ path: "/anime/Naruto" });
    const result = removeWatchedFolderHandler({ path: "/anime/One Piece" });
    expect(result).toEqual({ success: true });
    const folders = getWatchedFoldersHandler();
    expect(folders).toHaveLength(1);
    expect(folders[0]?.path).toBe("/anime/Naruto");
  });
});
