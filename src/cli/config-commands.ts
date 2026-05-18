import { ConfigManager } from "../config/config-manager.ts";
import { type PromptsAPI, runConfigWizard } from "../config/config-wizard.ts";
import { CredentialStore } from "../config/credential-store.ts";

export interface ConfigHandlerOptions {
  configDir?: string;
}

export function createConfigHandlers(options: ConfigHandlerOptions = {}) {
  const config = new ConfigManager({ configDir: options.configDir });
  const credentialStore = new CredentialStore();

  return {
    async get(
      key: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      const val = config.get(key);
      if (val === undefined) {
        onError(`Config key '${key}' is not set`);
      } else {
        onLog(val);
      }
    },

    async set(key: string, value: string, onLog: (msg: string) => void): Promise<void> {
      config.set(key, value);
      onLog(`Set config '${key}' to '${value}'`);
    },

    async init(prompts: PromptsAPI, onLog: (msg: string) => void): Promise<void> {
      await runConfigWizard({ config, credentialStore, prompts });
      onLog("Configuration complete");
    },
  };
}
