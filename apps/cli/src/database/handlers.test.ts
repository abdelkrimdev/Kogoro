import { describe, expect, test } from "bun:test";
import { createMockPlugin, makeThrowingDb } from "../fixtures";
import { createDatabaseHandlers } from "./handlers";

describe("DB CLI commands", () => {
  test("search returns anime results", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.search("Jujutsu Kaisen");
    expect(results).toHaveLength(1);
    expect(results[0]?.titleEn).toBe("Jujutsu Kaisen");
  });

  test("search returns empty array for no matches", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.search("Unknown");
    expect(results).toEqual([]);
  });

  test("episodes returns anime episodes", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.episodes("12345");
    expect(results).toHaveLength(1);
    expect(results[0]?.titleEn).toBe("Ryomen Sukuna");
  });

  test("episodes returns empty array for missing anime", async () => {
    const plugin = createMockPlugin();
    const commands = createDatabaseHandlers(plugin);
    const results = await commands.episodes("99999");
    expect(results).toEqual([]);
  });

  test("search throws on plugin error", async () => {
    const failingPlugin = makeThrowingDb();
    const commands = createDatabaseHandlers(failingPlugin);
    await expect(commands.search("Anything")).rejects.toThrow("Should not be called");
  });
});
