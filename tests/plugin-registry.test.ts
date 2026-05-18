import { describe, expect, test } from "bun:test";
import { PluginRegistry } from "../src/plugin-registry.ts";

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
});
