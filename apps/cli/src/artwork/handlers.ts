import {
  ArtworkFetcher,
  type CacheService,
  type ConfigManager,
  type DatabasePlugin,
  type HttpClient,
  SCHEMA_DEFAULTS,
} from "@kogoro/core";
import type { Logger } from "../logger";

export interface ArtworkHandlerOptions {
  primaryDb: DatabasePlugin;
  cacheService: CacheService;
  httpClient?: HttpClient;
  config?: ConfigManager;
}

export interface ArtworkSummary {
  total: number;
  downloaded: number;
  skipped: number;
  noArtwork: number;
}

export function createArtworkHandlers(options: ArtworkHandlerOptions) {
  const extensions =
    options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
  const fetcher = new ArtworkFetcher({
    primaryDb: options.primaryDb,
    cacheService: options.cacheService,
    httpClient: options.httpClient,
    extensions,
  });

  return {
    async process(
      path: string,
      cliOptions: { force?: boolean },
      logger: Logger,
    ): Promise<ArtworkSummary> {
      logger.info("Fetching artwork...");

      const summary = await fetcher.process(path, { force: cliOptions.force });

      logger.info(
        `Processed ${summary.total} anime: ${summary.downloaded} downloaded, ${summary.skipped} skipped, ${summary.noArtwork} not found`,
      );

      return summary;
    },
  };
}
