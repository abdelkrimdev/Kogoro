import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { DatabasePlugin } from "@kogoro/core";
import {
  ConfigManager,
  createArtworkDb,
  createLibraryDb,
  createSilentCredentialStore,
  createTrackingEnrichmentSend,
  MatchCache,
  makeCachedMatch,
  mockFetch,
  noopEnrichmentSend,
  testImageBytes,
  withMockFetch,
  withTempDir,
  writeTempFile,
} from "@kogoro/core";
import { createEnrichmentHandlers } from "./enrichment";

async function seedLibraryAndCache(
  configDir: string,
  mediaDir: string,
): Promise<{ animeId: number }> {
  const cacheDbPath = join(configDir, "match-cache.db");

  mkdirSync(mediaDir, { recursive: true });

  const ep1Path = writeTempFile(mediaDir, "S01E01.mkv", "video content 1");
  const ep2Path = writeTempFile(mediaDir, "S01E02.mkv", "video content 2");

  const db = createLibraryDb(configDir);
  const anime = db.upsertAnime({
    externalId: "tvdb-12345",
    sourceDb: "tvdb",
    title: "Test Anime",
    entryType: "tv",
    episodeCount: 2,
  });
  db.addEpisode({
    animeId: anime.id,
    episodeNumber: 1,
    filePath: ep1Path,
    title: "Episode 1",
    season: 1,
  });
  db.addEpisode({
    animeId: anime.id,
    episodeNumber: 2,
    filePath: ep2Path,
    title: "Episode 2",
    season: 1,
  });
  db.close();

  const cache = new MatchCache({ dbPath: cacheDbPath });
  for (const filePath of [ep1Path, ep2Path]) {
    const hash = await MatchCache.hashFile(filePath);
    cache.set(hash, makeCachedMatch({ animeId: "tvdb-12345", entryType: "tv" }));
  }

  return { animeId: anime.id };
}

describe("enrichArtwork", () => {
  test("fails when anime is not found in library", async () => {
    await withTempDir("enrich-artwork-unknown", async (dir) => {
      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichArtwork({ id: "99999" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Anime not found in library");
    });
  });

  test("fails when no episode files found", async () => {
    await withTempDir("enrich-artwork-no-episodes", async (dir) => {
      const db = createLibraryDb(dir);
      const anime = db.upsertAnime({
        externalId: "tvdb-12345",
        sourceDb: "tvdb",
        title: "Empty Anime",
        entryType: "tv",
        episodeCount: 0,
      });
      db.close();

      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichArtwork({ id: String(anime.id) });
      expect(result.success).toBe(false);
      expect(result.error).toBe("No episode files found for this anime");
    });
  });

  test("fails when no database plugin available", async () => {
    const savedEnv = process.env["KOGORO_TVDB_KEY"];
    delete process.env["KOGORO_TVDB_KEY"];
    try {
      await withTempDir("enrich-artwork-no-db", async (dir) => {
        const mediaDir = join(dir, "media");
        const { animeId } = await seedLibraryAndCache(dir, mediaDir);

        const configManager = new ConfigManager({ configDir: dir });
        const handlers = createEnrichmentHandlers({
          configManager,
          credentialStore: createSilentCredentialStore(),
          configDir: dir,
          send: noopEnrichmentSend,
        });

        const result = await handlers.enrichArtwork({ id: String(animeId) });
        expect(result.success).toBe(false);
        expect(result.error).toBe("No database plugin available — check API key configuration");
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
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

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
          const handlers = createEnrichmentHandlers({
            configManager,
            credentialStore: createSilentCredentialStore(),
            configDir: dir,
            send: noopEnrichmentSend,
            database: artworkDb,
          });

          const result = await handlers.enrichArtwork({ id: String(animeId) });
          expect(result.success).toBe(true);
          expect(result.summary?.downloaded).toBe(1);
          expect(result.summary?.total).toBe(1);
        },
      );

      const db = createLibraryDb(dir);
      const anime = db.getAnime(animeId);
      expect(anime?.coverArtPath).toContain("cover.jpg");
      db.close();
    });
  });

  test("emits progress events", async () => {
    await withTempDir("enrich-artwork-progress", async (dir) => {
      const mediaDir = join(dir, "media");
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

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
          const handlers = createEnrichmentHandlers({
            configManager,
            credentialStore: createSilentCredentialStore(),
            configDir: dir,
            send: createTrackingEnrichmentSend(progressEvents),
            database: artworkDb,
          });

          await handlers.enrichArtwork({ id: String(animeId) });
        },
      );

      expect(progressEvents.length).toBeGreaterThanOrEqual(1);
      const last = progressEvents[progressEvents.length - 1];
      expect(last?.status).toBe("downloaded");
    });
  });

  test("handles no artwork found from database", async () => {
    await withTempDir("enrich-artwork-no-artwork", async (dir) => {
      const mediaDir = join(dir, "media");
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

      const artworkDb: DatabasePlugin = {
        ...createArtworkDb([]),
      };

      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
        database: artworkDb,
      });

      const result = await handlers.enrichArtwork({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.noArtwork).toBe(1);
      expect(result.summary?.downloaded).toBe(0);
    });
  });
});

describe("enrichMetadata", () => {
  test("fails when anime is not found in library", async () => {
    await withTempDir("enrich-metadata-unknown", async (dir) => {
      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
        database: createArtworkDb([]),
      });

      const result = await handlers.enrichMetadata({ id: "99999" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Anime not found in library");
    });
  });

  test("writes NFO files for episodes", async () => {
    await withTempDir("enrich-metadata-write", async (dir) => {
      const mediaDir = join(dir, "media");
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
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
    });
  });

  test("emits progress events", async () => {
    await withTempDir("enrich-metadata-progress", async (dir) => {
      const mediaDir = join(dir, "media");
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

      const configManager = new ConfigManager({ configDir: dir });
      const progressEvents: Array<{ completed: number; total: number; status: string }> = [];

      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: createTrackingEnrichmentSend(progressEvents),
        database: createArtworkDb([]),
      });

      await handlers.enrichMetadata({ id: String(animeId) });

      expect(progressEvents.length).toBeGreaterThanOrEqual(2);
      const last = progressEvents[progressEvents.length - 1];
      expect(last?.status).toBe("written");
    });
  });

  test("works without database plugin", async () => {
    await withTempDir("enrich-metadata-no-db", async (dir) => {
      const mediaDir = join(dir, "media");
      const { animeId } = await seedLibraryAndCache(dir, mediaDir);

      const configManager = new ConfigManager({ configDir: dir });
      const handlers = createEnrichmentHandlers({
        configManager,
        credentialStore: createSilentCredentialStore(),
        configDir: dir,
        send: noopEnrichmentSend,
      });

      const result = await handlers.enrichMetadata({ id: String(animeId) });
      expect(result.success).toBe(true);
      expect(result.summary?.written).toBe(2);
    });
  });
});
