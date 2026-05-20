import type { UrlFetch } from "../artwork-fetcher";
import { ArtworkFetcher } from "../artwork-fetcher";
import type { DatabasePlugin } from "../db/database-plugin";
import { MatchCache } from "../match-cache";

export interface ArtworkHandlerOptions {
  primaryDb: DatabasePlugin;
  secondaryDbs?: DatabasePlugin[];
  cache?: MatchCache;
  fetch?: UrlFetch;
}

export function createArtworkHandlers(options: ArtworkHandlerOptions) {
  const cache = options.cache ?? new MatchCache();
  const fetcher = new ArtworkFetcher({
    primaryDb: options.primaryDb,
    secondaryDbs: options.secondaryDbs,
    cache,
    fetch: options.fetch,
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
