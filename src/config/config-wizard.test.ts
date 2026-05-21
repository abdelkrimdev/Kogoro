import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type PromptsAPI, runConfigWizard } from "../config/config-wizard";
import { createMockKeytar, withTestConfig } from "../test-helpers";

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
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
      const prompts = makePrompts({
        select: async () => "anidb",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("anidb");
    });
  });

  test("wizard creates config.toml file", async () => {
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      expect(existsSync(join(_dir, "config.toml"))).toBe(true);
    });
  });

  test("wizard saves API key via credential store when provided", async () => {
    const mockKeytar = createMockKeytar();
    await withTestConfig(
      "wizard",
      async (_dir, config, credentialStore) => {
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
      },
      mockKeytar,
    );
  });

  test("wizard sets template preset", async () => {
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
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
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
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
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
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
    const throwingKeytar = {
      setPassword: async () => {
        throw new Error("keyring down");
      },
      getPassword: async () => null,
      deletePassword: async () => false,
    };
    await withTestConfig(
      "wizard",
      async (_dir, config, credentialStore) => {
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
      },
      throwingKeytar,
    );
  });

  test("wizard accepts empty secondary databases", async () => {
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
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
