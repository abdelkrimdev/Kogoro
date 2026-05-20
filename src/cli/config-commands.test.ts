import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConfigHandlers } from "../cli/config-commands";
import { ConfigManager } from "../config/config-manager";
import { OverrideStore } from "../override-store";

describe("Config CLI commands", () => {
  function setupTempDir(): string {
    return mkdtempSync(join(tmpdir(), "kogoro-cli-config-"));
  }

  function cleanupTempDir(dir: string) {
    rmSync(dir, { recursive: true, force: true });
  }

  test("config get returns set value", async () => {
    const dir = setupTempDir();
    try {
      const config = new ConfigManager({ configDir: dir });
      await config.set("primary-db", "anidb");
      const handlers = createConfigHandlers({ configDir: dir });
      let output = "";
      const log = (msg: string) => {
        output = msg;
      };
      await handlers.get("primary-db", log, () => {});
      expect(output).toBe("anidb");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config get returns message for unset key", async () => {
    const dir = setupTempDir();
    try {
      const handlers = createConfigHandlers({ configDir: dir });
      let errOutput = "";
      const log = () => {};
      const error = (msg: string) => {
        errOutput = msg;
      };
      await handlers.get("nonexistent", log, error);
      expect(errOutput).toBe("Config key 'nonexistent' is not set");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config set persists value", async () => {
    const dir = setupTempDir();
    try {
      const handlers = createConfigHandlers({ configDir: dir });
      await handlers.set(
        "concurrency",
        "8",
        () => {},
        () => {},
      );
      const config = new ConfigManager({ configDir: dir });
      expect(await config.get("concurrency")).toBe("8");
    } finally {
      cleanupTempDir(dir);
    }
  });

  test("config init creates config file with defaults", async () => {
    const dir = setupTempDir();
    try {
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
    } finally {
      cleanupTempDir(dir);
    }
  });

  describe("config set template.preset", () => {
    test("accepts valid preset name", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ configDir: dir });
        let output = "";
        await handlers.set(
          "template.preset",
          "plex",
          (msg) => {
            output = msg;
          },
          () => {},
        );
        expect(output).toContain("Set config 'template.preset' to 'plex'");

        const config = new ConfigManager({ configDir: dir });
        expect(await config.get("template.preset")).toBe("plex");
        expect(config.getTemplate()).toBe("{anime} - s{season:02}e{episode:02} - {title}");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("rejects unknown preset name with clear error", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ configDir: dir });
        let errOutput = "";
        await handlers.set(
          "template.preset",
          "nonexistent",
          () => {},
          (msg) => {
            errOutput = msg;
          },
        );
        expect(errOutput).toContain("Unknown preset 'nonexistent'");
        expect(errOutput).toContain("standard");
        expect(errOutput).toContain("compact");

        // Value should not be persisted
        const config = new ConfigManager({ configDir: dir });
        expect(await config.get("template.preset")).toBeUndefined();
      } finally {
        cleanupTempDir(dir);
      }
    });
  });

  describe("config override", () => {
    test("override set stores an override in kogoro.toml", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ overrideDir: dir });
        let output = "";
        await handlers.overrideSet(
          "hash1",
          { animeId: "tvdb-42", episodeId: "ep-5", entryType: "tv" },
          (msg) => {
            output = msg;
          },
          () => {},
        );
        expect(output).toContain("hash1");

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({
          animeId: "tvdb-42",
          episodeId: "ep-5",
          entryType: "tv",
        });
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("override list returns all overrides as JSON", async () => {
      const dir = setupTempDir();
      try {
        const store = new OverrideStore(dir);
        store.set("hash1", { animeId: "tvdb-1", entryType: "movie" });
        store.set("hash2", { animeId: "tvdb-2" });

        const handlers = createConfigHandlers({ overrideDir: dir });
        let output = "";
        await handlers.overrideList(
          (msg) => {
            output = msg;
          },
          () => {},
        );
        const parsed = JSON.parse(output);
        expect(parsed).toHaveLength(2);
        expect(parsed.find((i: { hash: string }) => i.hash === "hash1")?.data.animeId).toBe(
          "tvdb-1",
        );
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("override remove deletes an existing override", async () => {
      const dir = setupTempDir();
      try {
        const store1 = new OverrideStore(dir);
        store1.set("hash1", { animeId: "tvdb-42" });

        const handlers = createConfigHandlers({ overrideDir: dir });
        let output = "";
        await handlers.overrideRemove(
          "hash1",
          (msg) => {
            output = msg;
          },
          () => {},
        );
        expect(output).toContain("Removed");

        const store2 = new OverrideStore(dir);
        expect(store2.get("hash1")).toBeUndefined();
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("override remove returns error for non-existent hash", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ overrideDir: dir });
        let errOutput = "";
        await handlers.overrideRemove(
          "nonexistent",
          () => {},
          (msg) => {
            errOutput = msg;
          },
        );
        expect(errOutput).toContain("not found");
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("override set with minimal fields (animeId only)", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ overrideDir: dir });
        await handlers.overrideSet(
          "hash1",
          { animeId: "tvdb-99" },
          () => {},
          () => {},
        );

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({ animeId: "tvdb-99" });
      } finally {
        cleanupTempDir(dir);
      }
    });

    test("override set with entryType only", async () => {
      const dir = setupTempDir();
      try {
        const handlers = createConfigHandlers({ overrideDir: dir });
        await handlers.overrideSet(
          "hash1",
          { entryType: "special" },
          () => {},
          () => {},
        );

        const store = new OverrideStore(dir);
        expect(store.get("hash1")).toEqual({ entryType: "special" });
      } finally {
        cleanupTempDir(dir);
      }
    });
  });
});
