import {
  ConfigManager,
  createCredentialStore,
  type OverrideData,
  OverrideStore,
  type PromptsAPI,
  runConfigWizard,
} from "@kogoro/core";

export interface ConfigHandlerOptions {
  configDir?: string;
  overrideDir?: string;
}

export function createConfigHandlers(options: ConfigHandlerOptions = {}) {
  const config = new ConfigManager({ configDir: options.configDir });
  const credentialStore = createCredentialStore();
  const overrideDir = options.overrideDir ?? process.cwd();
  const overrideStore = new OverrideStore(overrideDir);

  return {
    get(key: string) {
      return config.get(key);
    },

    set(key: string, value: string) {
      const result = config.set(key, value);
      if (!result.success) {
        throw new Error(result.error);
      }
      return true;
    },

    async init(prompts: PromptsAPI) {
      await runConfigWizard({ config, credentialStore, prompts });
      return true;
    },

    overrideSet(hash: string, data: OverrideData) {
      overrideStore.set(hash, data);
      return true;
    },

    overrideList() {
      return overrideStore.list();
    },

    overrideRemove(hash: string) {
      const removed = overrideStore.remove(hash);
      if (!removed) {
        throw new Error(`Override for hash '${hash}' not found`);
      }
      return true;
    },
  };
}
