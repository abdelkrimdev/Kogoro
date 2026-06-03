import { describe, expect, it } from "bun:test";
import { makeEpisode, makeWatchStatus } from "../../fixtures";
import {
  computeWatchProgress,
  enrichEpisodesWithWatchStatus,
  type WatchStatusEntry,
} from "./watch-state";

describe("enrichEpisodesWithWatchStatus", () => {
  it("marks an episode as watched when watch status exists", () => {
    const episodes = [makeEpisode({ id: "e1" })];
    const watchStatuses = [makeWatchStatus({ episodeId: "e1", watched: true })];

    const result = enrichEpisodesWithWatchStatus(episodes, watchStatuses);

    expect(result).toHaveLength(1);
    expect(result[0]?.watched).toBe(true);
  });

  it("includes notes from watch status", () => {
    const episodes = [makeEpisode({ id: "e1" })];
    const watchStatuses = [
      makeWatchStatus({ episodeId: "e1", watched: true, notes: "great episode" }),
    ];

    const result = enrichEpisodesWithWatchStatus(episodes, watchStatuses);

    expect(result[0]?.notes).toBe("great episode");
  });

  it("defaults to not watched and no notes when status is absent", () => {
    const episodes = [makeEpisode({ id: "e1" }), makeEpisode({ id: "e2", episode: 2 })];
    const watchStatuses = [makeWatchStatus({ episodeId: "e1", watched: true })];

    const result = enrichEpisodesWithWatchStatus(episodes, watchStatuses);

    expect(result[0]?.watched).toBe(true);
    expect(result[1]?.watched).toBe(false);
    expect(result[1]?.notes).toBeUndefined();
  });

  it("handles an empty watch status array", () => {
    const episodes = [makeEpisode({ id: "e1" }), makeEpisode({ id: "e2", episode: 2 })];
    const watchStatuses: WatchStatusEntry[] = [];

    const result = enrichEpisodesWithWatchStatus(episodes, watchStatuses);

    expect(result).toHaveLength(2);
    expect(result[0]?.watched).toBe(false);
    expect(result[1]?.watched).toBe(false);
  });
});

describe("computeWatchProgress", () => {
  it("returns correct counts when some episodes are watched", () => {
    const episodes = [
      {
        id: "e1",
        season: 1,
        episode: 1,
        titleEn: "E1",
        filePath: "/a/1.mkv",
        missing: false,
        watched: true,
      },
      {
        id: "e2",
        season: 1,
        episode: 2,
        titleEn: "E2",
        filePath: "/a/2.mkv",
        missing: false,
        watched: false,
      },
      {
        id: "e3",
        season: 1,
        episode: 3,
        titleEn: "E3",
        filePath: "/a/3.mkv",
        missing: false,
        watched: true,
      },
    ];

    const result = computeWatchProgress(episodes);

    expect(result).toEqual({ watched: 2, total: 3, percent: 67 });
  });

  it("returns zeros when nothing is watched", () => {
    const episodes = [
      {
        id: "e1",
        season: 1,
        episode: 1,
        titleEn: "E1",
        filePath: "/a/1.mkv",
        missing: false,
        watched: false,
      },
      {
        id: "e2",
        season: 1,
        episode: 2,
        titleEn: "E2",
        filePath: "/a/2.mkv",
        missing: false,
        watched: false,
      },
    ];

    const result = computeWatchProgress(episodes);

    expect(result).toEqual({ watched: 0, total: 2, percent: 0 });
  });

  it("excludes missing episodes from the count", () => {
    const episodes = [
      {
        id: "e1",
        season: 1,
        episode: 1,
        titleEn: "E1",
        filePath: "/a/1.mkv",
        missing: false,
        watched: true,
      },
      {
        id: "e2",
        season: 1,
        episode: 2,
        titleEn: "E2",
        filePath: "",
        missing: true,
        watched: false,
      },
      {
        id: "e3",
        season: 1,
        episode: 3,
        titleEn: "E3",
        filePath: "/a/3.mkv",
        missing: false,
        watched: true,
      },
    ];

    const result = computeWatchProgress(episodes);

    expect(result).toEqual({ watched: 2, total: 2, percent: 100 });
  });

  it("returns 100% when all episodes are watched", () => {
    const episodes = [
      {
        id: "e1",
        season: 1,
        episode: 1,
        titleEn: "E1",
        filePath: "/a/1.mkv",
        missing: false,
        watched: true,
      },
      {
        id: "e2",
        season: 1,
        episode: 2,
        titleEn: "E2",
        filePath: "/a/2.mkv",
        missing: false,
        watched: true,
      },
    ];

    const result = computeWatchProgress(episodes);

    expect(result).toEqual({ watched: 2, total: 2, percent: 100 });
  });
});
