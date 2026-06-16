import { describe, expect, test } from "bun:test";
import type { ParsedTags } from "./parser";
import { createEmptyResult, resolve } from "./resolve";

function emptyTags(): ParsedTags {
  return { group: null, resolution: null, source: null, codec: null, audio: null };
}

describe("createEmptyResult", () => {
  test("returns result with all null fields", () => {
    const result = createEmptyResult();
    expect(result.title).toBeNull();
    expect(result.season).toBeNull();
    expect(result.episode).toBeNull();
    expect(result.tags.group).toBeNull();
    expect(result.tags.resolution).toBeNull();
    expect(result.tags.source).toBeNull();
    expect(result.tags.codec).toBeNull();
    expect(result.tags.audio).toBeNull();
  });
});

describe("resolve", () => {
  describe("S##E## pattern", () => {
    test("extracts season and episode from S01E13", () => {
      const result = resolve("Anime Title - S01E13.mkv", "Anime Title - S01E13", emptyTags());
      expect(result.title).toBe("Anime Title");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(13);
    });

    test("extracts season and episode from S02E00", () => {
      const result = resolve(
        "[Judas] Tonikaku Kawaii - S02E00.mkv",
        "[Judas] Tonikaku Kawaii - S02E00",
        { ...emptyTags(), group: "Judas" },
      );
      expect(result.title).toBe("[Judas] Tonikaku Kawaii");
      expect(result.season).toBe(2);
      expect(result.episode).toBe(0);
    });
  });

  describe("S## - ## pattern", () => {
    test("extracts season and episode from S01 - 13", () => {
      const result = resolve("Title - S01 - 13.mkv", "Title - S01 - 13", emptyTags());
      expect(result.title).toBe("Title");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(13);
    });
  });

  describe("NxEx pattern", () => {
    test("extracts season and episode from 1x01", () => {
      const result = resolve(
        "Oshi no Ko - 1x01 - Name.mkv",
        "Oshi no Ko - 1x01 - Name",
        emptyTags(),
      );
      expect(result.title).toBe("Oshi no Ko");
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
    });
  });

  describe("dash-episode pattern", () => {
    test("extracts episode from trailing dash number", () => {
      const result = resolve("[Group] Title - 01 (1080p).mkv", "[Group] Title - 01", {
        ...emptyTags(),
        group: "Group",
      });
      expect(result.title).toBe("[Group] Title");
      expect(result.episode).toBe(1);
    });

    test("does not treat year-like numbers as episodes", () => {
      const result = resolve("Title 2024.mkv", "Title 2024", emptyTags());
      expect(result.episode).toBeNull();
    });
  });

  describe("title cleanup", () => {
    test("removes ordinal season qualifier from title", () => {
      const result = resolve(
        "[Group] Bungo Stray Dogs S5 - 01 [1080p].mkv",
        "[Group] Bungo Stray Dogs S5 - 01",
        { ...emptyTags(), group: "Group", resolution: "1080p" },
      );
      expect(result.title).toBe("[Group] Bungo Stray Dogs");
      expect(result.season).toBe(5);
      expect(result.episode).toBe(1);
    });

    test("removes Season N qualifier from title", () => {
      const result = resolve("Title Season 2 - 01.mkv", "Title Season 2 - 01", emptyTags());
      expect(result.title).toBe("Title");
      expect(result.season).toBe(2);
    });

    test("removes word-based season qualifier from title", () => {
      const result = resolve(
        "Title Second Season - 01.mkv",
        "Title Second Season - 01",
        emptyTags(),
      );
      expect(result.title).toBe("Title");
      expect(result.season).toBe(2);
    });
  });

  describe("prefix group extraction", () => {
    test("extracts group from dot-separated prefix when no leading group", () => {
      const result = resolve(
        "Shangri-La.Frontier - T3KASHi.mkv",
        "Shangri-La.Frontier - T3KASHi",
        emptyTags(),
      );
      expect(result.tags.group).toBe("Shangri-La.Frontier");
      expect(result.title).toBe("T3KASHi");
    });

    test("does not extract prefix group when leading group exists", () => {
      const result = resolve("[Group] Title - 01.mkv", "[Group] Title - 01", {
        ...emptyTags(),
        group: "Group",
      });
      expect(result.tags.group).toBe("Group");
    });
  });

  describe("empty result logic", () => {
    test("returns empty for garbage filename with no spaces", () => {
      const result = resolve(
        "completely.garbage.filename",
        "completely garbage filename",
        emptyTags(),
      );
      expect(result.title).toBeNull();
      expect(result.episode).toBeNull();
    });

    test("returns empty for empty string", () => {
      const result = resolve("", "", emptyTags());
      expect(result.title).toBeNull();
    });

    test("does not return empty when tags are present", () => {
      const result = resolve("Title.mkv", "Title", {
        ...emptyTags(),
        resolution: "1080p",
      });
      expect(result.title).toBe("Title");
    });

    test("does not return empty when group is present", () => {
      const result = resolve("Title.mkv", "Title", {
        ...emptyTags(),
        group: "Group",
      });
      expect(result.title).toBe("Title");
    });

    test("does not return empty when year is present in filename", () => {
      const result = resolve("100.Meters.2025.1080p.mkv", "100 Meters 2025 1080p", emptyTags());
      expect(result.title).toBe("100 Meters 2025 1080p");
    });
  });

  describe("tag passthrough", () => {
    test("passes through all tag fields", () => {
      const tags: ParsedTags = {
        group: "Group",
        resolution: "1080p",
        source: "web-dl",
        codec: "hevc",
        audio: "aac",
      };
      const result = resolve("[Group] Title - 01.mkv", "[Group] Title - 01", tags);
      expect(result.tags.group).toBe("Group");
      expect(result.tags.resolution).toBe("1080p");
      expect(result.tags.source).toBe("web-dl");
      expect(result.tags.codec).toBe("hevc");
      expect(result.tags.audio).toBe("aac");
    });

    test("converts empty strings to null", () => {
      const tags: ParsedTags = {
        group: "",
        resolution: "",
        source: "",
        codec: "",
        audio: "",
      };
      const result = resolve("[Group] Title - 01.mkv", "[Group] Title - 01", tags);
      expect(result.tags.group).toBeNull();
      expect(result.tags.resolution).toBeNull();
    });
  });
});
