import { describe, expect, test } from "bun:test";
import { OverrideStore } from "@kogoro/core";
import { withTempDir } from "@kogoro/core/testing";
import { createOverrideHandlers } from "./handlers";

describe("Override CLI commands", () => {
  test("set stores an override entry", async () => {
    await withTempDir("cli-override", async (dir) => {
      const handlers = createOverrideHandlers({ overrideDir: dir });
      const result = handlers.set("hash1", {
        animeId: "tvdb-42",
        episodeId: "ep-5",
        entryType: "tv",
      });
      expect(result).toBe(true);

      const store = new OverrideStore(dir);
      expect(store.get("hash1")).toEqual({
        animeId: "tvdb-42",
        episodeId: "ep-5",
        entryType: "tv",
      });
    });
  });

  test("list returns all entries", async () => {
    await withTempDir("cli-override", async (dir) => {
      const store = new OverrideStore(dir);
      store.set("hash1", { animeId: "tvdb-1", entryType: "movie" });
      store.set("hash2", { animeId: "tvdb-2" });

      const handlers = createOverrideHandlers({ overrideDir: dir });
      const items = handlers.list();
      expect(items).toHaveLength(2);
      expect(items.find((i) => i.hash === "hash1")?.data.animeId).toBe("tvdb-1");
    });
  });

  test("remove deletes an existing entry", async () => {
    await withTempDir("cli-override", async (dir) => {
      const store1 = new OverrideStore(dir);
      store1.set("hash1", { animeId: "tvdb-42" });

      const handlers = createOverrideHandlers({ overrideDir: dir });
      const result = handlers.remove("hash1");
      expect(result).toBe(true);

      const store2 = new OverrideStore(dir);
      expect(store2.get("hash1")).toBeUndefined();
    });
  });

  test("set stores with only animeId", async () => {
    await withTempDir("cli-override", async (dir) => {
      const handlers = createOverrideHandlers({ overrideDir: dir });
      handlers.set("hash1", { animeId: "tvdb-99" });

      const store = new OverrideStore(dir);
      expect(store.get("hash1")).toEqual({ animeId: "tvdb-99" });
    });
  });

  test("set stores with only entryType", async () => {
    await withTempDir("cli-override", async (dir) => {
      const handlers = createOverrideHandlers({ overrideDir: dir });
      handlers.set("hash1", { entryType: "special" });

      const store = new OverrideStore(dir);
      expect(store.get("hash1")).toEqual({ entryType: "special" });
    });
  });

  test("remove throws for missing entry", async () => {
    await withTempDir("cli-override", async (dir) => {
      const handlers = createOverrideHandlers({ overrideDir: dir });
      expect(() => handlers.remove("nonexistent")).toThrow("not found");
    });
  });
});
