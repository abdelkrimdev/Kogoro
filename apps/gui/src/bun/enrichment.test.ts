import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CacheService, DatabasePlugin } from "@kogoro/core";
import { ConfigManager, CredentialStore, LibraryService } from "@kogoro/core";
import {
  createArtworkDb,
  createEventRepository,
  createLibraryRepository,
  createMatchCacheService,
  createMockTracker,
  createTrackingEnrichmentSend,
  hashFile,
  makeCachedMatch,
  mockFetch,
  noopEnrichmentSend,
  testImageBytes,
  withMockFetch,
  withTempDir,
  writeTempFile,
} from "@kogoro/core/testing";
import { createEnrichmentHandlers } from "./enrichment";

function createLibraryService(dir: string): {
  svc: LibraryService;
  close: () => void;
} {
  const { repo, close } = createLibraryRepository(dir);
  const { repo: evtRepo, close: closeEvt } = createEventRepository(dir);
  return {
    svc: new LibraryService(repo, evtRepo),
    close: () => {
      closeEvt();
      close();
    },
  };
}

async function seedLibraryAndCache(
  configDir: string,
  mediaDir: string,
  cacheService: CacheService,
): Promise<{ animeId: number }> {
  mkdirSync(mediaDir, { recursive: true });

  const ep1Path = writeTempFile(mediaDir, "S01E01.mkv", "video content 1");
  const ep2Path = writeTempFile(mediaDir, "S01E02.mkv", "video content 2");

  const { repo: libraryRepo, close: closeLibrary } = createLibraryRepository(configDir);
  const anime = libraryRepo.upsertAnime({
    externalId: "tvdb-12345",
    sourceDb: "tvdb",
    title: "Test Anime",
    episodeCount: 2,
  });

  const group = libraryRepo.upsertEpisodeGroup({
    animeId: anime.id,
    entryType: "tv",
    seasonNumber: 1,
    watchStatus: "plan_to_watch",
  });

  libraryRepo.addEpisode({
    animeId: anime.id,
    groupId: group.id,
    episodeNumber: 1,
    filePath: ep1Path,
    title: "Episode 1",
    season: 1,
    watched: false,
  });
  libraryRepo.addEpisode({
    animeId: anime.id,
    groupId: group.id,
    episodeNumber: 2,
    filePath: ep2Path,
    title: "Episode 2",
    season: 1,
    watched: false,
  });
  closeLibrary();

  for (const filePath of [ep1Path, ep2Path]) {
    const hash = await hashFile(filePath);
    cacheService.set(hash, makeCachedMatch({ animeId: "tvdb-12345", entryType: "tv" }));
  }

  return { animeId: anime.id };
}

