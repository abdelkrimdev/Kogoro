import { describe, expect, it } from "bun:test";
import { filterAndSort, type LibraryItem, type LibraryState } from "./library-state";

const makeItem = (overrides: Partial<LibraryItem> = {}): LibraryItem => ({
  id: overrides.id ?? "1",
  titleEn: overrides.titleEn ?? "Steins;Gate",
  entryType: overrides.entryType ?? "tv",
  episodeCount: overrides.episodeCount ?? 24,
  coverArt: overrides.coverArt,
});

const makeState = (overrides: Partial<LibraryState> = {}): LibraryState => ({
  items: overrides.items ?? [],
  search: overrides.search ?? "",
  typeFilter: overrides.typeFilter ?? [],
  viewMode: overrides.viewMode ?? "grid",
  sortField: overrides.sortField ?? "titleEn",
  sortAsc: overrides.sortAsc ?? true,
});

describe("filterAndSort", () => {
  describe("search filtering", () => {
    it("returns all items when search is empty", () => {
      const items = [
        makeItem({ id: "1", titleEn: "Steins;Gate" }),
        makeItem({ id: "2", titleEn: "Attack on Titan" }),
      ];
      const state = makeState({ items, search: "" });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters items by title matching search query", () => {
      const items = [
        makeItem({ id: "1", titleEn: "Steins;Gate" }),
        makeItem({ id: "2", titleEn: "Attack on Titan" }),
        makeItem({ id: "3", titleEn: "Steins;Gate 0" }),
      ];
      const state = makeState({ items, search: "steins" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(["1", "3"]);
    });

    it("matches case-insensitively", () => {
      const items = [makeItem({ id: "1", titleEn: "STEINS;GATE" })];
      const state = makeState({ items, search: "steins" });
      expect(filterAndSort(state)).toHaveLength(1);
    });
  });

  describe("type filtering", () => {
    it("returns all items when typeFilter is empty", () => {
      const items = [makeItem({ entryType: "tv" }), makeItem({ entryType: "movie" })];
      const state = makeState({ items, typeFilter: [] });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters items by selected entry types", () => {
      const items = [
        makeItem({ id: "1", entryType: "tv" }),
        makeItem({ id: "2", entryType: "movie" }),
        makeItem({ id: "3", entryType: "ova" }),
      ];
      const state = makeState({ items, typeFilter: ["tv", "movie"] });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.entryType)).toEqual(["tv", "movie"]);
    });
  });

  describe("sorting", () => {
    it("sorts by title ascending", () => {
      const items = [
        makeItem({ id: "1", titleEn: "Cowboy Bebop" }),
        makeItem({ id: "2", titleEn: "Akira" }),
        makeItem({ id: "3", titleEn: "Berserk" }),
      ];
      const state = makeState({ items, sortField: "titleEn", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.titleEn)).toEqual(["Akira", "Berserk", "Cowboy Bebop"]);
    });

    it("sorts by title descending", () => {
      const items = [
        makeItem({ id: "1", titleEn: "Cowboy Bebop" }),
        makeItem({ id: "2", titleEn: "Akira" }),
        makeItem({ id: "3", titleEn: "Berserk" }),
      ];
      const state = makeState({ items, sortField: "titleEn", sortAsc: false });
      const result = filterAndSort(state);
      expect(result.map((i) => i.titleEn)).toEqual(["Cowboy Bebop", "Berserk", "Akira"]);
    });

    it("sorts by episode count", () => {
      const items = [
        makeItem({ id: "1", episodeCount: 24 }),
        makeItem({ id: "2", episodeCount: 12 }),
        makeItem({ id: "3", episodeCount: 50 }),
      ];
      const state = makeState({ items, sortField: "episodeCount", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.episodeCount)).toEqual([12, 24, 50]);
    });

    it("sorts by entry type", () => {
      const items = [
        makeItem({ id: "1", entryType: "ova" }),
        makeItem({ id: "2", entryType: "tv" }),
        makeItem({ id: "3", entryType: "movie" }),
      ];
      const state = makeState({ items, sortField: "entryType", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.entryType)).toEqual(["movie", "ova", "tv"]);
    });
  });

  describe("combined filter and sort", () => {
    it("filters then sorts remaining items", () => {
      const items = [
        makeItem({ id: "1", titleEn: "Steins;Gate", entryType: "tv" }),
        makeItem({ id: "2", titleEn: "Attack on Titan", entryType: "tv" }),
        makeItem({ id: "3", titleEn: "Steins;Gate 0", entryType: "ova" }),
        makeItem({ id: "4", titleEn: "Your Name", entryType: "movie" }),
      ];
      const state = makeState({
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
