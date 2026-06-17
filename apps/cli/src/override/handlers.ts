import { type OverrideData, OverrideStore } from "@kogoro/core";

export interface OverrideHandlerOptions {
  overrideDir?: string;
}

export function createOverrideHandlers(options: OverrideHandlerOptions = {}) {
  const overrideDir = options.overrideDir ?? process.cwd();
  const overrideStore = new OverrideStore(overrideDir);

  return {
    set(hash: string, data: OverrideData) {
      overrideStore.set(hash, data);
      return true;
    },

    list() {
      return overrideStore.list();
    },

    remove(hash: string) {
      const removed = overrideStore.remove(hash);
      if (!removed) {
        throw new Error(`Override for hash '${hash}' not found`);
      }
      return true;
    },
  };
}