describe("enrichArtwork", () => {
  test("fails when anime is not found in library", async () => {
    await withTempDir("enrich-artwork-unknown", async (dir) => {
      const { svc, close } = createLibraryService(dir);
      const configManager = new ConfigManager({ configDir: dir });
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichArtwork({ id: "99999" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Anime not found in library");
      closeCache();
      close();
    });
  });

  test("fails when no episode files found", async () => {
    await withTempDir("enrich-artwork-no-episodes", async (dir) => {
      const { repo: libraryRepo } = createLibraryRepository(dir);
      const anime = libraryRepo.upsertAnime({
        externalId: "tvdb-12345",
        sourceDb: "tvdb",
        title: "Empty Anime",
        episodeCount: 0,
      });

      const { svc, close } = createLibraryService(dir);
      const configManager = new ConfigManager({ configDir: dir });
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichArtwork({ id: String(anime.id) });
      expect(result.success).toBe(false);
      expect(result.error).toBe("No episode files found for this anime");
      closeCache();
      close();
    });
  });

  test("fails when no database plugin available", async () => {
    const savedEnv = process.env["KOGORO_TVDB_KEY"];
    delete process.env["KOGORO_TVDB_KEY"];
    try {
      await withTempDir("enrich-artwork-no-db", async (dir) => {
        const mediaDir = join(dir, "media");
        const { cacheService, close: closeCache } = createMatchCacheService(dir);
        const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

        const { svc, close } = createLibraryService(dir);
        const configManager = new ConfigManager({ configDir: dir });
        const handlers = createEnrichmentHandlers({
          configManager,
          send: noopEnrichmentSend,
          libraryService: svc,
          cacheService,
        });

        const result = await handlers.enrichArtwork({ id: String(animeId) });
        expect(result.success).toBe(false);
        expect(result.error).toBe("No database plugin available — check API key configuration");
        closeCache();
        close();
      });
    } finally {
      if (savedEnv !== undefined) {
        process.env["KOGORO_TVDB_KEY"] = savedEnv;
      }
    }
  });

  test("downloads artwork and updates cover_path", async () => {
    await withTempDir("enrich-artwork-download", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const artworkDb: DatabasePlugin = {
        ...createArtworkDb([
          {
            id: "poster1",
            type: "poster",
            url: "https://example.com/poster.jpg",
            width: 1000,
            height: 1420,
          },
        ]),
      };

      const configManager = new ConfigManager({ configDir: dir });

      await withMockFetch(
        mockFetch(testImageBytes, 200, "image/jpeg") as typeof globalThis.fetch,
        async () => {
          const { svc, close } = createLibraryService(dir);
          const handlers = createEnrichmentHandlers({
            configManager,
            send: noopEnrichmentSend,
            libraryService: svc,
            cacheService,
            database: artworkDb,
          });

          const result = await handlers.enrichArtwork({ id: String(animeId) });
          expect(result.success).toBe(true);
          expect(result.summary?.downloaded).toBe(1);
          expect(result.summary?.total).toBe(1);
          close();
        },
      );

      const { repo: libraryRepo, close } = createLibraryRepository(dir);
      const anime = libraryRepo.getAnime(animeId);
      expect(anime?.coverArtPath).toContain("cover.jpg");
      close();
      closeCache();
    });
  });

  test("emits progress events", async () => {
    await withTempDir("enrich-artwork-progress", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const artworkDb: DatabasePlugin = {
        ...createArtworkDb([
          {
            id: "poster1",
            type: "poster",
            url: "https://example.com/poster.jpg",
            width: 500,
            height: 700,
          },
        ]),
      };

      const configManager = new ConfigManager({ configDir: dir });
      const progressEvents: Array<{ completed: number; total: number; status: string }> = [];

      await withMockFetch(
        mockFetch(testImageBytes, 200, "image/jpeg") as typeof globalThis.fetch,
        async () => {
          const { svc, close } = createLibraryService(dir);
          const handlers = createEnrichmentHandlers({
            configManager,
            send: createTrackingEnrichmentSend(progressEvents),
            libraryService: svc,
            cacheService,
            database: artworkDb,
          });

          await handlers.enrichArtwork({ id: String(animeId) });
          close();
        },
      );

      expect(progressEvents.length).toBeGreaterThanOrEqual(1);
      const last = progressEvents[progressEvents.length - 1];
      expect(last?.status).toBe("downloaded");
      closeCache();
    });
  });

  test("handles no artwork found from database", async () => {
    await withTempDir("enrich-artwork-no-artwork", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const artworkDb: DatabasePlugin = {
        ...createArtworkDb([]),
      };

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        database: artworkDb,
      });

      const result = await handlers.enrichArtwork({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.noArtwork).toBe(1);
      expect(result.summary?.downloaded).toBe(0);
      closeCache();
      close();
    });
  });
});

