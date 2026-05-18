import { MatchCache } from "../match-cache.ts";
import { MetadataWriter } from "../metadata-writer.ts";

export interface MetadataHandlerOptions {
  dbPath?: string;
}

export function createMetadataHandlers(options: MetadataHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });
  const writer = new MetadataWriter({ cache });

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
