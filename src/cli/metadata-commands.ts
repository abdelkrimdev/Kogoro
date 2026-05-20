import { MatchCache } from "../match-cache";
import { MetadataWriter } from "../metadata-writer";
import type { DatabasePlugin } from "../plugins/database/plugin";

export interface MetadataHandlerOptions {
  dbPath?: string;
  database?: DatabasePlugin;
}

export function createMetadataHandlers(options: MetadataHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });
  const writer = new MetadataWriter({ cache, database: options.database });

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