describe("enrichMetadata", () => {
  test("fails when anime is not found in library", async () => {
    await withTempDir("enrich-metadata-unknown", async (dir) => {
      const { svc, close } = createLibraryService(dir);
      const configManager = new ConfigManager({ configDir: dir });
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichMetadata({ id: "99999" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Anime not found in library");
      closeCache();
      close();
    });
  });

  test("writes NFO files for episodes", async () => {
    await withTempDir("enrich-metadata-write", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichMetadata({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.written).toBe(2);

      const { readFileSync, existsSync } = await import("node:fs");
      expect(existsSync(join(mediaDir, "S01E01.nfo"))).toBe(true);
      expect(existsSync(join(mediaDir, "S01E02.nfo"))).toBe(true);

      const nfo1 = readFileSync(join(mediaDir, "S01E01.nfo"), "utf-8");
      expect(nfo1).toContain("<episodedetails>");
      expect(nfo1).toContain("<episode>1</episode>");
      closeCache();
      close();
    });
  });

  test("emits progress events", async () => {
    await withTempDir("enrich-metadata-progress", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const configManager = new ConfigManager({ configDir: dir });
      const progressEvents: Array<{ completed: number; total: number; status: string }> = [];

      const { svc, close } = createLibraryService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: createTrackingEnrichmentSend(progressEvents),
        libraryService: svc,
        cacheService,
        database: createArtworkDb([]),
      });

      await handlers.enrichMetadata({ id: String(animeId) });

      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      const last = progressEvents[progressEvents.length - 1];
      expect(last?.status).toBe("written");
      closeCache();
      close();
    });
  });

  test("works without database plugin", async () => {
    await withTempDir("enrich-metadata-no-db", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
      });

      const result = await handlers.enrichMetadata({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.written).toBe(2);
      closeCache();
      close();
    });
  });
});

