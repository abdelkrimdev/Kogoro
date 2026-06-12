import type { CacheService } from "@kogoro/core";

export function createCacheHandlers(options: { cacheService: CacheService }) {
  const { cacheService } = options;

  return {
    list() {
      return cacheService.list();
    },

    lookup(hash: string) {
      return cacheService.get(hash) ?? null;
    },

    clear() {
      cacheService.clear();
      return true;
    },

    purge(currentPaths: string[]) {
      cacheService.purgeStale(currentPaths);
      return true;
    },
  };
}
