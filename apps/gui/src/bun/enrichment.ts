import { join } from "node:path";
import {
  ArtworkFetcher,
  type CacheService,
  type ConfigManager,
  type CredentialStore,
  type DatabasePlugin,
  type EnrichmentSend,
  type LibraryService,
  MetadataWriter,
} from "@kogoro/core";
import type { PluginFactory } from "@kogoro/plugins";

interface EnrichmentOptions {
  configManager: ConfigManager;
  send: EnrichmentSend;
  libraryService: LibraryService;
  cacheService: CacheService;
  pluginFactory?: PluginFactory;
  database?: DatabasePlugin;
  credentialStore?: CredentialStore;
}

type EnrichArtworkResult = {
  success: boolean;
  summary?: { total: number; downloaded: number; skipped: number; noArtwork: number };
  error?: string;
};

type EnrichMetadataResult = {
  success: boolean;
  summary?: { total: number; written: number; skipped: number; failed: number };
  error?: string;
};

export type EnrichmentHandlers = ReturnType<typeof createEnrichmentHandlers>;

export function createEnrichmentHandlers(options: EnrichmentOptions) {
  const {
    pluginFactory: factory,
    configManager,
    send,
    database: overrideDb,
    libraryService: svc,
    cacheService,
    credentialStore,
  } = options;
  const extensions = configManager.resolveMediaExtensions();

  async function getDatabasePlugin(): Promise<DatabasePlugin | undefined> {
    if (overrideDb) return overrideDb;
    if (!factory) return undefined;
    return factory.primaryDatabase();
  }

  function resolveAnimeAndDir(
    svc: LibraryService,
    id: string,
  ):
    | {
        animeId: number;
        animeDir: string;
        anime: NonNullable<ReturnType<LibraryService["getAnime"]>>;
      }
    | { error: string } {
    const anime = svc.getAnime(Number(id));
    if (!anime) return { error: "Anime not found in library" };
    const animeDir = svc.getAnimeDir(anime.id);
    if (!animeDir) return { error: "No episode files found for this anime" };
    return { animeId: anime.id, animeDir, anime };
  }

  async function enrichArtwork(params: { id: string }): Promise<EnrichArtworkResult> {
    const resolved = resolveAnimeAndDir(svc, params.id);
    if ("error" in resolved) {
      send.enrichmentComplete?.({
        animeId: params.id,
        command: "artwork",
        success: false,
        error: resolved.error,
      });
      return { success: false, error: resolved.error };
    }

    const database = await getDatabasePlugin();
    if (!database) {
      const error = "No database plugin available — check API key configuration";
      send.enrichmentComplete?.({
        animeId: params.id,
        command: "artwork",
        success: false,
        error,
      });
      return { success: false, error };
    }

    const fetcher = new ArtworkFetcher({
      primaryDb: database,
      cacheService,
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
      svc.updateCoverArtPath(resolved.anime.id, coverPath);
    }

    send.enrichmentComplete?.({ animeId: params.id, command: "artwork", success: true });
    return { success: true, summary };
  }

  async function enrichMetadata(params: { id: string }): Promise<EnrichMetadataResult> {
    const resolved = resolveAnimeAndDir(svc, params.id);
    if ("error" in resolved) {
      send.enrichmentComplete?.({
        animeId: params.id,
        command: "metadata",
        success: false,
        error: resolved.error,
      });
      return { success: false, error: resolved.error };
    }

    const database = await getDatabasePlugin();

    const writer = new MetadataWriter({
      cacheService,
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

    send.enrichmentComplete?.({ animeId: params.id, command: "metadata", success: true });
    return { success: true, summary };
  }

  type EnrichTrackerResult = {
    success: boolean;
    summary?: { total: number; enriched: number; skipped: number; errors: number };
    error?: string;
  };

  async function enrichTracker(params: { id: string }): Promise<EnrichTrackerResult> {
    const resolved = resolveAnimeAndDir(svc, params.id);
    if ("error" in resolved) {
      send.enrichmentComplete?.({
        animeId: params.id,
        command: "tracker",
        success: false,
        error: resolved.error,
      });
      return { success: false, error: resolved.error };
    }

    if (!factory || !credentialStore) {
      send.enrichmentComplete?.({
        animeId: params.id,
        command: "tracker",
        success: true,
      });
      return { success: true, summary: { total: 0, enriched: 0, skipped: 0, errors: 0 } };
    }

    const groups = svc.getEpisodeGroupsByAnimeId(resolved.animeId);
    let total = 0;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    for (const group of groups) {
      const mappings = svc.getTrackerMappingsByGroupId(group.id);
      if (mappings.length === 0) {
        skipped++;
        continue;
      }

      for (const mapping of mappings) {
        total++;
        try {
          const credential = await credentialStore.getCredential(mapping.source);
          if (!credential) {
            skipped++;
            continue;
          }

          const plugin = await factory.tracker(mapping.source);
          if (!plugin) {
            skipped++;
            continue;
          }

          const details = await plugin.getAnimeDetails(mapping.externalId);

          const metadata: { synopsis?: string; rating?: number } = {};
          if (details.synopsis && (!group.synopsis || group.synopsis.length === 0)) {
            metadata.synopsis = details.synopsis;
          }
          if (details.rating != null && group.rating == null) {
            metadata.rating = details.rating;
          }

          if (Object.keys(metadata).length > 0) {
            svc.updateEpisodeGroupMetadata(group.id, metadata);
          }

          enriched++;
        } catch {
          errors++;
        }
      }
    }

    send.enrichmentComplete?.({ animeId: params.id, command: "tracker", success: true });
    return {
      success: true,
      summary: { total, enriched, skipped, errors },
    };
  }

  return { enrichArtwork, enrichMetadata, enrichTracker };
}
