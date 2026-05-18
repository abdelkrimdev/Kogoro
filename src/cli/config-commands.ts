import { ConfigManager } from "../config/config-manager.ts";
import { type PromptsAPI, runConfigWizard } from "../config/config-wizard.ts";
import { CredentialStore } from "../config/credential-store.ts";
import { type OverrideData, OverrideStore } from "../override-store.ts";

export interface ConfigHandlerOptions {
  configDir?: string;
  overrideDir?: string;
}

export function createConfigHandlers(options: ConfigHandlerOptions = {}) {
  const config = new ConfigManager({ configDir: options.configDir });
  const credentialStore = new CredentialStore();
  const overrideDir = options.overrideDir ?? process.cwd();
  const overrideStore = new OverrideStore(overrideDir);

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

    async overrideSet(
      hash: string,
      data: OverrideData,
      onLog: (msg: string) => void,
      _onError: (msg: string) => void,
    ): Promise<void> {
      overrideStore.set(hash, data);
      onLog(`Override set for hash '${hash}'`);
    },

    async overrideList(
      onLog: (msg: string) => void,
      _onError: (msg: string) => void,
    ): Promise<void> {
      const items = overrideStore.list();
      onLog(JSON.stringify(items, null, 2));
    },

    async overrideRemove(
      hash: string,
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      const removed = overrideStore.remove(hash);
      if (removed) {
        onLog(`Removed override for hash '${hash}'`);
      } else {
        onError(`Override for hash '${hash}' not found`);
      }
    },
  };
}
