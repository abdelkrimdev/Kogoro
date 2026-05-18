import { ConfigManager } from "../config/config-manager.ts";
import { type PromptsAPI, runConfigWizard } from "../config/config-wizard.ts";
import { CredentialStore } from "../config/credential-store.ts";

export interface ConfigHandlerOptions {
  configDir?: string;
}

export function createConfigHandlers(options: ConfigHandlerOptions = {}) {
  const config = new ConfigManager({ configDir: options.configDir });
  const creds = new CredentialStore();

  return {
    async get(
      key: string,
      log: (msg: string) => void,
      error: (msg: string) => void,
    ): Promise<void> {
      const val = await config.get(key);
      if (val === undefined) {
        error(`Config key '${key}' is not set`);
      } else {
        log(val);
      }
    },

    async set(key: string, value: string, log: (msg: string) => void): Promise<void> {
      await config.set(key, value);
      log(`Set config '${key}' to '${value}'`);
    },

    async init(prompts: PromptsAPI, log: (msg: string) => void): Promise<void> {
      await runConfigWizard({ config, creds, prompts });
      log("Configuration complete");
    },
  };
}
