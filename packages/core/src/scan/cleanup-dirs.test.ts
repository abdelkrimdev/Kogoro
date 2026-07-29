import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupEmptyDirs } from "./cleanup-dirs";

describe("cleanupEmptyDirs", () => {
  test("removes directories with only hidden files", () => {
    const dir = "/tmp/kogoro-test-cleanup-hidden";
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "Anime", "TV"), { recursive: true });
    writeFileSync(join(dir, "Anime", "TV", ".DS_Store"), "");

    cleanupEmptyDirs(new Set([join(dir, "Anime", "TV")]), dir);

    expect(existsSync(join(dir, "Anime", "TV"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("preserves directories with non-hidden files", () => {
    const dir = "/tmp/kogoro-test-cleanup-visible";
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "Anime", "TV"), { recursive: true });
    writeFileSync(join(dir, "Anime", "TV", "ep1.mkv"), "");

    cleanupEmptyDirs(new Set([join(dir, "Anime", "TV")]), dir);

    expect(existsSync(join(dir, "Anime", "TV", "ep1.mkv"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  test("stops at baseDir and never removes it", () => {
    const dir = "/tmp/kogoro-test-cleanup-base";
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".DS_Store"), "");

    cleanupEmptyDirs(new Set([dir]), dir);

    expect(existsSync(dir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  test("works with relative baseDir by normalizing to absolute", () => {
    const dir = "/tmp/kogoro-test-cleanup-relative";
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "Anime", "TV"), { recursive: true });
    writeFileSync(join(dir, "Anime", "TV", ".DS_Store"), "");

    cleanupEmptyDirs(new Set([join(dir, "Anime", "TV")]), `${dir}/../kogoro-test-cleanup-relative`);

    expect(existsSync(join(dir, "Anime", "TV"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("does not falsely match sibling directory with similar name", () => {
    const dir = "/tmp/kogoro-test-cleanup-sibling";
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(join(dir, "anime", "showA"), { recursive: true });
    mkdirSync(join(dir, "anime2", "showB"), { recursive: true });
    writeFileSync(join(dir, "anime", "showA", ".DS_Store"), "");
    writeFileSync(join(dir, "anime2", "showB", "ep1.mkv"), "");

    cleanupEmptyDirs(
      new Set([join(dir, "anime", "showA"), join(dir, "anime2", "showB")]),
      join(dir, "anime"),
    );

    expect(existsSync(join(dir, "anime", "showA"))).toBe(false);
    expect(existsSync(join(dir, "anime2", "showB"))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
