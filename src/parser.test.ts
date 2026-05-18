import { describe, expect, test } from "bun:test";
import { parse } from "./parser.ts";

describe("FilenameParser", () => {
  test("parses [Group] Anime Title - 01 (1080p).mkv", () => {
    const result = parse("[SubsPlease] Jujutsu Kaisen - 01 (1080p).mkv");
    expect(result.title).toBe("Jujutsu Kaisen");
    expect(result.episode).toBe(1);
    expect(result.season).toBeNull();
  });

  test("parses Anime Title - S01E13.mkv", () => {
    const result = parse("Anime Title - S01E13.mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.season).toBe(1);
    expect(result.episode).toBe(13);
  });

  test("parses Anime Title - 12 [1080p].mkv", () => {
    const result = parse("Anime Title - 12 [1080p].mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.episode).toBe(12);
  });

  test("extracts metadata tags: group, resolution, codec", () => {
    const result = parse("[Group] Anime Title - 01 (1080p) [HEVC].mkv");
    expect(result.title).toBe("Anime Title");
    expect(result.episode).toBe(1);
    expect(result.tags.group).toBe("Group");
    expect(result.tags.resolution).toBe("1080p");
    expect(result.tags.codec).toBe("HEVC");
  });

  test("parses movie filename with no episode number", () => {
    const result = parse("[Group] Anime Title The Movie.mkv");
    expect(result.title).toBe("Anime Title The Movie");
    expect(result.episode).toBeNull();
    expect(result.tags.group).toBe("Group");
  });

  test("parses absolute numbering: One Piece - 1071", () => {
    const result = parse("[Group] One Piece - 1071.mkv");
    expect(result.title).toBe("One Piece");
    expect(result.episode).toBe(1071);
  });

  test("returns empty result for garbage filenames", () => {
    const result = parse("completely.garbage.filename.avi");
    expect(result.title).toBeNull();
    expect(result.episode).toBeNull();
    expect(result.season).toBeNull();
  });

  test("returns empty result for empty string", () => {
    const result = parse("");
    expect(result.title).toBeNull();
    expect(result.episode).toBeNull();
  });

  test("uses custom regex pattern from options", () => {
    const customPattern = /^CUSTOM_(?<title>.+?)_(?<episode>\d+)$/;
    const result = parse("CUSTOM_My Anime_42.mkv", {
      patterns: [customPattern],
    });
    expect(result.title).toBe("My Anime");
    expect(result.episode).toBe(42);
    expect(result.season).toBeNull();
  });

  test("custom patterns override defaults", () => {
    const result = parse("[SubsPlease] Jujutsu Kaisen - 01 (1080p).mkv", {
      patterns: [],
    });
    expect(result.title).toBeNull();
  });

  test("handles spaces in title correctly", () => {
    const result = parse("[Group] Anime Title With - 05.mkv");
    expect(result.title).toBe("Anime Title With");
    expect(result.episode).toBe(5);
  });
});
