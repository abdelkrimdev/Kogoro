import { describe, expect, it } from "bun:test";
import { CredentialStore, LibraryService } from "@kogoro/core";
import { createLibraryRepository, createMockKeytar } from "@kogoro/core/testing";
import { createTrackerImportHandlers } from "./tracker-import";

describe("TrackerImportHandlers", () => {
  describe("getImportPreview", () => {
    it("returns error when tracker is not connected", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const libraryService = new LibraryService(repo);
        const credentialStore = new CredentialStore({ keytar: null });
        const handlers = createTrackerImportHandlers({ libraryService, credentialStore });

        const result = await handlers.getImportPreview({ trackerName: "anilist" });

        expect(result.preview).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        close();
      }
    });

    it("returns preview with matched and unmatched entries", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const libraryService = new LibraryService(repo);

        libraryService.upsertAnime({
          externalId: "tvdb-123",
          sourceDb: "tvdb",
          title: "Attack on Titan",
          episodeCount: 25,
        });

        const credentialStore = new CredentialStore({
          keytar: createMockKeytar({ "kogoro:anilist": "test-token" }),
        });
        const handlers = createTrackerImportHandlers({ libraryService, credentialStore });

        const result = await handlers.getImportPreview({ trackerName: "anilist" });

        expect(result.error).toBeUndefined();
        expect(result.preview).not.toBeNull();
        expect(result.preview?.totalEntries).toBe(0);
      } finally {
        close();
      }
    });
  });

  describe("confirmImport", () => {
    it("returns error when tracker is not connected", async () => {
      const { repo, close } = createLibraryRepository();
      try {
        const libraryService = new LibraryService(repo);
        const credentialStore = new CredentialStore({ keytar: null });
        const handlers = createTrackerImportHandlers({ libraryService, credentialStore });

        const result = await handlers.confirmImport({ trackerName: "anilist" });

        expect(result.result).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        close();
      }
    });
  });
});
