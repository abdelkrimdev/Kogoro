import { ArtworkFetcher, type ConfigManager, type HttpClient, MatchCache } from "@kogoro/core";
import type { DatabasePlugin } from "@kogoro/plugins";
import { resolveMediaExtensions } from "../extensions";
import type { Logger } from "../logger";

export interface ArtworkHandlerOptions {
  primaryDb: DatabasePlugin;
  secondaryDbs?: DatabasePlugin[];
  cache?: MatchCache;
  httpClient?: HttpClient;
  config?: ConfigManager;
}

export interface ArtworkResult {
  total: number;
  downloaded: number;
  skipped: number;
  noArtwork: number;
}

export function createArtworkHandlers(options: ArtworkHandlerOptions) {
  const cache = options.cache ?? new MatchCache();
  const extensions = resolveMediaExtensions(options.config);
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
    ): Promise<ArtworkResult> {
      logger.info("Fetching artwork...");

      const summary = await fetcher.process(path, { force: cliOptions.force });

      logger.info(
        `Processed ${summary.total} anime: ${summary.downloaded} downloaded, ${summary.skipped} skipped, ${summary.noArtwork} not found`,
      );

      return summary;
    },
  };
}
