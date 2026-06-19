import { describe, expect, it } from "bun:test";
import { createMockRPC } from "../../fixtures";
import { createImportPreviewState } from "./import-preview-state";

function makePreviewResponse(overrides: Record<string, unknown> = {}) {
  return {
    preview: {
      totalEntries: 3,
      matched: [
        {
          trackerId: "tl-1",
          title: "Attack on Titan",
          entryType: "tv",
          watchStatus: "completed",
          episodesWatched: 25,
          totalEpisodes: 25,
          matchStatus: "matched",
          existingAnimeId: 1,
          existingGroupId: 10,
        },
      ],
      unmatched: [
        {
          trackerId: "tl-2",
          title: "Death Note",
          entryType: "tv",
          watchStatus: "watching",
          episodesWatched: 12,
          totalEpisodes: 37,
          matchStatus: "unmatched",
        },
      ],
      conflicts: [
        {
          trackerId: "tl-3",
          title: "Naruto",
          entryType: "tv",
          watchStatus: "completed",
          episodesWatched: 220,
          totalEpisodes: 220,
          matchStatus: "conflict",
          existingAnimeId: 2,
          existingGroupId: 20,
          localWatchStatus: "watching",
        },
      ],
      statusCounts: {
        watching: 1,
        completed: 2,
        "plan-to-watch": 0,
        "on-hold": 0,
        dropped: 0,
      },
      ...overrides,
    },
  };
}

describe("createImportPreviewState", () => {
  describe("loadPreview", () => {
    it("sets loading state during fetch", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);

      expect(state.loading).toBe(false);

      const promise = state.loadPreview("anilist");
      expect(state.loading).toBe(true);

      await promise;
      expect(state.loading).toBe(false);
    });

    it("populates preview data on success", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);

      await state.loadPreview("anilist");

      expect(state.preview).not.toBeNull();
      expect(state.preview?.totalEntries).toBe(3);
      expect(state.preview?.matchedCount).toBe(1);
      expect(state.preview?.unmatchedCount).toBe(1);
      expect(state.preview?.conflictCount).toBe(1);
      expect(state.matched).toHaveLength(1);
      expect(state.matched[0]?.title).toBe("Attack on Titan");
      expect(state.matched[0]?.matchStatus).toBe("matched");
      expect(state.unmatched).toHaveLength(1);
      expect(state.unmatched[0]?.title).toBe("Death Note");
      expect(state.unmatched[0]?.matchStatus).toBe("unmatched");
      expect(state.conflicts).toHaveLength(1);
      expect(state.conflicts[0]?.title).toBe("Naruto");
      expect(state.conflicts[0]?.matchStatus).toBe("conflict");
      expect(state.conflicts[0]?.localWatchStatus).toBe("watching");
    });

    it("sets error when RPC returns error", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null, error: "Tracker not connected" },
      });
      const state = createImportPreviewState(rpc);

      await state.loadPreview("anilist");

      expect(state.error).toBe("Tracker not connected");
      expect(state.preview).toBeNull();
    });

    it("sets error when preview is null", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null },
      });
      const state = createImportPreviewState(rpc);

      await state.loadPreview("anilist");

      expect(state.error).toBe("No preview data received");
    });

    it("sets error on RPC failure", async () => {
      const rpc = createMockRPC({});
      rpc.request = async () => {
        throw new Error("Network error");
      };
      const state = createImportPreviewState(rpc);

      await state.loadPreview("anilist");

      expect(state.error).toBe("Network error");
    });

    it("clears previous error on new load", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null, error: "Failed" },
      });
      const state = createImportPreviewState(rpc);

      await state.loadPreview("anilist");
      expect(state.error).toBe("Failed");

      rpc.request = async () => makePreviewResponse();
      await state.loadPreview("anilist");
      expect(state.error).toBeNull();
    });

    it("sends correct RPC params", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);

      await state.loadPreview("kitsu");

      expect(rpc.calls[0]?.method).toBe("getImportPreview");
      expect(rpc.calls[0]?.params).toEqual({ trackerName: "kitsu" });
    });
  });

  describe("linkEntry", () => {
    it("adds a link selection", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.linkEntry("tl-2", 5);

      expect(state.linkSelections.get("tl-2")).toBe(5);
    });

    it("overwrites previous link for same tracker", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.linkEntry("tl-2", 5);
      state.linkEntry("tl-2", 10);

      expect(state.linkSelections.get("tl-2")).toBe(10);
    });
  });

  describe("resolveConflict", () => {
    it("adds a conflict resolution", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");

      expect(state.conflictSelections.get("tl-3")).toBe("keepLocal");
    });

    it("overwrites previous resolution for same tracker", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");
      state.resolveConflict("tl-3", "acceptTracker");

      expect(state.conflictSelections.get("tl-3")).toBe("acceptTracker");
    });
  });

  describe("confirmImport", () => {
    it("calls RPC with tracker name", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(rpc);

      await state.confirmImport("anilist");

      expect(rpc.calls[0]?.method).toBe("confirmImport");
      expect(rpc.calls[0]?.params).toEqual({ trackerName: "anilist" });
    });

    it("includes selections when link and conflict selections exist", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.linkEntry("tl-2", 5);
      state.resolveConflict("tl-3", "keepLocal");

      await state.confirmImport("anilist");

      const params = rpc.calls[1]?.params as {
        trackerName: string;
        selections: Array<{
          trackerId: string;
          groupId?: number;
          resolution?: string;
        }>;
      };
      expect(params.selections).toHaveLength(2);
      expect(params.selections).toContainEqual({
        trackerId: "tl-2",
        groupId: 5,
        resolution: undefined,
      });
      expect(params.selections).toContainEqual({
        trackerId: "tl-3",
        groupId: undefined,
        resolution: "keepLocal",
      });
    });

    it("omits selections when no user decisions made", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      await state.confirmImport("anilist");

      const params = rpc.calls[1]?.params as { trackerName: string; selections?: unknown };
      expect(params.selections).toBeUndefined();
    });

    it("sets result on success", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 2, skipped: 1 } },
      });
      const state = createImportPreviewState(rpc);

      await state.confirmImport("anilist");

      expect(state.result).toEqual({ imported: 2, skipped: 1 });
    });

    it("sets error when RPC returns error", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: null, error: "Import failed" },
      });
      const state = createImportPreviewState(rpc);

      await state.confirmImport("anilist");

      expect(state.error).toBe("Import failed");
    });

    it("sets error on RPC failure", async () => {
      const rpc = createMockRPC({});
      rpc.request = async () => {
        throw new Error("Connection lost");
      };
      const state = createImportPreviewState(rpc);

      await state.confirmImport("anilist");

      expect(state.error).toBe("Connection lost");
    });

    it("sets importing state during call", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 1, skipped: 0 } },
      });
      const state = createImportPreviewState(rpc);

      expect(state.importing).toBe(false);

      const promise = state.confirmImport("anilist");
      expect(state.importing).toBe(true);

      await promise;
      expect(state.importing).toBe(false);
    });
  });

  describe("reset", () => {
    it("clears all state", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(rpc);
      await state.loadPreview("anilist");

      state.linkEntry("tl-2", 5);
      state.resolveConflict("tl-3", "keepLocal");

      state.reset();

      expect(state.preview).toBeNull();
      expect(state.matched).toHaveLength(0);
      expect(state.unmatched).toHaveLength(0);
      expect(state.conflicts).toHaveLength(0);
      expect(state.linkSelections.size).toBe(0);
      expect(state.conflictSelections.size).toBe(0);
      expect(state.result).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
