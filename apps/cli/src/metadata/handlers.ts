import { type ConfigManager, MatchCache, MetadataWriter } from "@kogoro/core";
import type { DatabasePlugin } from "@kogoro/plugins";
import { resolveMediaExtensions } from "../extensions";
import type { Logger } from "../logger";

export interface MetadataHandlerOptions {
  dbPath?: string;
  database?: DatabasePlugin;
  config?: ConfigManager;
}

export interface MetadataResult {
  total: number;
  written: number;
  skipped: number;
  failed: number;
}

export function createMetadataHandlers(options: MetadataHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });
  const extensions = resolveMediaExtensions(options.config);
  const writer = new MetadataWriter({ cache, database: options.database, extensions });

  return {
    async write(
      path: string,
      cliOptions: { force?: boolean },
      logger: Logger,
    ): Promise<MetadataResult> {
      logger.info("Writing metadata...");

      const summary = await writer.write(path, { force: cliOptions.force });

      logger.info(
        `Written ${summary.written} of ${summary.total}: ${summary.skipped} skipped, ${summary.failed} failed`,
      );

      return summary;
    },
  };
}
