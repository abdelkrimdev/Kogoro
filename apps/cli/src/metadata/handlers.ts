import {
  type ConfigManager,
  type DatabasePlugin,
  MatchCache,
  MetadataWriter,
  SCHEMA_DEFAULTS,
} from "@kogoro/core";
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
  const extensions =
    options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
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
