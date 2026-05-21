import { describe, expect, mock, test } from "bun:test";
import { createScanHandlers } from "./cli/scan-commands";
import { isDatabasePlugin, isSubtitlePlugin, PluginRegistry } from "./plugin-registry";
import type { DatabasePlugin } from "./plugins/database/plugin";
import { createCache, withTempDir, writeTempFile } from "./test-fixtures";

describe("isDatabasePlugin", () => {
  test("returns true for object implementing DatabasePlugin", () => {
    const valid: DatabasePlugin = {
      async searchAnime() {
        return [];
      },
      async getEpisodes() {
        return [];
      },
      async getArtwork() {
        return [];
      },
      async getAnime() {
        return null;
      },
    };
    expect(isDatabasePlugin(valid)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isDatabasePlugin(null)).toBe(false);
  });

  test("returns false for plain object without required methods", () => {
    expect(isDatabasePlugin({})).toBe(false);
  });

  test("returns false for object missing one method", () => {
    expect(isDatabasePlugin({ searchAnime: async () => [], getEpisodes: async () => [] })).toBe(
      false,
    );
  });
});

describe("PluginRegistry.instantiate", () => {
  test("returns null for non-existent external plugin", async () => {
    const registry = new PluginRegistry();
    const instance = await registry.instantiate("nonexistent-plugin", {});
    expect(instance).toBeNull();
  });

  test("loads and returns an external plugin that implements DatabasePlugin", async () => {
    const mockModule = {
      default: class MockPlugin {
        options: Record<string, unknown>;
        constructor(options: Record<string, unknown>) {
          this.options = options;
        }
        async searchAnime() {
          return [];
        }
        async getEpisodes() {
          return [];
        }
        async getArtwork() {
          return [];
        }
        async getAnime() {
          return null;
        }
      },
    };
    mock.module("kogoro-plugin-validplugin", () => mockModule);

    const registry = new PluginRegistry();
    const instance = await registry.instantiate("validplugin", { key: "value" });
    expect(instance).not.toBeNull();
    expect(instance?.searchAnime).toBeFunction();
    expect(instance?.getEpisodes).toBeFunction();
    expect(instance?.getArtwork).toBeFunction();
  });

  test("caches instance and returns singleton on subsequent calls", async () => {
    const mockModule = {
      default: class SingletonPlugin {
        id = Math.random();
        async searchAnime() {
          return [];
        }
        async getEpisodes() {
          return [];
        }
        async getArtwork() {
          return [];
        }
        async getAnime() {
          return null;
        }
      },
    };
    mock.module("kogoro-plugin-singleton", () => mockModule);

    const registry = new PluginRegistry();
    const first = await registry.instantiate("singleton", {});
    const second = await registry.instantiate("singleton", {});
    expect(first).toBe(second);
  });

  test("rejects module whose default export is not a DatabasePlugin", async () => {
    mock.module("kogoro-plugin-badplugin", () => ({
      default: class BadPlugin {
        async searchAnime() {
          return [];
        }
      },
    }));

    const registry = new PluginRegistry();
    const instance = await registry.instantiate("badplugin", {});
    expect(instance).toBeNull();
  });

  test("rejects module whose default export is not a constructor", async () => {
    mock.module("kogoro-plugin-stringplugin", () => ({
      default: "not a constructor",
    }));

    const registry = new PluginRegistry();
    const instance = await registry.instantiate("stringplugin", {});
    expect(instance).toBeNull();
  });

  test("instantiated external plugin works with scan handlers", async () => {
    mock.module("kogoro-plugin-extscan", () => ({
      default: class ExternalScanPlugin {
        async searchAnime(title: string) {
          return [{ id: "ext-1", title, entryType: "tv" as const }];
        }
        async getEpisodes(_animeId: string) {
          return [
            {
              id: "e1",
              animeId: "ext-1",
              season: 1,
              episode: 1,
              title: "Ep 1",
              entryType: "tv" as const,
            },
          ];
        }
        async getArtwork() {
          return [];
        }
        async getAnime() {
          return null;
        }
      },
    }));

    const registry = new PluginRegistry();
    const plugin = await registry.instantiate("extscan", {});
    expect(plugin).not.toBeNull();
    if (!plugin) return;

    await withTempDir("ext-plugin", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] External Test - 01.mkv", "content");
      const cache = createCache(dir);
      const handlers = createScanHandlers({ database: plugin, cache });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });
      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.parsed.title).toBe("External Test");
    });
  });

  describe("with disabled plugins", () => {
    test("returns null for disabled plugin", async () => {
      const registry = new PluginRegistry();
      registry.setDisabled(new Set(["tvdb"]));
      const instance = await registry.instantiate("tvdb", {});
      expect(instance).toBeNull();
    });
  });
});

describe("isSubtitlePlugin", () => {
  test("returns true for object implementing SubtitlePlugin", () => {
    const valid = {
      async search() {
        return [];
      },
      async download() {
        return "";
      },
    };
    expect(isSubtitlePlugin(valid)).toBe(true);
  });

  test("returns false for null", () => {
    expect(isSubtitlePlugin(null)).toBe(false);
  });

  test("returns false for plain object without required methods", () => {
    expect(isSubtitlePlugin({})).toBe(false);
  });

  test("returns false for object missing download method", () => {
    expect(isSubtitlePlugin({ search: async () => [] })).toBe(false);
  });
});

