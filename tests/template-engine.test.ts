import { describe, expect, test } from "bun:test";
import { render } from "../src/template-engine.ts";

describe("TemplateEngine", () => {
  test("renders {placeholder} with simple string values", () => {
    expect(render("Hello {name}", { name: "World" })).toBe("Hello World");
  });

  test("formats {placeholder:02} with zero-padding", () => {
    expect(render("{episode:02}", { episode: 1 })).toBe("01");
    expect(render("{episode:02}", { episode: 13 })).toBe("13");
  });

  test("formats {placeholder:03} with 3-digit zero-padding", () => {
    expect(render("{episode:03}", { episode: 1 })).toBe("001");
  });

  test("returns empty string for missing variable", () => {
    expect(render("{missing}", {})).toBe("");
    expect(render("{unknown}", { name: "test" })).toBe("");
  });

  test("supports dotted keys like {title.en} and {title.jp}", () => {
    expect(render("{title.en}", { "title.en": "My Anime" })).toBe("My Anime");
    expect(render("{title.jp}", { "title.jp": "Anime Name" })).toBe("Anime Name");
  });

  test("renders default rename preset", () => {
    const ctx = { anime: "JJK", season: 1, episode: 13, title: "Tomorrow" };
    expect(render("{anime} - {season}x{episode:02} - {title}", ctx)).toBe("JJK - 1x13 - Tomorrow");
  });
});
