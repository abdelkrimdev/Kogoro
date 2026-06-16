import { describe, expect, test } from "bun:test";
import { makeReviewGroup } from "../fixtures";
import type { ReviewGroup } from "../types";
import { findFileSourcePath } from "./resolve-match";

describe("findFileSourcePath", () => {
  test("returns sourcePath when file exists in group", () => {
    const group = makeReviewGroup({
      files: [
        { fileId: "a", sourcePath: "/a/ep1.mkv" } as ReviewGroup["files"][0],
        { fileId: "b", sourcePath: "/b/ep2.mkv" } as ReviewGroup["files"][0],
      ],
    });

    expect(findFileSourcePath([group], "b")).toBe("/b/ep2.mkv");
  });

  test("returns null when file not found in any group", () => {
    const group = makeReviewGroup({
      files: [{ fileId: "a", sourcePath: "/a/ep1.mkv" } as ReviewGroup["files"][0]],
    });

    expect(findFileSourcePath([group], "z")).toBeNull();
  });

  test("searches across multiple groups", () => {
    const group1 = makeReviewGroup({
      files: [{ fileId: "a", sourcePath: "/a/ep1.mkv" } as ReviewGroup["files"][0]],
    });
    const group2 = makeReviewGroup({
      animeId: "anime-2",
      files: [{ fileId: "b", sourcePath: "/b/ep1.mkv" } as ReviewGroup["files"][0]],
    });

    expect(findFileSourcePath([group1, group2], "b")).toBe("/b/ep1.mkv");
  });

  test("returns null for empty groups", () => {
    expect(findFileSourcePath([], "a")).toBeNull();
  });
});
