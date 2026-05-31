import {
  ArtworkFetcher,
  type ConfigManager,
  type HttpClient,
  MatchCache,
  SCHEMA_DEFAULTS,
} from "@kogoro/core";
import type { DatabasePlugin } from "@kogoro/plugins";
import type { Logger } from "../logger";

export interface ArtworkHandlerOptions {
  primaryDb: DatabasePlugin;
  secondaryDbs?: DatabasePlugin[];
  cache?: MatchCache;
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
  const cache = options.cache ?? new MatchCache();
  const extensions =
    options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
  const fetcher = new ArtworkFetcher({
    primaryDb: options.primaryDb,
    secondaryDbs: options.secondaryDbs,
    cache,
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
