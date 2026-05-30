import { describe, expect, test } from "bun:test";
import { PluginRegistry } from "./plugin-registry";

describe("PluginRegistry", () => {
  describe("setDisabled", () => {
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

    test("marks plugin as disabled in the plugin list", () => {
      const registry = new PluginRegistry();
      registry.setDisabled(new Set(["anidb"]));
      const plugins = registry.list();
      const anidb = plugins.find((p) => p.name === "anidb");
      expect(anidb?.enabled).toBe(false);
      const tvdb = plugins.find((p) => p.name === "tvdb");
      expect(tvdb?.enabled).toBe(true);
    });

    test("restores enabled state when re-enabled", () => {
      const registry = new PluginRegistry();
      registry.setDisabled(new Set(["tvdb"]));
      expect(registry.isEnabled("tvdb")).toBe(false);
      registry.setDisabled(new Set());
      expect(registry.isEnabled("tvdb")).toBe(true);
    });
  });

  describe("isEnabled", () => {
    test("returns true for unknown plugin by default", () => {
      const registry = new PluginRegistry();
      expect(registry.isEnabled("nonexistent")).toBe(true);
    });
  });

  describe("list", () => {
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

    test("marks all entries as built-in source", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      for (const p of plugins) {
        expect(p.source).toBe("built-in");
      }
    });

    test("returns all entries as initially enabled", () => {
      const registry = new PluginRegistry();
      const plugins = registry.list();
      for (const p of plugins) {
        expect(p.enabled).toBe(true);
      }
    });
  });
});
