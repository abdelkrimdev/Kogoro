import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ConfigManager } from "../config/config-manager";
import { type PromptsAPI, runConfigWizard } from "../config/config-wizard";
import { CredentialStore } from "../config/credential-store";
import { withTempDir } from "../test-helpers";

describe("ConfigWizard", () => {
  function makePrompts(overrides: Partial<PromptsAPI> = {}): PromptsAPI {
    return {
      intro: () => {},
      outro: () => {},
      select: async () => "tvdb",
      text: async () => "",
      confirm: async () => true,
      isCancel: () => false,
      ...overrides,
    };
  }

  test("wizard sets primary-db from user selection", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts({
        select: async () => "anidb",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("anidb");
    });
  });

  test("wizard creates config.toml file", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      expect(existsSync(join(dir, "config.toml"))).toBe(true);
    });
  });

  test("wizard saves API key via credential store when provided", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const mockKeytar = {
        store: new Map<string, string>(),
        setPassword(_s: string, _a: string, p: string) {
          this.store.set(`${_s}:${_a}`, p);
          return Promise.resolve();
        },
        getPassword(_s: string, _a: string) {
          return Promise.resolve(this.store.get(`${_s}:${_a}`) ?? null);
        },
        deletePassword(_s: string, _a: string) {
          return Promise.resolve(this.store.delete(`${_s}:${_a}`));
        },
      };
      const credentialStore = new CredentialStore({ keytar: mockKeytar });
      let textCalls = 0;
      const prompts = makePrompts({
        select: async () => "anidb",
        text: async () => {
          textCalls++;
          if (textCalls === 1) return "my-api-key-123";
          return "";
        },
      });

      await runConfigWizard({ config, credentialStore, prompts });
      const stored = await credentialStore.getCredential("anidb");
      expect(stored).toBe("my-api-key-123");
    });
  });

  test("wizard sets template preset", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      let selectCalls = 0;
      const prompts = makePrompts({
        select: async () => {
          selectCalls++;
          if (selectCalls === 1) return "tvdb";
          return "compact";
        },
      });

      await runConfigWizard({ config, credentialStore, prompts });
      const preset = await config.get("template.preset");
      expect(preset).toBe("compact");
    });
  });

  test("wizard sets default values for all config keys", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      let selectCalls = 0;
      const prompts = makePrompts({
        select: async () => {
          selectCalls++;
          if (selectCalls === 1) return "tvdb";
          return "standard";
        },
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("tvdb");
      expect(await config.get("concurrency")).toBe("4");
      expect(await config.get("extensions")).toBe(".mkv,.mp4");
      expect(await config.get("exclude-patterns")).toBe(".part,.crdownload");
      expect(await config.get("template.preset")).toBe("standard");
    });
  });

  test("wizard prompts for secondary databases and stores value", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      let textCalls = 0;
      const prompts = makePrompts({
        select: async () => "tvdb",
        text: async () => {
          textCalls++;
          if (textCalls === 1) return "";
          if (textCalls === 2) return "anidb,opensubtitles";
          return "";
        },
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("secondary-dbs")).toBe("anidb,opensubtitles");
      expect(config.getList("secondary-dbs")).toEqual(["anidb", "opensubtitles"]);
    });
  });

  test("wizard warns with correct env var when credential store throws", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({
        keytar: {
          setPassword: async () => {
            throw new Error("keyring down");
          },
          getPassword: async () => null,
          deletePassword: async () => false,
        },
      });
      const outroMessages: string[] = [];
      const prompts = makePrompts({
        select: async () => "tvdb",
        text: async () => "my-api-key",
        outro: (msg: string) => {
          outroMessages.push(msg);
        },
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(outroMessages.some((m) => m.includes("KOGORO_TVDB_KEY"))).toBe(true);
    });
  });

  test("wizard accepts empty secondary databases", async () => {
    await withTempDir("wizard", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts({
        select: async () => "tvdb",
        text: async () => "",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("secondary-dbs")).toBe("");
      expect(config.getList("secondary-dbs")).toEqual([]);
    });
  });
});
