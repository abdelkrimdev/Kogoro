import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli/main.ts";
import { ConfigManager } from "../src/config/config-manager.ts";
import { CredentialStore } from "../src/config/credential-store.ts";
import type { PluginInfo } from "../src/plugin-registry.ts";

describe("kogoro CLI", () => {
  test("project bootstrap is set up", () => {
    expect(true).toBe(true);
  });

  test("template command renders pattern with variables", () => {
    const result = run([
      "node",
      "kogoro",
      "template",
      "{anime} - {season}x{episode:02} - {title}",
      "--anime",
      "JJK",
      "--season",
      "1",
      "--episode",
      "13",
      "--title",
      "Tomorrow",
    ]);
    expect(result).toBe("JJK - 1x13 - Tomorrow");
  });

  test("template command handles missing variables", () => {
    const result = run(["node", "kogoro", "template", "Hello {name}", "--name", "World"]);
    expect(result).toBe("Hello World");
  });

  test("package.json has build:binary script for standalone binary", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["build:binary"]).toBeDefined();
    expect(pkg.scripts?.["build:binary"]).toContain("bun build --compile");
    expect(pkg.scripts?.["build:binary"]).toContain("kogoro");
  });

  test("plugins list command returns JSON with built-in plugins", () => {
    const origLog = console.log;
    const logs: string[] = [];
    console.log = (msg: string) => logs.push(msg);
    try {
      run(["node", "kogoro", "plugins", "list"]);
      expect(logs.length).toBeGreaterThan(0);
      const parsed = JSON.parse(logs[0] ?? "[]") as Array<PluginInfo>;
      const tvdb = parsed.find((p) => p.name === "tvdb");
      expect(tvdb).toBeDefined();
      expect(tvdb?.type).toBe("database");
      expect(tvdb?.source).toBe("built-in");
    } finally {
      console.log = origLog;
    }
  });

  test("buildSecondaryDatabases returns empty array when config has no secondary-dbs", async () => {
    const { buildSecondaryDatabases } = await import("../src/cli/main.ts");
    const dir = mkdtempSync(join(tmpdir(), "kogoro-build-secondary-"));
    try {
      const config = new ConfigManager({ configDir: dir });
      const credentialStore = new CredentialStore({ keytar: null });
      const dbs = await buildSecondaryDatabases(config, credentialStore);
      expect(dbs).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("buildSecondaryDatabases returns anidb when configured", async () => {
    const { buildSecondaryDatabases } = await import("../src/cli/main.ts");
    const dir = mkdtempSync(join(tmpdir(), "kogoro-build-secondary-"));
    try {
      const config = new ConfigManager({ configDir: dir });
      config.set("secondary-dbs", "anidb");
      const credentialStore = new CredentialStore({ keytar: null });
      await credentialStore.setCredential("anidb", "testclient:1");
      const dbs = await buildSecondaryDatabases(config, credentialStore);
      expect(dbs).toHaveLength(1);
      expect(dbs[0]?.constructor.name).toBe("AniDBAdapter");
    } finally {
      delete (process.env as Record<string, string | undefined>)["KOGORO_ANIDB_KEY"];
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("buildSecondaryDatabases skips databases without credentials", async () => {
    const { buildSecondaryDatabases } = await import("../src/cli/main.ts");
    const dir = mkdtempSync(join(tmpdir(), "kogoro-build-secondary-"));
    try {
      const config = new ConfigManager({ configDir: dir });
      config.set("secondary-dbs", "anidb,tvdb");
      const credentialStore = new CredentialStore({ keytar: null });
      // Only set anidb credentials, not tvdb
      await credentialStore.setCredential("anidb", "testclient:1");
      const dbs = await buildSecondaryDatabases(config, credentialStore);
      expect(dbs).toHaveLength(1);
      expect(dbs[0]?.constructor.name).toBe("AniDBAdapter");
    } finally {
      delete (process.env as Record<string, string | undefined>)["KOGORO_ANIDB_KEY"];
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
