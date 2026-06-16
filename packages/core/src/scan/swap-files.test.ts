import { describe, expect, test } from "bun:test";
import { makeReviewGroup } from "../fixtures";
import type { ReviewGroup } from "../types";
import { swapFilesInGroup } from "./swap-files";

describe("swapFilesInGroup", () => {
  test("swaps proposedPath between two files in same group", () => {
    const group = makeReviewGroup({
      files: [
        {
          fileId: "a",
          sourcePath: "/a.mkv",
          proposedPath: "Anime/S01E01.mkv",
        } as ReviewGroup["files"][0],
        {
          fileId: "b",
          sourcePath: "/b.mkv",
          proposedPath: "Anime/S01E02.mkv",
        } as ReviewGroup["files"][0],
      ],
    });

    const swapped = swapFilesInGroup([group], "a", "b");

    expect(swapped).toBe(true);
    expect(group.files[0]?.proposedPath).toBe("Anime/S01E02.mkv");
    expect(group.files[1]?.proposedPath).toBe("Anime/S01E01.mkv");
  });

  test("toggles swapPairs entry", () => {
    const group = makeReviewGroup({
      files: [
        {
          fileId: "a",
          sourcePath: "/a.mkv",
          proposedPath: "Anime/S01E01.mkv",
        } as ReviewGroup["files"][0],
        {
          fileId: "b",
          sourcePath: "/b.mkv",
          proposedPath: "Anime/S01E02.mkv",
        } as ReviewGroup["files"][0],
      ],
    });

    swapFilesInGroup([group], "a", "b");
    expect(group.swapPairs).toEqual([{ fileAId: "a", fileBId: "b" }]);

    swapFilesInGroup([group], "a", "b");
    expect(group.swapPairs).toEqual([]);
  });

  test("returns false when files not in same group", () => {
    const group1 = makeReviewGroup({
      files: [
        {
          fileId: "a",
          sourcePath: "/a.mkv",
          proposedPath: "Anime/S01E01.mkv",
        } as ReviewGroup["files"][0],
      ],
    });
    const group2 = makeReviewGroup({
      animeId: "anime-2",
      files: [
        {
          fileId: "b",
          sourcePath: "/b.mkv",
          proposedPath: "Anime/S01E02.mkv",
        } as ReviewGroup["files"][0],
      ],
    });

    const swapped = swapFilesInGroup([group1, group2], "a", "b");

    expect(swapped).toBe(false);
  });
});