describe("enrichTracker", () => {
  test("fails when anime is not found in library", async () => {
    await withTempDir("enrich-tracker-unknown", async (dir) => {
      const { svc, close } = createLibraryService(dir);
      const configManager = new ConfigManager({ configDir: dir });
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
      });

      const result = await handlers.enrichTracker({ id: "99999" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Anime not found in library");
      closeCache();
      close();
    });
  });

  test("returns success with zero summary when no pluginFactory", async () => {
    await withTempDir("enrich-tracker-no-factory", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);
      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
      });

      const result = await handlers.enrichTracker({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.total).toBe(0);
      closeCache();
      close();
    });
  });

  test("skips groups with no tracker mappings", async () => {
    await withTempDir("enrich-tracker-no-mappings", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);
      const credentialStore = new CredentialStore();
      const mockTracker = createMockTracker();
      const mockPluginFactory = {
        tracker: async () => mockTracker,
      } as never;

      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        pluginFactory: mockPluginFactory,
        credentialStore,
      });

      const result = await handlers.enrichTracker({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.total).toBe(0);
      expect(result.summary?.skipped).toBe(1);
      closeCache();
      close();
    });
  });

  test("merges synopsis and rating from connected tracker", async () => {
    await withTempDir("enrich-tracker-merge", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const { repo: libraryRepo } = createLibraryRepository(dir);
      const groups = libraryRepo.getEpisodeGroupsByAnimeId(animeId);
      const [group] = groups;
      expect(group).toBeDefined();
      libraryRepo.upsertGroupTrackerMapping({
        groupId: group?.id as number,
        source: "anilist",
        externalId: "anilist-123",
      });

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);

      const credentialStore = new CredentialStore();
      await credentialStore.setCredential("anilist", "test-token");

      const mockTracker = createMockTracker({
        getAnimeDetails: async () => ({
          trackerId: "anilist-123",
          title: "Test Anime",
          entryType: "tv" as const,
          synopsis: "A great anime about testing",
          rating: 8.5,
        }),
      });
      const mockPluginFactory = {
        tracker: async () => mockTracker,
      } as never;

      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        pluginFactory: mockPluginFactory,
        credentialStore,
      });

      const result = await handlers.enrichTracker({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.enriched).toBe(1);

      const updatedGroup = libraryRepo.getEpisodeGroup(group?.id as number);
      expect(updatedGroup?.synopsis).toBe("A great anime about testing");
      expect(updatedGroup?.rating).toBe(8.5);
      closeCache();
      close();
    });
  });

  test("skips disconnected trackers", async () => {
    const savedEnv = process.env["KOGORO_ANILIST_KEY"];
    delete process.env["KOGORO_ANILIST_KEY"];
    try {
      await withTempDir("enrich-tracker-disconnected", async (dir) => {
        const mediaDir = join(dir, "media");
        const { cacheService, close: closeCache } = createMatchCacheService(dir);
        const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

        const { repo: libraryRepo } = createLibraryRepository(dir);
        const groups = libraryRepo.getEpisodeGroupsByAnimeId(animeId);
        const [group] = groups;
        expect(group).toBeDefined();
        libraryRepo.upsertGroupTrackerMapping({
          groupId: group?.id as number,
          source: "anilist",
          externalId: "anilist-123",
        });

        const configManager = new ConfigManager({ configDir: dir });
        const { svc, close } = createLibraryService(dir);

        const credentialStore = new CredentialStore();
        const mockTracker = createMockTracker();
        const mockPluginFactory = {
          tracker: async () => mockTracker,
        } as never;

        const handlers = createEnrichmentHandlers({
          configManager,
          send: noopEnrichmentSend,
          libraryService: svc,
          cacheService,
          pluginFactory: mockPluginFactory,
          credentialStore,
        });

        const result = await handlers.enrichTracker({ id: String(animeId) });
        expect(result.success).toBe(true);
        expect(result.summary?.total).toBe(1);
        expect(result.summary?.skipped).toBe(1);
        expect(result.summary?.enriched).toBe(0);
        closeCache();
        close();
      });
    } finally {
      if (savedEnv !== undefined) {
        process.env["KOGORO_ANILIST_KEY"] = savedEnv;
      }
    }
  });

  test("does not overwrite existing synopsis with empty", async () => {
    await withTempDir("enrich-tracker-no-overwrite", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const { repo: libraryRepo } = createLibraryRepository(dir);
      const groups = libraryRepo.getEpisodeGroupsByAnimeId(animeId);
      const [group] = groups;
      expect(group).toBeDefined();
      libraryRepo.upsertGroupTrackerMapping({
        groupId: group?.id as number,
        source: "anilist",
        externalId: "anilist-123",
      });
      libraryRepo.updateEpisodeGroupMetadata(group?.id as number, {
        synopsis: "Existing synopsis",
      });

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);

      const credentialStore = new CredentialStore();
      await credentialStore.setCredential("anilist", "test-token");

      const mockTracker = createMockTracker({
        getAnimeDetails: async () => ({
          trackerId: "anilist-123",
          title: "Test Anime",
          entryType: "tv" as const,
        }),
      });
      const mockPluginFactory = {
        tracker: async () => mockTracker,
      } as never;

      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        pluginFactory: mockPluginFactory,
        credentialStore,
      });

      const result = await handlers.enrichTracker({ id: String(animeId) });
      expect(result.success).toBe(true);

      const updatedGroup = libraryRepo.getEpisodeGroup(group?.id as number);
      expect(updatedGroup?.synopsis).toBe("Existing synopsis");
      closeCache();
      close();
    });
  });

  test("handles tracker plugin errors gracefully", async () => {
    await withTempDir("enrich-tracker-error", async (dir) => {
      const mediaDir = join(dir, "media");
      const { cacheService, close: closeCache } = createMatchCacheService(dir);
      const { animeId } = await seedLibraryAndCache(dir, mediaDir, cacheService);

      const { repo: libraryRepo } = createLibraryRepository(dir);
      const groups = libraryRepo.getEpisodeGroupsByAnimeId(animeId);
      const [group] = groups;
      expect(group).toBeDefined();
      libraryRepo.upsertGroupTrackerMapping({
        groupId: group?.id as number,
        source: "anilist",
        externalId: "anilist-123",
      });

      const configManager = new ConfigManager({ configDir: dir });
      const { svc, close } = createLibraryService(dir);

      const credentialStore = new CredentialStore();
      await credentialStore.setCredential("anilist", "test-token");

      const mockTracker = createMockTracker({
        getAnimeDetails: async () => {
          throw new Error("API error");
        },
      });
      const mockPluginFactory = {
        tracker: async () => mockTracker,
      } as never;

      const handlers = createEnrichmentHandlers({
        configManager,
        send: noopEnrichmentSend,
        libraryService: svc,
        cacheService,
        pluginFactory: mockPluginFactory,
        credentialStore,
      });

      const result = await handlers.enrichTracker({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.errors).toBe(1);
      expect(result.summary?.enriched).toBe(0);
      closeCache();
      close();
    });
  });
});
