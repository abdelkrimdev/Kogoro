import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "../src/config/config-manager.ts";
import { type PromptsAPI, runConfigWizard } from "../src/config/config-wizard.ts";
import { CredentialStore } from "../src/config/credential-store.ts";

describe("ConfigWizard", () => {
  function setupTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-wizard-test-"));
    return dir;
  }

  function cleanupTempDir(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

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
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts({
        select: async () => "anidb",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("anidb");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard creates config.toml file", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      expect(existsSync(join(dir, "config.toml"))).toBe(true);
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard saves API key via credential store when provided", async () => {
    const dir = setupTempDir();
    try {
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
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard sets template preset", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      const tmpl = await config.get("template.string");
      expect(tmpl).toBeTruthy();
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard sets default values for all config keys", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("tvdb");
      expect(await config.get("concurrency")).toBe("4");
      expect(await config.get("extensions")).toBe(".mkv,.mp4");
      expect(await config.get("exclude-patterns")).toBe(".part,.crdownload");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard prompts for secondary databases and stores value", async () => {
    const dir = setupTempDir();
    try {
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
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("wizard accepts empty secondary databases", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const prompts = makePrompts({
        select: async () => "tvdb",
        text: async () => "",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("secondary-dbs")).toBe("");
      expect(config.getList("secondary-dbs")).toEqual([]);
    } finally {
      cleanupTempDir(dir);
    }
  });
});
