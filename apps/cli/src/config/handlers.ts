import {
  type Config,
  ConfigManager,
  createCredentialStore,
  type PromptsAPI,
  runConfigWizard,
} from "@kogoro/core";

export interface ConfigHandlerOptions {
  configDir?: string;
}

export function createConfigHandlers(options: ConfigHandlerOptions = {}) {
  const config = new ConfigManager({ configDir: options.configDir });
  const credentialStore = createCredentialStore();

  return {
    get(key: string) {
      return config.get(key as keyof Config);
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
  };
}
