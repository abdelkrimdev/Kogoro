import { MatchCache } from "@kogoro/core";

export function createCacheHandlers(options?: { dbPath?: string }) {
  const cache = new MatchCache(options);

  return {
    list() {
      return cache.list();
    },

    lookup(hash: string) {
      return cache.get(hash) ?? null;
    },

    clear() {
      cache.clear();
      return true;
    },
  };
}
