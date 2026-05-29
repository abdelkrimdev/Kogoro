import { describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { walk } from "./directory-walker";
import { withTempDir, writeTempFile } from "./test-fixtures";

describe("DirectoryWalker", () => {
  test("walk returns video files from a directory", async () => {
    await withTempDir("walk-basic", async (dir) => {
      writeTempFile(dir, "video.mkv", "");
      writeTempFile(dir, "readme.txt", "");

      const files = walk(dir, [".mkv"]);

      expect(files).toHaveLength(1);
      expect(files[0]).toEndWith("video.mkv");
    });
  });

  test("walk traverses subdirectories recursively", async () => {
    await withTempDir("walk-recursive", async (dir) => {
      mkdirSync(join(dir, "sub"), { recursive: true });
      writeTempFile(dir, "root.mkv", "");
      writeTempFile(join(dir, "sub"), "nested.mkv", "");

      const files = walk(dir, [".mkv"]);

      expect(files).toHaveLength(2);
      expect(files.some((f) => f.endsWith("root.mkv"))).toBe(true);
      expect(files.some((f) => f.endsWith("nested.mkv"))).toBe(true);
    });
  });

  test("walk filters by extension", async () => {
    await withTempDir("walk-ext", async (dir) => {
      writeTempFile(dir, "video.mkv", "");
      writeTempFile(dir, "video.mp4", "");
      writeTempFile(dir, "video.avi", "");
      writeTempFile(dir, "readme.txt", "");

      const files = walk(dir, [".mkv", ".mp4"]);

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith(".mkv") || f.endsWith(".mp4"))).toBe(true);
    });
  });

  test("walk filters out files matching exclude patterns", async () => {
    await withTempDir("walk-exclude", async (dir) => {
      writeTempFile(dir, "Anime - 01.mkv", "");
      writeTempFile(dir, "Anime - 02.mkv", "");
      writeTempFile(dir, "Anime - 03.part", "");

      const files = walk(dir, [".mkv"], { excludePatterns: [".part"] });

      expect(files).toHaveLength(2);
      expect(files.some((f) => f.endsWith(".part"))).toBe(false);
    });
  });

  test("walk skips symlinks", async () => {
    await withTempDir("walk-symlink", async (dir) => {
      writeTempFile(dir, "Anime - 01.mkv", "");
      symlinkSync(join(dir, "Anime - 01.mkv"), join(dir, "link.mkv"));

      const files = walk(dir, [".mkv"]);

      expect(files.some((f) => f.endsWith("link.mkv"))).toBe(false);
      expect(files.some((f) => f.endsWith("Anime - 01.mkv"))).toBe(true);
    });
  });

  test("walk returns empty array for empty directory", async () => {
    await withTempDir("walk-empty", async (dir) => {
      const files = walk(dir, [".mkv"]);
      expect(files).toEqual([]);
    });
  });

  test("walk traverses deeply nested directory structures", async () => {
    await withTempDir("walk-deep", async (dir) => {
      const deepDir = join(dir, "a", "b", "c", "d");
      mkdirSync(deepDir, { recursive: true });
      writeTempFile(deepDir, "deep.mkv", "");

      const files = walk(dir, [".mkv"]);

      expect(files).toHaveLength(1);
      expect(files[0]).toEndWith("deep.mkv");
    });
  });
});
