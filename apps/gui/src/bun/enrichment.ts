import { dirname, join } from "node:path";
import {
  ArtworkFetcher,
  type ConfigManager,
  type CredentialStore,
  LibraryDb,
  MatchCache,
  MetadataWriter,
} from "@kogoro/core";
import type { DatabasePlugin } from "@kogoro/plugins";
import { PluginFactory } from "@kogoro/plugins";

export interface EnrichmentSend {
  enrichmentProgress?: (data: {
    animeId: string;
    command: "artwork" | "metadata";
    completed: number;
    total: number;
    file: string;
    status: string;
  }) => void;
  enrichmentComplete?: (data: {
    animeId: string;
    command: "artwork" | "metadata";
    success: boolean;
    error?: string;
  }) => void;
}

export interface EnrichmentOptions {
  configManager: ConfigManager;
  credentialStore: CredentialStore;
  configDir: string;
  send: EnrichmentSend;
  database?: DatabasePlugin;
}

export function createEnrichmentHandlers(options: EnrichmentOptions) {
  const { configManager, credentialStore, configDir, send, database: overrideDb } = options;
  const factory = new PluginFactory(configManager, credentialStore);
  const dbPath = join(configDir, "library.db");
  const cache = new MatchCache({ dbPath: join(configDir, "match-cache.db") });
  const extensions = configManager.resolveMediaExtensions();

  function getLibraryDb(): LibraryDb {
    return new LibraryDb({ dbPath });
  }

  function findAnimeDir(libraryDb: LibraryDb, animeId: number): string | null {
    const episodes = libraryDb.getEpisodesByAnimeId(animeId);
    if (episodes.length === 0) return null;

    const paths = episodes.map((ep) => ep.filePath);
    const first = paths[0];
    if (!first) return null;
    if (paths.length === 1) return dirname(first);

    let commonParent = dirname(first);
    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];
      if (!path) continue;
      while (commonParent && !path.startsWith(commonParent)) {
        commonParent = dirname(commonParent);
      }
    }
    return commonParent;
  }

  async function getDatabasePlugin(): Promise<DatabasePlugin | undefined> {
    if (overrideDb) return overrideDb;
    return factory.primaryDatabase();
  }

  function resolveAnimeAndDir(
    libDb: LibraryDb,
    id: string,
  ):
    | { animeId: number; animeDir: string; anime: NonNullable<ReturnType<LibraryDb["getAnime"]>> }
    | { error: string } {
    const anime = libDb.getAnime(Number(id));
    if (!anime) return { error: "Anime not found in library" };
    const animeDir = findAnimeDir(libDb, anime.id);
    if (!animeDir) return { error: "No episode files found for this anime" };
    return { animeId: anime.id, animeDir, anime };
  }

  async function enrichArtwork(params: { id: string }): Promise<{
    success: boolean;
    summary?: { total: number; downloaded: number; skipped: number; noArtwork: number };
    error?: string;
  }> {
    const libDb = getLibraryDb();
    try {
      const resolved = resolveAnimeAndDir(libDb, params.id);
      if ("error" in resolved) {
        return { success: false, error: resolved.error };
      }

      const database = await getDatabasePlugin();
      if (!database) {
        return {
          success: false,
          error: "No database plugin available — check API key configuration",
        };
      }

      const fetcher = new ArtworkFetcher({
        primaryDb: database,
        cache,
        extensions,
      });

      const summary = await fetcher.process(resolved.animeDir, undefined, {
        progress: (event) => {
          send.enrichmentProgress?.({
            animeId: params.id,
            command: "artwork",
            completed: event.completed,
            total: event.total,
            file: event.file,
            status: event.status,
          });
        },
        log: () => {},
        error: () => {},
      });

      if (summary.downloaded > 0) {
        const coverPath = join(resolved.animeDir, "cover.jpg");
        const updatedDb = getLibraryDb();
        try {
          updatedDb.upsertAnime({
            externalId: resolved.anime.externalId,
            sourceDb: resolved.anime.sourceDb,
            title: resolved.anime.title,
            titleJapanese: resolved.anime.titleJapanese,
            entryType: resolved.anime.entryType,
            episodeCount: resolved.anime.episodeCount,
            coverArtPath: coverPath,
          });
        } finally {
          updatedDb.close();
        }
      }

      return { success: true, summary };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      libDb.close();
    }
  }

  async function enrichMetadata(params: { id: string }): Promise<{
    success: boolean;
    summary?: { total: number; written: number; skipped: number; failed: number };
    error?: string;
  }> {
    const libDb = getLibraryDb();
    try {
      const resolved = resolveAnimeAndDir(libDb, params.id);
      if ("error" in resolved) {
        return { success: false, error: resolved.error };
      }

      const database = await getDatabasePlugin();

      const writer = new MetadataWriter({
        cache,
        database,
        extensions,
      });

      const summary = await writer.write(resolved.animeDir, undefined, {
        progress: (event) => {
          send.enrichmentProgress?.({
            animeId: params.id,
            command: "metadata",
            completed: event.completed,
            total: event.total,
            file: event.file,
            status: event.status,
          });
        },
        log: () => {},
        error: () => {},
      });

      return { success: true, summary };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      libDb.close();
    }
  }

  return { enrichArtwork, enrichMetadata };
}
