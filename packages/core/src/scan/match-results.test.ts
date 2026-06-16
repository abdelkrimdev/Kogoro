import { describe, expect, test } from "bun:test";
import { makeMatchResult, makeScanResult } from "../fixtures";
import { createGroupApproval } from "./group-approval";
import { buildMatchResults } from "./match-results";

describe("buildMatchResults", () => {
  test("returns empty array when no results exist", () => {
    const approval = createGroupApproval();
    expect(buildMatchResults([], new Map(), approval, "tvdb")).toEqual([]);
  });

  test("returns matched files with anime and episode data", () => {
    const approval = createGroupApproval();
    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({
          anime: { id: "tvdb-1", titleEn: "Anime A", entryType: "tv" },
          episode: {
            id: "ep-1",
            animeId: "tvdb-1",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv",
          },
        }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      animeId: "tvdb-1",
      animeTitle: "Anime A",
      entryType: "tv",
      episodeId: "ep-1",
      episode: 1,
      season: 1,
      title: "Ep 1",
      filePath: "/a/ep1.mkv",
      sourceDb: "tvdb",
    });
  });

  test("handles match without episode data", () => {
    const approval = createGroupApproval();
    const results = [
      makeScanResult("/a/movie.mkv", {
        match: makeMatchResult({
          anime: { id: "tvdb-10", titleEn: "A Movie", entryType: "movie" },
          episode: undefined,
        }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.episodeId).toBeNull();
    expect(entries[0]?.episode).toBeNull();
    expect(entries[0]?.season).toBeNull();
    expect(entries[0]?.title).toBeNull();
  });

  test("excludes ambiguous and failed results", () => {
    const approval = createGroupApproval();
    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "1", titleEn: "A", entryType: "tv" } }),
        status: "matched",
      }),
      makeScanResult("/a/amb.mkv", { status: "ambiguous" }),
      makeScanResult("/a/fail.mkv", { status: "failed" }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.filePath).toBe("/a/ep1.mkv");
  });

  test("includes cached results with match data", () => {
    const approval = createGroupApproval();
    const results = [
      makeScanResult("/a/cached.mkv", {
        match: makeMatchResult({ anime: { id: "tvdb-20", titleEn: "Anime B", entryType: "tv" } }),
        status: "cached",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.animeId).toBe("tvdb-20");
  });

  test("excludes rejected groups", () => {
    const approval = createGroupApproval();
    approval.reject("tvdb-a");

    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "tvdb-a", titleEn: "Anime A", entryType: "tv" } }),
        status: "matched",
      }),
      makeScanResult("/b/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "tvdb-b", titleEn: "Anime B", entryType: "tv" } }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.animeId).toBe("tvdb-b");
  });

  test("only includes explicitly approved groups when approvals exist", () => {
    const approval = createGroupApproval();
    approval.approve("tvdb-a");

    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "tvdb-a", titleEn: "Anime A", entryType: "tv" } }),
        status: "matched",
      }),
      makeScanResult("/b/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "tvdb-b", titleEn: "Anime B", entryType: "tv" } }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.animeId).toBe("tvdb-a");
  });

  test("uses canonicalIdMap to remap anime IDs", () => {
    const approval = createGroupApproval();
    const canonicalIdMap = new Map([["tvdb-alias", "tvdb-canonical"]]);

    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({
          anime: { id: "tvdb-alias", titleEn: "Anime A", entryType: "tv" },
        }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, canonicalIdMap, approval, "tvdb");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.animeId).toBe("tvdb-canonical");
  });

  test("respects sourceDb parameter", () => {
    const approval = createGroupApproval();
    const results = [
      makeScanResult("/a/ep1.mkv", {
        match: makeMatchResult({ anime: { id: "1", titleEn: "A", entryType: "tv" } }),
        status: "matched",
      }),
    ];

    const entries = buildMatchResults(results, new Map(), approval, "anidb");
    expect(entries[0]?.sourceDb).toBe("anidb");
  });
});
