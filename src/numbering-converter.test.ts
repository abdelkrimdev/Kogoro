import { describe, expect, test } from "bun:test";
import {
  absoluteToRelative,
  convertEpisodeNumbering,
  relativeToAbsolute,
} from "./numbering-converter";
import { makeEpisodes } from "./test-helpers";

describe("relativeToAbsolute", () => {
  test("converts season-relative to absolute for 2-season anime (24 eps each)", () => {
    const episodes = makeEpisodes(24, 2);
    expect(relativeToAbsolute(1, 24, episodes)).toBe(24);
    expect(relativeToAbsolute(2, 1, episodes)).toBe(25);
    expect(relativeToAbsolute(2, 24, episodes)).toBe(48);
  });
});

describe("absoluteToRelative", () => {
  test("converts AniDB-style absolute to relative for single-season anime", () => {
    const episodes = makeEpisodes(24, 1);
    expect(absoluteToRelative(1, episodes)).toEqual({ season: 1, episode: 1 });
    expect(absoluteToRelative(24, episodes)).toEqual({ season: 1, episode: 24 });
  });

  test("converts absolute to relative for multi-season anime with proper season data", () => {
    const episodes = makeEpisodes(24, 2);
    expect(absoluteToRelative(1, episodes)).toEqual({ season: 1, episode: 1 });
    expect(absoluteToRelative(24, episodes)).toEqual({ season: 1, episode: 24 });
    expect(absoluteToRelative(25, episodes)).toEqual({ season: 2, episode: 1 });
    expect(absoluteToRelative(48, episodes)).toEqual({ season: 2, episode: 24 });
  });
});

describe("convertEpisodeNumbering", () => {
  test("returns same values when source matches preferred scheme", () => {
    const episodes = makeEpisodes(24, 1);
    expect(convertEpisodeNumbering(1, 13, episodes, "relative", "relative")).toEqual({
      season: 1,
      episode: 13,
    });
    expect(convertEpisodeNumbering(1, 13, episodes, "absolute", "absolute")).toEqual({
      season: 1,
      episode: 13,
    });
  });

  test("converts relative to absolute", () => {
    const episodes = makeEpisodes(24, 2);
    expect(convertEpisodeNumbering(2, 1, episodes, "relative", "absolute")).toEqual({
      season: 2,
      episode: 25,
    });
  });

  test("converts absolute to relative", () => {
    const episodes = makeEpisodes(24, 2);
    expect(convertEpisodeNumbering(2, 25, episodes, "absolute", "relative")).toEqual({
      season: 2,
      episode: 1,
    });
  });

  test("returns null when conversion is not possible", () => {
    expect(convertEpisodeNumbering(1, 1, [], "relative", "absolute")).toBeNull();
    expect(convertEpisodeNumbering(1, 99, makeEpisodes(24, 1), "absolute", "relative")).toBeNull();
  });
});

describe("edge cases", () => {
  describe("relativeToAbsolute", () => {
    test("returns null for empty episode list", () => {
      expect(relativeToAbsolute(1, 1, [])).toBeNull();
    });

    test("handles season 0 (special-like) by returning null", () => {
      expect(relativeToAbsolute(0, 1, [])).toBeNull();
    });

    test("handles uneven season sizes (One Piece-like)", () => {
      const season1 = makeEpisodes(61, 1);
      const season2 = makeEpisodes(73, 1).map((e) => ({ ...e, season: 2, episode: e.episode }));
      const episodes = [...season1, ...season2];
      expect(relativeToAbsolute(1, 1, episodes)).toBe(1);
      expect(relativeToAbsolute(1, 61, episodes)).toBe(61);
      expect(relativeToAbsolute(2, 1, episodes)).toBe(62);
      expect(relativeToAbsolute(2, 73, episodes)).toBe(134);
    });
  });

  describe("absoluteToRelative", () => {
    test("returns null for empty episode list", () => {
      expect(absoluteToRelative(1, [])).toBeNull();
    });

    test("returns null when episode exceeds total count", () => {
      const episodes = makeEpisodes(24, 1);
      expect(absoluteToRelative(25, episodes)).toBeNull();
    });

    test("handles multiple seasons with uneven episode counts", () => {
      const season1 = makeEpisodes(61, 1);
      const season2 = makeEpisodes(73, 1).map((e) => ({ ...e, season: 2, episode: e.episode }));
      const episodes = [...season1, ...season2];
      expect(absoluteToRelative(1, episodes)).toEqual({ season: 1, episode: 1 });
      expect(absoluteToRelative(61, episodes)).toEqual({ season: 1, episode: 61 });
      expect(absoluteToRelative(62, episodes)).toEqual({ season: 2, episode: 1 });
      expect(absoluteToRelative(134, episodes)).toEqual({ season: 2, episode: 73 });
    });
  });
});
