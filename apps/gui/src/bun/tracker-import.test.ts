import { describe, expect, it } from "bun:test";
import { ConfigManager, CredentialStore, LibraryService } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
  withMockFetch,
} from "@kogoro/core/testing";
import { PluginFactory } from "@kogoro/plugins";
import { createTrackerImportHandlers } from "./tracker-import";

function createTestFactory(keytar?: Record<string, string>): PluginFactory {
  const config = new ConfigManager();
  const credentialStore = new CredentialStore({
    keytar: keytar ? createMockKeytar(keytar) : null,
  });
  return new PluginFactory(config, credentialStore);
}

describe("TrackerImportHandlers", () => {
  describe("getImportPreview", () => {
    it("returns preview for anilist tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(
          (() =>
            new Response(JSON.stringify({ data: { MediaListCollection: { lists: [] } } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })) as unknown as typeof fetch,
          async () => {
            const handlers = createTrackerImportHandlers({
              libraryService,
              pluginFactory: factory,
            });
            const result = await handlers.getImportPreview({ trackerName: "anilist" });

            expect(result.error).toBeUndefined();
            expect(result.preview).not.toBeNull();
            expect(result.preview?.totalEntries).toBe(0);
          },
        );
      } finally {
        closeEvt();
        close();
      }
    });

    it("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);
        const handlers = createTrackerImportHandlers({ libraryService, pluginFactory: factory });

        const result = await handlers.getImportPreview({ trackerName: "nonexistent" });

        expect(result.preview).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });
  });

  describe("confirmImport", () => {
    it("returns result for anilist tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(
          (() =>
            new Response(JSON.stringify({ data: { MediaListCollection: { lists: [] } } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })) as unknown as typeof fetch,
          async () => {
            const handlers = createTrackerImportHandlers({
              libraryService,
              pluginFactory: factory,
            });
            const result = await handlers.confirmImport({ trackerName: "anilist" });

            expect(result.error).toBeUndefined();
            expect(result.result).not.toBeNull();
            expect(result.result?.imported).toBe(0);
          },
        );
      } finally {
        closeEvt();
        close();
      }
    });

    it("returns error for unknown tracker", async () => {
      const factory = createTestFactory();
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);
        const handlers = createTrackerImportHandlers({ libraryService, pluginFactory: factory });

        const result = await handlers.confirmImport({ trackerName: "nonexistent" });

        expect(result.result).toBeNull();
        expect(result.error).toContain("not connected");
      } finally {
        closeEvt();
        close();
      }
    });
  });
});
