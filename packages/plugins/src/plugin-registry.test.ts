import { describe, expect, test } from "bun:test";
import { withTestConfig } from "@kogoro/core/testing";
import { PluginRegistry } from "./plugin-registry";

describe("PluginRegistry", () => {
  describe("list", () => {
    test("returns all built-in database plugins", async () => {
      await withTestConfig(
        "registry-list-db",
        async (_dir, config) => {
          const registry = new PluginRegistry();
          const plugins = registry.list(config);
          const dbPlugins = plugins.filter((p) => p.type === "database");
          expect(dbPlugins.some((p) => p.name === "tvdb")).toBe(true);
          expect(dbPlugins.some((p) => p.name === "anidb")).toBe(true);
        },
        null,
      );
    });

    test("returns built-in subtitle plugin", async () => {
      await withTestConfig(
        "registry-list-sub",
        async (_dir, config) => {
          const registry = new PluginRegistry();
          const plugins = registry.list(config);
          const subPlugins = plugins.filter((p) => p.type === "subtitle");
          expect(subPlugins.some((p) => p.name === "opensubtitles")).toBe(true);
        },
        null,
      );
    });

    test("marks disabled plugins", async () => {
      await withTestConfig(
        "registry-disabled",
        async (_dir, config) => {
          config.set("plugins.tvdb.enabled", "false");
          const registry = new PluginRegistry();
          const plugins = registry.list(config);
          const tvdb = plugins.find((p) => p.name === "tvdb");
          expect(tvdb?.enabled).toBe(false);
          const anidb = plugins.find((p) => p.name === "anidb");
          expect(anidb?.enabled).toBe(true);
        },
        null,
      );
    });

    test("all plugins enabled by default", async () => {
      await withTestConfig(
        "registry-all-enabled",
        async (_dir, config) => {
          const registry = new PluginRegistry();
          const plugins = registry.list(config);
          for (const p of plugins) {
            expect(p.enabled).toBe(true);
          }
        },
        null,
      );
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
});
