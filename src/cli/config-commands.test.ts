import { describe, expect, test } from "bun:test";
import { createConfigHandlers } from "../cli/config-commands";
import { ConfigManager } from "../config/config-manager";
import { OverrideStore } from "../override-store";
import { createLogCapture, withTempDir } from "../test-helpers";

describe("Config CLI commands", () => {
  test("config get returns set value", async () => {
    await withTempDir("cli-config", async (dir) => {
      const config = new ConfigManager({ configDir: dir });
      await config.set("primary-db", "anidb");
      const handlers = createConfigHandlers({ configDir: dir });
      const capture = createLogCapture();
      await handlers.get("primary-db", capture.onLog, () => {});
      expect(capture.output).toBe("anidb");
    });
  });

  test("config get returns message for unset key", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      const capture = createLogCapture();
      await handlers.get("nonexistent", () => {}, capture.onError);
      expect(capture.errorOutput).toBe("Config key 'nonexistent' is not set");
    });
  });

  test("config set persists value", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      await handlers.set(
        "concurrency",
        "8",
        () => {},
        () => {},
      );
      const config = new ConfigManager({ configDir: dir });
      expect(await config.get("concurrency")).toBe("8");
    });
  });

  test("config init creates config file with defaults", async () => {
    await withTempDir("cli-config", async (dir) => {
      const handlers = createConfigHandlers({ configDir: dir });
      const prompts = {
        intro: () => {},
        outro: () => {},
        select: async () => "tvdb",
        text: async () => "",
        confirm: async () => true,
        isCancel: () => false,
      };
      await handlers.init(prompts, () => {});

      const config = new ConfigManager({ configDir: dir });
      expect(await config.get("primary-db")).toBe("tvdb");
      expect(await config.get("concurrency")).toBe("4");
    });
  });

  describe("config set template.preset", () => {
    test("accepts valid preset name", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        const capture = createLogCapture();
        await handlers.set("template.preset", "plex", capture.onLog, () => {});
        expect(capture.output).toContain("Set config 'template.preset' to 'plex'");

        const config = new ConfigManager({ configDir: dir });
        expect(await config.get("template.preset")).toBe("plex");
        expect(config.getTemplate()).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      });
    });

    test("rejects unknown preset name with clear error", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ configDir: dir });
        const capture = createLogCapture();
        await handlers.set("template.preset", "nonexistent", () => {}, capture.onError);
        expect(capture.errorOutput).toContain("Unknown preset 'nonexistent'");
        expect(capture.errorOutput).toContain("standard");
        expect(capture.errorOutput).toContain("compact");

        // Value should not be persisted
        const config = new ConfigManager({ configDir: dir });
        expect(await config.get("template.preset")).toBeUndefined();
      });
    });
  });

  describe("config override", () => {
    test("override set stores an override in kogoro.toml", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ overrideDir: dir });
        const capture = createLogCapture();
        await handlers.overrideSet(
          "hash1",
          { animeId: "tvdb-42", episodeId: "ep-5", entryType: "tv" },
          capture.onLog,
          () => {},
        );
        expect(capture.output).toContain("hash1");

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({
          animeId: "tvdb-42",
          episodeId: "ep-5",
          entryType: "tv",
        });
      });
    });

    test("override list returns all overrides as JSON", async () => {
      await withTempDir("cli-config", async (dir) => {
        const store = new OverrideStore(dir);
        store.set("hash1", { animeId: "tvdb-1", entryType: "movie" });
        store.set("hash2", { animeId: "tvdb-2" });

        const handlers = createConfigHandlers({ overrideDir: dir });
        const capture = createLogCapture();
        await handlers.overrideList(capture.onLog, () => {});
        const parsed = JSON.parse(capture.output);
        expect(parsed).toHaveLength(2);
        expect(parsed.find((i: { hash: string }) => i.hash === "hash1")?.data.animeId).toBe(
          "tvdb-1",
        );
      });
    });

    test("override remove deletes an existing override", async () => {
      await withTempDir("cli-config", async (dir) => {
        const store1 = new OverrideStore(dir);
        store1.set("hash1", { animeId: "tvdb-42" });

        const handlers = createConfigHandlers({ overrideDir: dir });
        const capture = createLogCapture();
        await handlers.overrideRemove("hash1", capture.onLog, () => {});
        expect(capture.output).toContain("Removed");

        const store2 = new OverrideStore(dir);
        expect(store2.get("hash1")).toBeUndefined();
      });
    });

    test("override remove returns error for non-existent hash", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ overrideDir: dir });
        const capture = createLogCapture();
        await handlers.overrideRemove("nonexistent", () => {}, capture.onError);
        expect(capture.errorOutput).toContain("not found");
      });
    });

    test("override set with minimal fields (animeId only)", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ overrideDir: dir });
        await handlers.overrideSet(
          "hash1",
          { animeId: "tvdb-99" },
          () => {},
          () => {},
        );

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({ animeId: "tvdb-99" });
      });
    });

    test("override set with entryType only", async () => {
      await withTempDir("cli-config", async (dir) => {
        const handlers = createConfigHandlers({ overrideDir: dir });
        await handlers.overrideSet(
          "hash1",
          { entryType: "special" },
          () => {},
          () => {},
        );

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({ entryType: "special" });
      });
    });
  });
});
