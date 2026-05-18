import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OverrideStore } from "../src/override-store.ts";

describe("OverrideStore", () => {
  function setupTempDir(): string {
    return mkdtempSync(join(tmpdir(), "kogoro-override-"));
  }

  function cleanupTempDir(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

  test("set stores an override and get retrieves it", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42", episodeId: "ep-1", entryType: "tv" });
      const result = store.get("abc123");
      expect(result).toEqual({ animeId: "tvdb-42", episodeId: "ep-1", entryType: "tv" });
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("get returns undefined for non-existent hash", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      expect(store.get("nonexistent")).toBeUndefined();
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("remove deletes an existing override", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42" });
      expect(store.remove("abc123")).toBe(true);
      expect(store.get("abc123")).toBeUndefined();
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("remove returns false for non-existent hash", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      expect(store.remove("nonexistent")).toBe(false);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("list returns all overrides", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      store.set("hash1", { animeId: "tvdb-1" });
      store.set("hash2", { animeId: "tvdb-2", entryType: "movie" });
      const items = store.list();
      expect(items).toHaveLength(2);
      expect(items.find((i) => i.hash === "hash1")?.data).toEqual({ animeId: "tvdb-1" });
      expect(items.find((i) => i.hash === "hash2")?.data).toEqual({
        animeId: "tvdb-2",
        entryType: "movie",
      });
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("list returns empty array for empty store", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      expect(store.list()).toEqual([]);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("override persists across store reload", () => {
    const dir = setupTempDir();
    try {
      const store1 = new OverrideStore(dir);
      store1.set("abc123", { animeId: "tvdb-42", episodeId: "ep-1", entryType: "movie" });

      const store2 = new OverrideStore(dir);
      const result = store2.get("abc123");
      expect(result).toEqual({ animeId: "tvdb-42", episodeId: "ep-1", entryType: "movie" });
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("kogoro.toml is written to disk", () => {
    const dir = setupTempDir();
    try {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42" });
      const tomlPath = join(dir, "kogoro.toml");
      expect(existsSync(tomlPath)).toBe(true);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("override survives file removal then reload", () => {
    const dir = setupTempDir();
    try {
      const store1 = new OverrideStore(dir);
      store1.set("hash1", { animeId: "tvdb-1" });
      store1.set("hash2", { animeId: "tvdb-2", entryType: "special" });

      const store2 = new OverrideStore(dir);
      store2.remove("hash1");
      expect(store2.get("hash1")).toBeUndefined();
      expect(store2.get("hash2")).toEqual({ animeId: "tvdb-2", entryType: "special" });
    } finally {
      cleanupTempDir(dir);
    }
  });
});
