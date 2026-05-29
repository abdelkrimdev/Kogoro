import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { OverrideStore } from "./override-store";
import { withTempDir } from "./test-fixtures";

describe("OverrideStore", () => {
  test("set stores an override and get retrieves it", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42", episodeId: "ep-1", entryType: "tv" });
      const result = store.get("abc123");
      expect(result).toEqual({ animeId: "tvdb-42", episodeId: "ep-1", entryType: "tv" });
    });
  });

  test("get returns undefined for non-existent hash", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      expect(store.get("nonexistent")).toBeUndefined();
    });
  });

  test("remove deletes an existing override", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42" });
      expect(store.remove("abc123")).toBe(true);
      expect(store.get("abc123")).toBeUndefined();
    });
  });

  test("remove returns false for non-existent hash", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      expect(store.remove("nonexistent")).toBe(false);
    });
  });

  test("list returns all overrides", async () => {
    await withTempDir("override", async (dir) => {
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
    });
  });

  test("list returns empty array for empty store", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      expect(store.list()).toEqual([]);
    });
  });

  test("override persists across store reload", async () => {
    await withTempDir("override", async (dir) => {
      const store1 = new OverrideStore(dir);
      store1.set("abc123", { animeId: "tvdb-42", episodeId: "ep-1", entryType: "movie" });

      const store2 = new OverrideStore(dir);
      const result = store2.get("abc123");
      expect(result).toEqual({ animeId: "tvdb-42", episodeId: "ep-1", entryType: "movie" });
    });
  });

  test("persists overrides to disk", async () => {
    await withTempDir("override", async (dir) => {
      const store = new OverrideStore(dir);
      store.set("abc123", { animeId: "tvdb-42" });
      const tomlPath = join(dir, "kogoro.toml");
      expect(existsSync(tomlPath)).toBe(true);
    });
  });

  test("removing one override does not affect other persisted overrides", async () => {
    await withTempDir("override", async (dir) => {
      const store1 = new OverrideStore(dir);
      store1.set("hash1", { animeId: "tvdb-1" });
      store1.set("hash2", { animeId: "tvdb-2", entryType: "special" });

      const store2 = new OverrideStore(dir);
      store2.remove("hash1");
      expect(store2.get("hash1")).toBeUndefined();
      expect(store2.get("hash2")).toEqual({ animeId: "tvdb-2", entryType: "special" });
    });
  });
});
