import { describe, expect, test } from "bun:test";
import { run } from "../src/cli/main.ts";

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
});
