import { describe, expect, it } from "bun:test";
import { ConfigManager, CredentialStore, LibraryService } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
  withMockFetch,
} from "@kogoro/core/testing";
import { PluginFactory } from "@kogoro/plugins";
import { createSyncHandlers } from "./sync";

function createTestSetup() {
  const config = new ConfigManager();
  const credentialStore = new CredentialStore({
    keytar: createMockKeytar(),
  });
  const pluginFactory = new PluginFactory(config, credentialStore);
  const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository();
  const { repo: eventsRepo, close: closeEvents } = createEventRepository();
  const libraryService = new LibraryService(libraryRepo, eventsRepo);

  return {
    config,
    credentialStore,
    pluginFactory,
    libraryService,
    eventsRepo,
    close: () => {
      closeEvents();
      closeLibrary();
    },
  };
}

const emptyAnilistResponse = (() =>
  new Response(JSON.stringify({ data: { MediaListCollection: { lists: [] } } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })) as unknown as typeof fetch;

describe("SyncHandlers", () => {
  describe("syncAll", () => {
    it("returns empty result when no trackers connected", async () => {
      const setup = createTestSetup();
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.syncAll();

        expect(result.applied).toBe(0);
        expect(result.conflicts).toHaveLength(0);
        expect(result.syncedTrackers).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
      } finally {
        setup.close();
      }
    });

    it("syncs connected anilist tracker", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        await withMockFetch(emptyAnilistResponse, async () => {
          const result = await handlers.syncAll();

          expect(result.syncedTrackers).toContain("anilist");
          expect(result.errors).toHaveLength(0);
        });
      } finally {
        setup.close();
      }
    });

    it("reports error when tracker plugin throws", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");
      try {
        const throwingPluginFactory = {
          ...setup.pluginFactory,
          tracker: async () => {
            throw new Error("Plugin initialization failed");
          },
        } as unknown as typeof setup.pluginFactory;

        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: throwingPluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.syncAll();

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.tracker).toBe("anilist");
        expect(result.errors[0]?.error).toContain("Plugin initialization failed");
      } finally {
        setup.close();
      }
    });
  });

  describe("syncAnime", () => {
    it("returns empty result when anime has no groups", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        await withMockFetch(emptyAnilistResponse, async () => {
          const result = await handlers.syncAnime({ animeId: "999" });

          expect(result.applied).toBe(0);
          expect(result.conflicts).toHaveLength(0);
        });
      } finally {
        setup.close();
      }
    });
  });

  describe("triggerManualSync", () => {
    it("delegates to syncAll", async () => {
      const setup = createTestSetup();
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.triggerManualSync();

        expect(result).toHaveProperty("applied");
        expect(result).toHaveProperty("conflicts");
        expect(result).toHaveProperty("syncedTrackers");
        expect(result).toHaveProperty("errors");
      } finally {
        setup.close();
      }
    });
  });

  describe("resolveSyncConflict", () => {
    it("returns false for unknown tracker source", async () => {
      const setup = createTestSetup();
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.resolveSyncConflict({
          conflict: {
            groupId: 1,
            tracker: "unknown",
            localChange: {
              eventType: "status_change",
              oldValue: "watching",
              newValue: "completed",
            },
            remoteChange: { watchStatus: "completed", episodesWatched: 24 },
          },
          resolution: "acceptRemote",
        });

        expect(result.success).toBe(false);
      } finally {
        setup.close();
      }
    });
  });
});
