import { describe, expect, test } from "bun:test";
import {
  detectSwaps,
  extractEpisodeFromPath,
  extractSeasonFromPath,
  type SwapInputEntry,
} from "./swap-detection";

function makeEntry(overrides: Partial<SwapInputEntry> & { fileId: string }): SwapInputEntry {
  return {
    filePath: `/a/${overrides.fileId}.mkv`,
    animeId: "1",
    season: 1,
    episode: 1,
    proposedEpisode: null,
    proposedSeason: null,
    ...overrides,
  };
}

describe("detectSwaps", () => {
  test("detects episode transposition between two files", () => {
    const entries = [
      makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: 2 }),
      makeEntry({ fileId: "ep2", episode: 2, proposedEpisode: 1 }),
    ];

    const swaps = detectSwaps(entries);

    expect(swaps).toHaveLength(1);
    expect(swaps[0]?.fileAId).toBe("ep1");
    expect(swaps[0]?.fileBId).toBe("ep2");
    expect(swaps[0]?.episodeA).toBe(2);
    expect(swaps[0]?.episodeB).toBe(1);
  });

  test("returns empty array when no swaps detected", () => {
    const entries = [
      makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: 1 }),
      makeEntry({ fileId: "ep2", episode: 2, proposedEpisode: 2 }),
    ];

    const swaps = detectSwaps(entries);
    expect(swaps).toHaveLength(0);
  });

  test("detects cross-season swaps", () => {
    const entries = [
      makeEntry({ fileId: "ep1", season: 1, episode: 1, proposedSeason: 2, proposedEpisode: 1 }),
      makeEntry({ fileId: "ep2", season: 2, episode: 1, proposedSeason: 1, proposedEpisode: 1 }),
    ];

    const swaps = detectSwaps(entries);

    expect(swaps).toHaveLength(1);
    expect(swaps[0]?.seasonA).toBe(2);
    expect(swaps[0]?.seasonB).toBe(1);
  });

  test("ignores entries without proposed episodes", () => {
    const entries = [makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: null })];

    const swaps = detectSwaps(entries);
    expect(swaps).toHaveLength(0);
  });

  test("detects multiple swap pairs", () => {
    const entries = [
      makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: 3 }),
      makeEntry({ fileId: "ep2", episode: 2, proposedEpisode: 4 }),
      makeEntry({ fileId: "ep3", episode: 3, proposedEpisode: 1 }),
      makeEntry({ fileId: "ep4", episode: 4, proposedEpisode: 2 }),
    ];

    const swaps = detectSwaps(entries);

    expect(swaps).toHaveLength(2);
  });

  test("skips entries with different anime IDs", () => {
    const entries = [
      makeEntry({ fileId: "ep1", animeId: "1", episode: 1, proposedEpisode: 2 }),
      makeEntry({ fileId: "ep2", animeId: "2", episode: 2, proposedEpisode: 1 }),
    ];

    const swaps = detectSwaps(entries);
    expect(swaps).toHaveLength(0);
  });

  test("does not detect non-swap transpositions", () => {
    const entries = [
      makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: 2 }),
      makeEntry({ fileId: "ep2", episode: 2, proposedEpisode: 3 }),
    ];

    const swaps = detectSwaps(entries);
    expect(swaps).toHaveLength(0);
  });

  test("marks visited entries to avoid duplicate swaps", () => {
    const entries = [
      makeEntry({ fileId: "ep1", episode: 1, proposedEpisode: 2 }),
      makeEntry({ fileId: "ep2", episode: 2, proposedEpisode: 1 }),
      makeEntry({ fileId: "ep3", episode: 3, proposedEpisode: 1 }),
    ];

    const swaps = detectSwaps(entries);
    expect(swaps).toHaveLength(1);
  });

  test("uses proposedSeason from proposedPath when available", () => {
    const entries = [
      makeEntry({
        fileId: "ep1",
        season: 1,
        episode: 1,
        proposedSeason: 2,
        proposedEpisode: 1,
      }),
      makeEntry({
        fileId: "ep2",
        season: 2,
        episode: 1,
        proposedSeason: 1,
        proposedEpisode: 1,
      }),
    ];

    const swaps = detectSwaps(entries);

    expect(swaps).toHaveLength(1);
    expect(swaps[0]?.seasonA).toBe(2);
    expect(swaps[0]?.seasonB).toBe(1);
  });
});

describe("extractEpisodeFromPath", () => {
  test("extracts episode number from path", () => {
    expect(extractEpisodeFromPath("Jujutsu Kaisen/Season 1/S01E02.mkv")).toBe(2);
    expect(extractEpisodeFromPath("Show/Season 1/E12.mkv")).toBe(12);
  });

  test("returns null for null path", () => {
    expect(extractEpisodeFromPath(null)).toBeNull();
  });

  test("returns null for path without episode pattern", () => {
    expect(extractEpisodeFromPath("Jujutsu Kaisen/movie.mkv")).toBeNull();
  });
});

describe("extractSeasonFromPath", () => {
  test("extracts season number from path", () => {
    expect(extractSeasonFromPath("Jujutsu Kaisen/Season 1/S01E02.mkv")).toBe(1);
    expect(extractSeasonFromPath("Show/Season 3/E05.mkv")).toBe(3);
  });

  test("returns null for null path", () => {
    expect(extractSeasonFromPath(null)).toBeNull();
  });

  test("returns null for path without season pattern", () => {
    expect(extractSeasonFromPath("Show/E05.mkv")).toBeNull();
  });
});
