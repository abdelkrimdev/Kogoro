import { describe, expect, test } from "bun:test";
import { isPluginEnabled, listPlugins } from "./plugin-registry";

describe("listPlugins", () => {
  test("returns all built-in database plugins", () => {
    const plugins = listPlugins();
    const dbPlugins = plugins.filter((p) => p.type === "database");
    expect(dbPlugins.some((p) => p.name === "tvdb")).toBe(true);
    expect(dbPlugins.some((p) => p.name === "anidb")).toBe(true);
  });

  test("returns built-in subtitle plugin", () => {
    const plugins = listPlugins();
    const subPlugins = plugins.filter((p) => p.type === "subtitle");
    expect(subPlugins.some((p) => p.name === "opensubtitles")).toBe(true);
  });

  test("returns built-in tracker plugins", () => {
    const plugins = listPlugins();
    const trackerPlugins = plugins.filter((p) => p.type === "tracker");
    expect(trackerPlugins.some((p) => p.name === "anilist")).toBe(true);
    expect(trackerPlugins.some((p) => p.name === "kitsu")).toBe(true);
    expect(trackerPlugins.some((p) => p.name === "mal")).toBe(true);
  });

  test("marks disabled plugins", () => {
    const plugins = listPlugins({ tvdb: { enabled: false } });
    const tvdb = plugins.find((p) => p.name === "tvdb");
    expect(tvdb?.enabled).toBe(false);
    const anidb = plugins.find((p) => p.name === "anidb");
    expect(anidb?.enabled).toBe(true);
  });

  test("all plugins enabled by default", () => {
    const plugins = listPlugins();
    for (const p of plugins) {
      expect(p.enabled).toBe(true);
    }
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
