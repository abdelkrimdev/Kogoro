import { describe, expect, test } from "bun:test";
import { isPluginEnabled, PluginRegistry } from "./plugin-registry";

describe("PluginRegistry", () => {
  describe("list", () => {
    test("returns all built-in database plugins", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      const dbPlugins = plugins.filter((p) => p.type === "database");
      expect(dbPlugins.some((p) => p.name === "tvdb")).toBe(true);
      expect(dbPlugins.some((p) => p.name === "anidb")).toBe(true);
    });

    test("returns built-in subtitle plugin", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      const subPlugins = plugins.filter((p) => p.type === "subtitle");
      expect(subPlugins.some((p) => p.name === "opensubtitles")).toBe(true);
    });

    test("returns built-in tracker plugins", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      const trackerPlugins = plugins.filter((p) => p.type === "tracker");
      expect(trackerPlugins.some((p) => p.name === "anilist")).toBe(true);
      expect(trackerPlugins.some((p) => p.name === "kitsu")).toBe(true);
    });

    test("marks disabled plugins", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list({ tvdb: { enabled: false } });
      const tvdb = plugins.find((p) => p.name === "tvdb");
      expect(tvdb?.enabled).toBe(false);
      const anidb = plugins.find((p) => p.name === "anidb");
      expect(anidb?.enabled).toBe(true);
    });

    test("all plugins enabled by default", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      for (const p of plugins) {
        expect(p.enabled).toBe(true);
      }
    });
  });

  describe("byName", () => {
    test("returns plugin info for known built-in plugin", () => {
      const registry = new PluginRegistry();
      const info = registry.byName("tvdb");
      expect(info).toBeDefined();
      expect(info?.name).toBe("tvdb");
      expect(info?.type).toBe("database");
      expect(info?.source).toBe("built-in");
    });

    test("returns undefined for unknown plugin", () => {
      const registry = new PluginRegistry();
      const info = registry.byName("nonexistent");
      expect(info).toBeUndefined();
    });

    test("returns subtitle plugin info", () => {
      const registry = new PluginRegistry();
      const info = registry.byName("opensubtitles");
      expect(info).toBeDefined();
      expect(info?.type).toBe("subtitle");
    });
  });

  describe("isPluginEnabled", () => {
    test("returns true when plugin is not configured", () => {
      expect(isPluginEnabled("tvdb")).toBe(true);
    });

    test("returns false when plugin is disabled", () => {
      expect(isPluginEnabled("tvdb", { tvdb: { enabled: false } })).toBe(false);
    });

    test("returns true when plugin is explicitly enabled", () => {
      expect(isPluginEnabled("tvdb", { tvdb: { enabled: true } })).toBe(true);
    });
  });
});
