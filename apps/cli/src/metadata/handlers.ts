import {
  type CacheService,
  type ConfigManager,
  type DatabasePlugin,
  MetadataWriter,
  SCHEMA_DEFAULTS,
} from "@kogoro/core";
import type { Logger } from "../logger";

export interface MetadataHandlerOptions {
  cacheService: CacheService;
  database?: DatabasePlugin;
  config?: ConfigManager;
}

export interface MetadataResult {
  total: number;
  written: number;
  skipped: number;
  failed: number;
}

export function createMetadataHandlers(options: MetadataHandlerOptions) {
  const extensions =
    options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
  const writer = new MetadataWriter({
    cacheService: options.cacheService,
    database: options.database,
    extensions,
  });

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
