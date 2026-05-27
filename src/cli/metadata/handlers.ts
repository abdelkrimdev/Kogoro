import type { ConfigManager } from "../../config/config-manager";
import { SCHEMA_DEFAULTS } from "../../config/schema";
import { MatchCache } from "../../match-cache";
import { MetadataWriter } from "../../metadata-writer";
import type { DatabasePlugin } from "../../plugins/database/plugin";

export interface MetadataHandlerOptions {
  dbPath?: string;
  database?: DatabasePlugin;
  config?: ConfigManager;
}

export function createMetadataHandlers(options: MetadataHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });
  const extensions =
    options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
  const writer = new MetadataWriter({ cache, database: options.database, extensions });

  return {
    async write(
      path: string,
      force: boolean,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const summary = await writer.write(path, { force });
        onLog(JSON.stringify(summary, null, 2));
      } catch (err) {
        onError(String(err));
      }
    },
  };
}
