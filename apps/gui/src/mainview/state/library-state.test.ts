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

  describe("library state filter", () => {
    it("returns all items when filter is all", () => {
      const items = [
        makeLibraryItem({ id: "1", libraryState: "on_disk" }),
        makeLibraryItem({ id: "2", libraryState: "not_on_disk" }),
      ];
      const state = makeLibraryState({ items, libraryStateFilter: "all" });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters by on_disk", () => {
      const items = [
        makeLibraryItem({ id: "1", libraryState: "on_disk" }),
        makeLibraryItem({ id: "2", libraryState: "not_on_disk" }),
        makeLibraryItem({ id: "3", libraryState: "partially_on_disk" }),
      ];
      const state = makeLibraryState({ items, libraryStateFilter: "on_disk" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("filters by partially_on_disk", () => {
      const items = [
        makeLibraryItem({ id: "1", libraryState: "on_disk" }),
        makeLibraryItem({ id: "2", libraryState: "partially_on_disk" }),
        makeLibraryItem({ id: "3", libraryState: "not_on_disk" }),
      ];
      const state = makeLibraryState({ items, libraryStateFilter: "partially_on_disk" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("filters by not_on_disk", () => {
      const items = [
        makeLibraryItem({ id: "1", libraryState: "on_disk" }),
        makeLibraryItem({ id: "2", libraryState: "not_on_disk" }),
        makeLibraryItem({ id: "3", libraryState: "partially_on_disk" }),
      ];
      const state = makeLibraryState({ items, libraryStateFilter: "not_on_disk" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });
  });

  describe("watch status filter", () => {
    it("returns all items when filter is all", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "completed" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "all" });
      expect(filterAndSort(state)).toHaveLength(2);
    });

    it("filters by watching", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "completed" }] }),
        makeLibraryItem({
          id: "3",
          groups: [
            { entryType: "tv", watchStatus: "completed" },
            { entryType: "movie", watchStatus: "watching" },
          ],
        }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "watching" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result.map((i) => i.id)).toEqual(["1", "3"]);
    });

    it("filters by completed", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "completed" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "completed" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("filters by on_hold", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "on_hold" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "on_hold" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("filters by dropped", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "dropped" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "dropped" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("filters by plan_to_watch", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
        makeLibraryItem({ id: "2", groups: [{ entryType: "tv", watchStatus: "plan_to_watch" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "plan_to_watch" });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("2");
    });

    it("returns empty when no items match watch status", () => {
      const items = [
        makeLibraryItem({ id: "1", groups: [{ entryType: "tv", watchStatus: "watching" }] }),
      ];
      const state = makeLibraryState({ items, watchStatusFilter: "completed" });
      expect(filterAndSort(state)).toHaveLength(0);
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

    it("sorts by files on disk", () => {
      const items = [
        makeLibraryItem({ id: "1", filesOnDisk: 24 }),
        makeLibraryItem({ id: "2", filesOnDisk: 12 }),
        makeLibraryItem({ id: "3", filesOnDisk: 50 }),
      ];
      const state = makeLibraryState({ items, sortField: "filesOnDisk", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.filesOnDisk)).toEqual([12, 24, 50]);
    });

    it("sorts by group count ascending", () => {
      const items = [
        makeLibraryItem({ id: "1", groupCount: 3 }),
        makeLibraryItem({ id: "2", groupCount: 1 }),
        makeLibraryItem({ id: "3", groupCount: 5 }),
      ];
      const state = makeLibraryState({ items, sortField: "groupCount", sortAsc: true });
      const result = filterAndSort(state);
      expect(result.map((i) => i.groupCount)).toEqual([1, 3, 5]);
    });

    it("sorts by group count descending", () => {
      const items = [
        makeLibraryItem({ id: "1", groupCount: 3 }),
        makeLibraryItem({ id: "2", groupCount: 1 }),
        makeLibraryItem({ id: "3", groupCount: 5 }),
      ];
      const state = makeLibraryState({ items, sortField: "groupCount", sortAsc: false });
      const result = filterAndSort(state);
      expect(result.map((i) => i.groupCount)).toEqual([5, 3, 1]);
    });
  });

  describe("combined filters", () => {
    it("filters by search and library state", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Steins;Gate", libraryState: "on_disk" }),
        makeLibraryItem({ id: "2", titleEn: "Steins;Gate 0", libraryState: "not_on_disk" }),
        makeLibraryItem({ id: "3", titleEn: "Attack on Titan", libraryState: "on_disk" }),
      ];
      const state = makeLibraryState({
        items,
        search: "steins",
        libraryStateFilter: "on_disk",
      });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("filters by library state and watch status", () => {
      const items = [
        makeLibraryItem({
          id: "1",
          libraryState: "on_disk",
          groups: [{ entryType: "tv", watchStatus: "watching" }],
        }),
        makeLibraryItem({
          id: "2",
          libraryState: "on_disk",
          groups: [{ entryType: "tv", watchStatus: "completed" }],
        }),
        makeLibraryItem({
          id: "3",
          libraryState: "not_on_disk",
          groups: [{ entryType: "tv", watchStatus: "watching" }],
        }),
      ];
      const state = makeLibraryState({
        items,
        libraryStateFilter: "on_disk",
        watchStatusFilter: "watching",
      });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("filters by all three: search, library state, watch status", () => {
      const items = [
        makeLibraryItem({
          id: "1",
          titleEn: "Steins;Gate",
          libraryState: "on_disk",
          groups: [{ entryType: "tv", watchStatus: "watching" }],
        }),
        makeLibraryItem({
          id: "2",
          titleEn: "Steins;Gate 0",
          libraryState: "on_disk",
          groups: [{ entryType: "tv", watchStatus: "completed" }],
        }),
        makeLibraryItem({
          id: "3",
          titleEn: "Steins;Gate",
          libraryState: "not_on_disk",
          groups: [{ entryType: "tv", watchStatus: "watching" }],
        }),
      ];
      const state = makeLibraryState({
        items,
        search: "steins",
        libraryStateFilter: "on_disk",
        watchStatusFilter: "watching",
      });
      const result = filterAndSort(state);
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("1");
    });

    it("filters then sorts remaining items", () => {
      const items = [
        makeLibraryItem({ id: "1", titleEn: "Steins;Gate" }),
        makeLibraryItem({ id: "2", titleEn: "Attack on Titan" }),
        makeLibraryItem({ id: "3", titleEn: "Steins;Gate 0" }),
      ];
      const state = makeLibraryState({
        items,
        search: "steins",
        sortField: "titleEn",
        sortAsc: true,
      });
      const result = filterAndSort(state);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe("1");
      expect(result[1]?.id).toBe("3");
    });
  });
});
