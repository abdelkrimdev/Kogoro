import { describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./directory-walker";
import { withTempDir, writeTempFile } from "./test-fixtures";

describe("walk", () => {
  test("returns files matching given extensions in flat directory", async () => {
    await withTempDir("walk-flat", async (dir) => {
      writeTempFile(dir, "video.mkv", "");
      writeTempFile(dir, "movie.mp4", "");
      writeTempFile(dir, "clip.avi", "");
      writeTempFile(dir, "readme.txt", "");
      writeTempFile(dir, "image.png", "");

      const files = walk(dir, [".mkv", ".mp4"]);

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith(".mkv") || f.endsWith(".mp4"))).toBe(true);
    });
  });

  test("traverses nested subdirectories recursively", async () => {
    await withTempDir("walk-nested", async (dir) => {
      const subDir = join(dir, "sub", "deep");
      mkdirSync(subDir, { recursive: true });
      writeTempFile(dir, "root.mkv", "");
      writeTempFile(join(dir, "sub"), "level1.mp4", "");
      writeTempFile(subDir, "level2.avi", "");

      const files = walk(dir, [".mkv", ".mp4", ".avi"]).sort();

      expect(files).toHaveLength(3);
      expect(files).toEqual(
        expect.arrayContaining([
          expect.stringContaining("root.mkv"),
          expect.stringContaining("level1.mp4"),
          expect.stringContaining("level2.avi"),
        ]),
      );
    });
  });

  test("filters by exclude patterns and skips symlinks", async () => {
    await withTempDir("walk-filter", async (dir) => {
      writeTempFile(dir, "Anime - 01.mkv", "");
      writeTempFile(dir, "Anime - 02.mkv", "");
      writeTempFile(dir, "Anime - 03.part", "");
      writeTempFile(dir, "readme.txt", "");
      symlinkSync(join(dir, "Anime - 01.mkv"), join(dir, "link.mkv"));

      const files = walk(dir, [".mkv"], { excludePatterns: [".part"] });

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith(".mkv"))).toBe(true);
      expect(files.some((f) => f.endsWith(".part"))).toBe(false);
      expect(files.some((f) => f.endsWith("link.mkv"))).toBe(false);
    });
  });

  test("returns empty array for empty directory", async () => {
    await withTempDir("walk-empty", async (dir) => {
      const files = walk(dir, [".mkv"]);

      expect(files).toEqual([]);
    });
  });
});
