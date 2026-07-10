import { describe, expect, it } from "bun:test";
import { createMockRPC } from "../../fixtures";
import { createImportPreviewState, type ImportPreviewState } from "./import-preview-state";

function snap(state: ImportPreviewState) {
  return state.snapshot();
}

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
      const state = createImportPreviewState(() => rpc);

      expect(snap(state).loading).toBe(false);

      const promise = state.loadPreview("anilist");
      expect(snap(state).loading).toBe(true);

      await promise;
      expect(snap(state).loading).toBe(false);
    });

    it("populates preview data on success", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).preview).not.toBeNull();
      expect(snap(state).preview?.totalEntries).toBe(3);
      expect(snap(state).preview?.matchedCount).toBe(1);
      expect(snap(state).preview?.unmatchedCount).toBe(1);
      expect(snap(state).preview?.conflictCount).toBe(1);
      expect(snap(state).matched).toHaveLength(1);
      expect(snap(state).matched[0]?.title).toBe("Attack on Titan");
      expect(snap(state).matched[0]?.matchStatus).toBe("matched");
      expect(snap(state).unmatched).toHaveLength(1);
      expect(snap(state).unmatched[0]?.title).toBe("Death Note");
      expect(snap(state).unmatched[0]?.matchStatus).toBe("unmatched");
      expect(snap(state).conflicts).toHaveLength(1);
      expect(snap(state).conflicts[0]?.title).toBe("Naruto");
      expect(snap(state).conflicts[0]?.matchStatus).toBe("conflict");
      expect(snap(state).conflicts[0]?.localWatchStatus).toBe("watching");
    });

    it("sets default activeTab to conflicts when conflicts exist", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).activeTab).toBe("conflicts");
    });

    it("sets default activeTab to new when no conflicts but unmatched exist", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse({
          conflicts: [],
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
        }),
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).activeTab).toBe("new");
    });

    it("sets default activeTab to matched when no conflicts or unmatched", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse({
          unmatched: [],
          conflicts: [],
        }),
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).activeTab).toBe("matched");
    });

    it("sets error when RPC returns error", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null, error: "Tracker not connected" },
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).error).toBe("Tracker not connected");
      expect(snap(state).preview).toBeNull();
    });

    it("sets error when preview is null", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null },
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).error).toBe("No preview data received");
    });

    it("sets error on RPC failure", async () => {
      const rpc = createMockRPC({});
      rpc.request = async () => {
        throw new Error("Network error");
      };
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");

      expect(snap(state).error).toBe("Network error");
    });

    it("clears previous error on new load", async () => {
      const rpc = createMockRPC({
        getImportPreview: { preview: null, error: "Failed" },
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("anilist");
      expect(snap(state).error).toBe("Failed");

      rpc.request = async () => makePreviewResponse();
      await state.loadPreview("anilist");
      expect(snap(state).error).toBeNull();
    });

    it("sends correct RPC params", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);

      await state.loadPreview("kitsu");

      expect(rpc.calls[0]?.method).toBe("getImportPreview");
      expect(rpc.calls[0]?.params).toEqual({ trackerName: "kitsu" });
    });
  });

  describe("setActiveTab", () => {
    it("changes active tab", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.setActiveTab("matched");
      expect(snap(state).activeTab).toBe("matched");

      state.setActiveTab("new");
      expect(snap(state).activeTab).toBe("new");

      state.setActiveTab("conflicts");
      expect(snap(state).activeTab).toBe("conflicts");
    });
  });

  describe("resolveConflict", () => {
    it("adds a conflict resolution", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");

      expect(snap(state).conflictSelections.get("tl-3")).toBe("keepLocal");
    });

    it("overwrites previous resolution for same tracker", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");
      state.resolveConflict("tl-3", "acceptTracker");

      expect(snap(state).conflictSelections.get("tl-3")).toBe("acceptTracker");
    });
  });

  describe("bulkResolveConflicts", () => {
    it("resolves all unresolved conflicts", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.bulkResolveConflicts("keepLocal");

      expect(snap(state).conflictSelections.get("tl-3")).toBe("keepLocal");
      expect(snap(state).conflictSelections.size).toBe(1);
    });

    it("does not overwrite existing resolutions", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "acceptTracker");
      state.bulkResolveConflicts("keepLocal");

      expect(snap(state).conflictSelections.get("tl-3")).toBe("acceptTracker");
    });
  });

  describe("confirmImport", () => {
    it("calls RPC with tracker name", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(() => rpc);

      await state.confirmImport("anilist");

      expect(rpc.calls[0]?.method).toBe("confirmImport");
      expect(rpc.calls[0]?.params).toEqual({ trackerName: "anilist" });
    });

    it("includes conflict selections and unmatched entries", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");

      await state.confirmImport("anilist");

      const params = rpc.calls[1]?.params as {
        trackerName: string;
        selections: Array<{
          trackerId: string;
          resolution?: string;
        }>;
      };
      expect(params.selections).toHaveLength(2);
      expect(params.selections.find((s) => s.trackerId === "tl-3")).toEqual({
        trackerId: "tl-3",
        resolution: "keepLocal",
      });
      expect(params.selections.find((s) => s.trackerId === "tl-2")).toEqual({
        trackerId: "tl-2",
        resolution: undefined,
      });
    });

    it("includes unmatched entries even without user decisions", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      await state.confirmImport("anilist");

      const params = rpc.calls[1]?.params as {
        trackerName: string;
        selections?: Array<{ trackerId: string }>;
      };
      expect(params.selections).toHaveLength(1);
      expect(params.selections?.[0]?.trackerId).toBe("tl-2");
    });

    it("sets result on success", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 2, skipped: 1 } },
      });
      const state = createImportPreviewState(() => rpc);

      await state.confirmImport("anilist");

      expect(snap(state).result).toEqual({ imported: 2, skipped: 1 });
    });

    it("sets error when RPC returns error", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: null, error: "Import failed" },
      });
      const state = createImportPreviewState(() => rpc);

      await state.confirmImport("anilist");

      expect(snap(state).error).toBe("Import failed");
    });

    it("sets error on RPC failure", async () => {
      const rpc = createMockRPC({});
      rpc.request = async () => {
        throw new Error("Connection lost");
      };
      const state = createImportPreviewState(() => rpc);

      await state.confirmImport("anilist");

      expect(snap(state).error).toBe("Connection lost");
    });

    it("sets importPhase during call", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: { imported: 1, skipped: 0 } },
      });
      const state = createImportPreviewState(() => rpc);

      expect(snap(state).importPhase).toBe("preview");

      const promise = state.confirmImport("anilist");
      expect(snap(state).importPhase).toBe("importing");

      await promise;
      expect(snap(state).importPhase).toBe("success");
    });

    it("sets importPhase to error on failure", async () => {
      const rpc = createMockRPC({
        confirmImport: { result: null, error: "Failed" },
      });
      const state = createImportPreviewState(() => rpc);

      await state.confirmImport("anilist");

      expect(snap(state).importPhase).toBe("error");
    });
  });

  describe("reset", () => {
    it("clears all state", async () => {
      const rpc = createMockRPC({
        getImportPreview: makePreviewResponse(),
        confirmImport: { result: { imported: 3, skipped: 0 } },
      });
      const state = createImportPreviewState(() => rpc);
      await state.loadPreview("anilist");

      state.resolveConflict("tl-3", "keepLocal");

      state.reset();

      expect(snap(state).preview).toBeNull();
      expect(snap(state).matched).toHaveLength(0);
      expect(snap(state).conflicts).toHaveLength(0);
      expect(snap(state).unmatched).toHaveLength(0);
      expect(snap(state).conflictSelections.size).toBe(0);
      expect(snap(state).result).toBeNull();
      expect(snap(state).error).toBeNull();
      expect(snap(state).activeTab).toBe("matched");
      expect(snap(state).importPhase).toBe("preview");
    });
  });
});
