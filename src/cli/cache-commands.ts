import { MatchCache } from "../match-cache.ts";

export interface CacheHandlerOptions {
  dbPath?: string;
}

export function createCacheHandlers(options: CacheHandlerOptions = {}) {
  const cache = new MatchCache({ dbPath: options.dbPath });

  return {
    async list(onLog: (msg: string) => void, onError: (msg: string) => void): Promise<void> {
      try {
        const entries = cache.list();
        onLog(JSON.stringify(entries, null, 2));
      } catch {
        onError("Failed to list cache");
      }
    },

    async lookup(
      hash: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const match = cache.get(hash);
        if (match) {
          onLog(JSON.stringify(match, null, 2));
        } else {
          onError(`No cached match for hash: ${hash}`);
        }
      } catch {
        onError("Failed to lookup cache");
      }
    },

    async clear(
      confirmed: boolean,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        if (confirmed) {
          cache.clear();
          onLog("Cache cleared");
        } else {
          onLog("Cache clear cancelled");
        }
      } catch {
        onError("Failed to clear cache");
      }
    },
  };
}
