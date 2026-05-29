import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { createMockKeytar, withTestConfig } from "../test-fixtures";
import { type PromptsAPI, runConfigWizard } from "./config-wizard";

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

  test("sets primary-db from user selection", async () => {
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
      const prompts = makePrompts({
        select: async () => "anidb",
      });

      await runConfigWizard({ config, credentialStore, prompts });
      expect(await config.get("primary-db")).toBe("anidb");
    });
  });

  test("creates config.toml file", async () => {
    await withTestConfig("wizard", async (_dir, config, credentialStore) => {
      const prompts = makePrompts();

      await runConfigWizard({ config, credentialStore, prompts });
      expect(existsSync(join(_dir, "config.toml"))).toBe(true);
    });
  });

  test("saves API key via credential store when provided", async () => {
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

  test("sets template preset", async () => {
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

  test("sets default values for all config keys", async () => {
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
      expect(await config.get("scan-concurrency")).toBe(4);
      const extensions = config.get("media-extensions");
      expect(Array.isArray(extensions)).toBe(true);
      expect((extensions as string[]).includes(".mkv")).toBe(true);
      const exclude = config.get("exclude-patterns") as string[];
      expect(exclude.includes("!qb")).toBe(true);
      expect(await config.get("template.preset")).toBe("standard");
    });
  });

  test("prompts for secondary databases and stores value", async () => {
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

  test("warns with correct env var when credential store throws", async () => {
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

  test("accepts empty secondary databases", async () => {
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
