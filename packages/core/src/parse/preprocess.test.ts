import { describe, expect, test } from "bun:test";
import { preprocess, stripExtension } from "./preprocess";

describe("stripExtension", () => {
  test("removes file extension", () => {
    expect(stripExtension("file.mkv")).toBe("file");
  });

  test("removes only the last extension", () => {
    expect(stripExtension("file.tar.gz")).toBe("file.tar");
  });

  test("returns name unchanged when no extension", () => {
    expect(stripExtension("noext")).toBe("noext");
  });

  test("handles empty string", () => {
    expect(stripExtension("")).toBe("");
  });
});

describe("preprocess", () => {
  test("strips extension and normalizes underscores", () => {
    const result = preprocess("Anime_Title_Ep01.mkv");
    expect(result.name).toBe("Anime Title Ep01");
  });

  test("strips corrupted extension patterns", () => {
    const result = preprocess("Anime - 01 [720p].mkv].mkv", [".mkv"]);
    expect(result.name).toBe("Anime - 01 [720p]");
  });

  test("adds missing opening bracket when closing bracket exists", () => {
    const result = preprocess("Group] Anime - 01.mkv");
    expect(result.name).toBe("[Group] Anime - 01");
  });

  test("does not double brackets when already present", () => {
    const result = preprocess("[Group] Anime - 01.mkv");
    expect(result.name).toBe("[Group] Anime - 01");
  });

  test("converts dots to spaces when no spaces exist", () => {
    const result = preprocess("Amagi.Brilliant.Park.S01E01.mkv");
    expect(result.name).toBe("Amagi Brilliant Park S01E01");
  });

  test("preserves dots in h264/h265 codec patterns", () => {
    const result = preprocess("Title.1080p.H.264-Group.mkv");
    expect(result.name).toContain("H.264");
  });

  test("preserves dots in domain-like group names", () => {
    const result = preprocess("Title.01.[720-x265].takanime.pw.mkv");
    expect(result.name).toContain("takanime.pw");
  });

  test("does not convert dots when spaces already present", () => {
    const result = preprocess("[Group] Title - 01.mkv");
    expect(result.name).toBe("[Group] Title - 01");
  });

  test("uses custom extensions when provided", () => {
    const result = preprocess("[Group] Title - 01.custom", [".custom"]);
    expect(result.name).toBe("[Group] Title - 01");
  });

  test("strips multiple corrupted extension layers", () => {
    const result = preprocess("Title - 01.mkv.mkv].mkv", [".mkv"]);
    expect(result.name).toBe("Title - 01");
  });
});
