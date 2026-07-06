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

function createTestFactory(credentials?: Record<string, string>): PluginFactory {
  const config = new ConfigManager();
  const credentialStore = new CredentialStore({
    keytar: createMockKeytar(credentials),
  });
  return new PluginFactory(config, credentialStore);
}

function mockAnilistFetch(
  listData: unknown = { data: { MediaListCollection: { lists: [] } } },
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string) as { query: string };
    if (body.query.includes("Viewer")) {
      return new Response(JSON.stringify({ data: { Viewer: { id: 1 } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify(listData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

describe("TrackerImportHandlers", () => {
  describe("getImportPreview", () => {
    it("returns preview for anilist tracker", async () => {
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.getImportPreview({ trackerName: "anilist" });

          expect(result.error).toBeUndefined();
          expect(result.preview).not.toBeNull();
          expect(result.preview?.totalEntries).toBe(0);
        });
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
      const factory = createTestFactory({
        "kogoro:anilist": JSON.stringify({ access_token: "test-token" }),
      });
      const { repo, close } = createLibraryRepository();
      const { repo: evtRepo, close: closeEvt } = createEventRepository();
      try {
        const libraryService = new LibraryService(repo, evtRepo);

        await withMockFetch(mockAnilistFetch() as unknown as typeof fetch, async () => {
          const handlers = createTrackerImportHandlers({
            libraryService,
            pluginFactory: factory,
          });
          const result = await handlers.confirmImport({ trackerName: "anilist" });

          expect(result.error).toBeUndefined();
          expect(result.result).not.toBeNull();
          expect(result.result?.imported).toBe(0);
        });
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
