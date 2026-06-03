import { describe, expect, it } from "bun:test";
import { makeLibraryItem, makeLibraryState } from "../../fixtures";
import { filterAndSort } from "./library-state";

describe("filterAndSort", () => {
  describe("search filtering", () => {
    it("returns all items when search is empty", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Steins;Gate" }),
        makeLibraryItem({ id: "2", titleEn: "Attack on Titan" }),
      ];
      const state = makeLibraryState({ items, search: "" });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters items by title matching search query", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Steins;Gate" }),
        makeLibraryItem({ id: "2", titleEn: "Attack on Titan" }),
        makeLibraryItem({ id: "3", titleEn: "Steins;Gate 0" }),
      ];
      const state = makeLibraryState({ items, search: "steins" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(["1", "3"]);
    });

    it("matches case-insensitively", () => {
      const items = [makeLibraryItem({ id: "1", titleEn: "STEINS;GATE" })];
      const state = makeLibraryState({ items, search: "steins" });
      expect(filterAndSort(state)).toHaveLength(1);
    });
  });

  describe("type filtering", () => {
    it("returns all items when typeFilter is empty", () => {
      const items = [makeLibraryItem({ entryType: "tv" }), makeLibraryItem({ entryType: "movie" })];
      const state = makeLibraryState({ items, typeFilter: [] });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters items by selected entry types", () => {
      const items = [
        makeLibraryItem({ id: "1", entryType: "tv" }),
        makeLibraryItem({ id: "2", entryType: "movie" }),
        makeLibraryItem({ id: "3", entryType: "ova" }),
      ];
      const state = makeLibraryState({ items, typeFilter: ["tv", "movie"] });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.entryType)).toEqual(["tv", "movie"]);
    });
  });

  describe("sorting", () => {
    it("sorts by title ascending", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Cowboy Bebop" }),
        makeLibraryItem({ id: "2", titleEn: "Akira" }),
        makeLibraryItem({ id: "3", titleEn: "Berserk" }),
      ];
      const state = makeLibraryState({ items, sortField: "titleEn", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.titleEn)).toEqual(["Akira", "Berserk", "Cowboy Bebop"]);
    });

    it("sorts by title descending", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Cowboy Bebop" }),
        makeLibraryItem({ id: "2", titleEn: "Akira" }),
        makeLibraryItem({ id: "3", titleEn: "Berserk" }),
      ];
      const state = makeLibraryState({ items, sortField: "titleEn", sortAsc: false });
      const result = filterAndSort(state);
      expect(result.map((i) => i.titleEn)).toEqual(["Cowboy Bebop", "Berserk", "Akira"]);
    });

    it("sorts by episode count", () => {
      const items = [
        makeLibraryItem({ id: "1", episodeCount: 24 }),
        makeLibraryItem({ id: "2", episodeCount: 12 }),
        makeLibraryItem({ id: "3", episodeCount: 50 }),
      ];
      const state = makeLibraryState({ items, sortField: "episodeCount", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.episodeCount)).toEqual([12, 24, 50]);
    });

    it("sorts by entry type", () => {
      const items = [
        makeLibraryItem({ id: "1", entryType: "ova" }),
        makeLibraryItem({ id: "2", entryType: "tv" }),
        makeLibraryItem({ id: "3", entryType: "movie" }),
      ];
      const state = makeLibraryState({ items, sortField: "entryType", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.entryType)).toEqual(["movie", "ova", "tv"]);
    });
  });

  describe("combined filter and sort", () => {
    it("filters then sorts remaining items", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Steins;Gate", entryType: "tv" }),
        makeLibraryItem({ id: "2", titleEn: "Attack on Titan", entryType: "tv" }),
        makeLibraryItem({ id: "3", titleEn: "Steins;Gate 0", entryType: "ova" }),
        makeLibraryItem({ id: "4", titleEn: "Your Name", entryType: "movie" }),
      ];
      const state = makeLibraryState({
        items,
        search: "steins",
        typeFilter: ["tv"],
        sortField: "titleEn",
        sortAsc: true,
      });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });
  });
});
