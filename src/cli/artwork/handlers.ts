import { ArtworkFetcher } from "../../artwork-fetcher";
import type { ConfigManager } from "../../config/config-manager";
import type { HttpClient } from "../../http-client";
import { MatchCache } from "../../match-cache";
import type { DatabasePlugin } from "../../plugins/database/plugin";
import { resolveMediaExtensions } from "../extensions";

export interface ArtworkHandlerOptions {
  primaryDb: DatabasePlugin;
  secondaryDbs?: DatabasePlugin[];
  cache?: MatchCache;
  httpClient?: HttpClient;
  config?: ConfigManager;
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
      cliOptions: { force?: boolean; verbose?: boolean },
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const summary = await fetcher.process(
          path,
          { force: cliOptions.force },
          cliOptions.verbose ? onLog : undefined,
        );

        const parts: string[] = [`${summary.total} anime processed`];
        if (summary.downloaded > 0) parts.push(`${summary.downloaded} covers downloaded`);
        if (summary.skipped > 0) parts.push(`${summary.skipped} already present`);
        if (summary.noArtwork > 0) parts.push(`${summary.noArtwork} no artwork found`);
        onLog(parts.join(", "));
      } catch (err) {
        onError(String(err));
      }
    },
  };
}
