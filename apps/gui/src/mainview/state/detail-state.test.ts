import { describe, expect, it } from "bun:test";
import { makeEpisode } from "../../fixtures";
import { getAnimeDirectory } from "./detail-state";

describe("getAnimeDirectory", () => {
  it("returns directory from single episode filePath", () => {
    const episodes = [makeEpisode({ filePath: "/library/Steins;Gate/TV/1x01.mkv" })];
    expect(getAnimeDirectory(episodes)).toBe("/library/Steins;Gate/TV");
  });

  it("returns directory from first episode when given multiple episodes", () => {
    const episodes = [
      makeEpisode({ filePath: "/library/Steins;Gate/TV/1x01.mkv" }),
      makeEpisode({ id: "e2", episode: 2, filePath: "/library/Steins;Gate/TV/1x02.mkv" }),
    ];
    expect(getAnimeDirectory(episodes)).toBe("/library/Steins;Gate/TV");
  });

  it("returns null for empty episodes array", () => {
    expect(getAnimeDirectory([])).toBeNull();
  });

  it("returns null when all episodes have empty filePath", () => {
    const episodes = [makeEpisode({ filePath: "" }), makeEpisode({ id: "e2", filePath: "" })];
    expect(getAnimeDirectory(episodes)).toBeNull();
  });

  it("skips episodes with empty filePath", () => {
    const episodes = [
      makeEpisode({ filePath: "" }),
      makeEpisode({ id: "e2", filePath: "/library/Steins;Gate/TV/1x02.mkv" }),
    ];
    expect(getAnimeDirectory(episodes)).toBe("/library/Steins;Gate/TV");
  });

  it("returns null when filePath has no directory separator", () => {
    const episodes = [makeEpisode({ filePath: "video.mkv" })];
    expect(getAnimeDirectory(episodes)).toBeNull();
  });
});