describe("PluginRegistry.setDisabled", () => {
  test("marks built-in plugin as disabled", () => {
    const registry = new PluginRegistry();
    registry.setDisabled(new Set(["tvdb"]));
    expect(registry.isEnabled("tvdb")).toBe(false);
    expect(registry.isEnabled("anidb")).toBe(true);
  });

  test("does not affect unlisted plugins", () => {
    const registry = new PluginRegistry();
    registry.setDisabled(new Set(["unknown"]));
    expect(registry.isEnabled("tvdb")).toBe(true);
  });

  test("disabled plugins appear as not enabled in the plugin list", () => {
    const registry = new PluginRegistry();
    registry.setDisabled(new Set(["anidb"]));
    const plugins = registry.list();
    const anidb = plugins.find((p) => p.name === "anidb");
    expect(anidb?.enabled).toBe(false);
    const tvdb = plugins.find((p) => p.name === "tvdb");
    expect(tvdb?.enabled).toBe(true);
  });

  test("re-enabling a plugin restores its entry", () => {
    const registry = new PluginRegistry();
    registry.setDisabled(new Set(["tvdb"]));
    expect(registry.isEnabled("tvdb")).toBe(false);
    registry.setDisabled(new Set());
    expect(registry.isEnabled("tvdb")).toBe(true);
  });
});

describe("PluginRegistry", () => {
  test("discovers built-in database plugins", () => {
    const registry = new PluginRegistry();
    const plugins = registry.list();
    const dbPlugins = plugins.filter((p) => p.type === "database");
    expect(dbPlugins.length).toBeGreaterThanOrEqual(2);
    expect(dbPlugins.some((p) => p.name === "tvdb")).toBe(true);
    expect(dbPlugins.some((p) => p.name === "anidb")).toBe(true);
  });

  test("discovers built-in subtitle plugin", () => {
    const registry = new PluginRegistry();
    const plugins = registry.list();
    const subPlugins = plugins.filter((p) => p.type === "subtitle");
    expect(subPlugins.some((p) => p.name === "opensubtitles")).toBe(true);
  });

  test("all built-in plugins are marked as built-in source", () => {
    const registry = new PluginRegistry();
    const plugins = registry.list();
    for (const p of plugins) {
      expect(p.source).toBe("built-in");
    }
  });

  test("all built-in plugins are initially enabled", () => {
    const registry = new PluginRegistry();
    const plugins = registry.list();
    for (const p of plugins) {
      expect(p.enabled).toBe(true);
    }
  });

  test("isEnabled returns true for unknown plugin by default", () => {
    const registry = new PluginRegistry();
    expect(registry.isEnabled("nonexistent")).toBe(true);
  });
});

describe("PluginRegistry.instantiateSubtitle", () => {
  test("returns null for non-existent subtitle plugin", async () => {
    const registry = new PluginRegistry();
    const instance = await registry.instantiateSubtitle("nonexistent", {});
    expect(instance).toBeNull();
  });

  test("returns null for disabled subtitle plugin", async () => {
    const registry = new PluginRegistry();
    registry.setDisabled(new Set(["opensubtitles"]));
    const instance = await registry.instantiateSubtitle("opensubtitles", {});
    expect(instance).toBeNull();
  });

  test("loads and returns an external subtitle plugin", async () => {
    const mockModule = {
      default: class MockSubtitlePlugin {
        options: Record<string, unknown>;
        constructor(options: Record<string, unknown>) {
          this.options = options;
        }
        async search() {
          return [];
        }
        async download() {
          return "";
        }
      },
    };
    mock.module("kogoro-plugin-testsubs", () => mockModule);

    const registry = new PluginRegistry();
    const instance = await registry.instantiateSubtitle("testsubs", { key: "value" });
    expect(instance).not.toBeNull();
    expect(instance?.search).toBeFunction();
    expect(instance?.download).toBeFunction();
  });

  test("rejects module whose default export is not a SubtitlePlugin", async () => {
    mock.module("kogoro-plugin-badsubs", () => ({
      default: class BadPlugin {
        async search() {
          return [];
        }
      },
    }));

    const registry = new PluginRegistry();
    const instance = await registry.instantiateSubtitle("badsubs", {});
    expect(instance).toBeNull();
  });

  test("caches subtitle instance and returns singleton on subsequent calls", async () => {
    const mockModule = {
      default: class SingletonSubtitle {
        id = Math.random();
        async search() {
          return [];
        }
        async download() {
          return "";
        }
      },
    };
    mock.module("kogoro-plugin-singletonsubs", () => mockModule);

    const registry = new PluginRegistry();
    const first = await registry.instantiateSubtitle("singletonsubs", {});
    const second = await registry.instantiateSubtitle("singletonsubs", {});
    expect(first).toBe(second);
  });
});
