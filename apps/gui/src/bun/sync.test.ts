import { describe, expect, it } from "bun:test";
import { ConfigManager, CredentialStore, LibraryService } from "@kogoro/core";
import {
  createEventRepository,
  createLibraryRepository,
  createMockKeytar,
  createMockTracker,
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
  new Response(
    JSON.stringify({
      data: { Viewer: { id: 1 }, MediaListCollection: { lists: [] } },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  )) as unknown as typeof fetch;

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
      await setup.credentialStore.setCredential(
        "anilist",
        JSON.stringify({ access_token: "test-token" }),
      );
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

  describe("pushAnime", () => {
    it("returns zero pushed when no trackers connected", async () => {
      const setup = createTestSetup();
      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: setup.pluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.pushAnime({ groupId: "1" });

        expect(result.pushed).toBe(0);
        expect(result.errors).toHaveLength(0);
      } finally {
        setup.close();
      }
    });

    it("pushes unpushed events for a mapped group", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");

      const anime = setup.libraryService.upsertAnime({
        externalId: "tvdb-1",
        sourceDb: "tvdb",
        title: "Frieren",
        episodeCount: 28,
      });

      const group = setup.libraryService.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: "tv",
        seasonNumber: 1,
        watchStatus: "watching",
      });

      setup.libraryService.upsertGroupTrackerMapping({
        groupId: group.id,
        source: "anilist",
        externalId: "al-1",
      });

      setup.eventsRepo.append({
        entityType: "group",
        entityId: group.id,
        eventType: "status_change",
        oldValue: "watching",
        newValue: "completed",
      });

      let updateCalled = false;
      const mockTracker = createMockTracker({
        updateEntry: async () => {
          updateCalled = true;
        },
      });

      const mockPluginFactory = {
        ...setup.pluginFactory,
        tracker: async () => mockTracker,
      } as unknown as typeof setup.pluginFactory;

      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: mockPluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.pushAnime({ groupId: String(group.id) });

        expect(result.pushed).toBeGreaterThan(0);
        expect(updateCalled).toBe(true);
        expect(result.errors).toHaveLength(0);
      } finally {
        setup.close();
      }
    });

    it("skips groups with no tracker mapping", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");

      const anime = setup.libraryService.upsertAnime({
        externalId: "tvdb-2",
        sourceDb: "tvdb",
        title: "Mushishi",
        episodeCount: 26,
      });

      const group = setup.libraryService.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: "tv",
        seasonNumber: 1,
        watchStatus: "watching",
      });

      let updateCalled = false;
      const mockTracker = createMockTracker({
        updateEntry: async () => {
          updateCalled = true;
        },
      });

      const mockPluginFactory = {
        ...setup.pluginFactory,
        tracker: async () => mockTracker,
      } as unknown as typeof setup.pluginFactory;

      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: mockPluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.pushAnime({ groupId: String(group.id) });

        expect(result.pushed).toBe(0);
        expect(updateCalled).toBe(false);
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
            animeTitle: "Test Anime",
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

  describe("conflict enrichment", () => {
    it("enriches conflicts with anime titles", async () => {
      const setup = createTestSetup();
      await setup.credentialStore.setCredential("anilist", "test-token");

      const anime = setup.libraryService.upsertAnime({
        externalId: "tracker-tl-1",
        sourceDb: "anilist",
        title: "Attack on Titan",
        episodeCount: 25,
      });

      const group = setup.libraryService.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: "tv",
        seasonNumber: 1,
        watchStatus: "watching",
      });

      setup.libraryService.upsertGroupTrackerMapping({
        groupId: group.id,
        source: "anilist",
        externalId: "tl-1",
      });

      setup.eventsRepo.append({
        entityType: "group",
        entityId: group.id,
        eventType: "status_change",
        oldValue: "watching",
        newValue: "completed",
      });

      const mockTracker = createMockTracker({
        async getUserList() {
          return [
            {
              source: "anilist",
              trackerId: "tl-1",
              title: "Attack on Titan",
              entryType: "tv",
              watchStatus: "completed" as const,
              episodesWatched: 25,
              totalEpisodes: 25,
            },
          ];
        },
      });

      const mockPluginFactory = {
        ...setup.pluginFactory,
        tracker: async () => mockTracker,
      } as unknown as typeof setup.pluginFactory;

      try {
        const handlers = createSyncHandlers({
          libraryService: setup.libraryService,
          eventsRepo: setup.eventsRepo,
          pluginFactory: mockPluginFactory,
          credentialStore: setup.credentialStore,
        });

        const result = await handlers.syncAll();

        expect(result.conflicts).toHaveLength(1);
        expect(result.conflicts[0]?.animeTitle).toBe("Attack on Titan");
        expect(result.conflicts[0]?.tracker).toBe("anilist");
        expect(result.conflicts[0]?.localChange.newValue).toBe("completed");
        expect(result.conflicts[0]?.remoteChange.watchStatus).toBe("completed");
      } finally {
        setup.close();
      }
    });
  });
});
