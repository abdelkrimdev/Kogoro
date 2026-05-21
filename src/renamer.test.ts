import { describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Renamer } from "./renamer";
import { makeMatchResult, withTempDir } from "./test-helpers";

describe("Renamer", () => {
  test("plans rename for TV episode with filename and directory templates", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const plan = renamer.plan("/source/Jujutsu Kaisen - 01.mkv", makeMatchResult(), "mkv");

    expect(plan.sourcePath).toBe("/source/Jujutsu Kaisen - 01.mkv");
    expect(plan.targetDir).toBe("Jujutsu Kaisen/TV");
    expect(plan.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.targetPath).toBe("Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.action).toBe("move");
  });

  test("uses numberingOverride when provided", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const plan = renamer.plan(
      "/source/Jujutsu Kaisen - 01.mkv",
      makeMatchResult(),
      "mkv",
      undefined,
      {
        season: 2,
        episode: 5,
      },
    );

    expect(plan.targetFilename).toBe("Jujutsu Kaisen - 2x05 - Tomorrow.mkv");
  });

  test("plans rename for Movie entry type", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult({
      anime: { id: "2", title: "Your Name", entryType: "movie" },
      episode: {
        id: "201",
        animeId: "2",
        season: 1,
        episode: 1,
        title: "Your Name",
        entryType: "movie",
      },
    });

    const plan = renamer.plan("/source/your_name.mkv", match, "mkv");

    expect(plan.targetDir).toBe("Your Name/Movies");
    expect(plan.targetFilename).toBe("Your Name - Your Name.mkv");
    expect(plan.targetPath).toBe("Your Name/Movies/Your Name - Your Name.mkv");
  });

  test("plans rename for OVA entry type", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {episode:02}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult({
      anime: { id: "3", title: "FLCL", entryType: "ova" },
      episode: {
        id: "301",
        animeId: "3",
        season: 1,
        episode: 1,
        title: "Fooly Cooly",
        entryType: "ova",
      },
    });

    const plan = renamer.plan("/source/flcl_01.mkv", match, "mkv");

    expect(plan.targetDir).toBe("FLCL/OVA");
    expect(plan.targetFilename).toBe("FLCL - 01.mkv");
  });

  test("plans rename for Special entry type", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {episode:02}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult({
      anime: { id: "4", title: "Attack on Titan", entryType: "special" },
      episode: {
        id: "401",
        animeId: "4",
        season: 1,
        episode: 1,
        title: "Special 1",
        entryType: "special",
      },
    });

    const plan = renamer.plan("/source/aot_special.mkv", match, "mkv");

    expect(plan.targetDir).toBe("Attack on Titan/Specials");
    expect(plan.targetFilename).toBe("Attack on Titan - 01.mkv");
  });

  test("appends resolution tag on collision", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult();
    const tags = { group: null, resolution: "1080p", source: null, codec: null, audio: null };

    const plan1 = renamer.plan("/source/file1.mkv", match, "mkv");
    const plan2 = renamer.plan("/source/file2.mkv", match, "mkv", tags);

    expect(plan1.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan2.targetPath).toBe(
      "Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x13 - Tomorrow - [1080p].mkv",
    );
  });

  test("appends numeric suffix when no tags on collision", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult();

    const plan1 = renamer.plan("/source/file1.mkv", match, "mkv");
    const plan2 = renamer.plan("/source/file2.mkv", match, "mkv");

    expect(plan1.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan2.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow (2).mkv");
  });

  test("appends numeric suffix when tagged path also collides", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeMatchResult();
    const tags = { group: null, resolution: "1080p", source: null, codec: null, audio: null };

    renamer.plan("/source/file1.mkv", match, "mkv"); // base
    renamer.plan("/source/file2.mkv", match, "mkv", tags); // tagged
    const plan3 = renamer.plan("/source/file3.mkv", match, "mkv", tags); // should be numeric

    expect(plan3.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow (2).mkv");
  });

  describe("execute", () => {
    test("move operation moves file to target path, creates parent dirs", async () => {
      await withTempDir("execute", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const match = makeMatchResult();
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "move";
        const result = renamer.execute(plan, dir);

        expect(result.success).toBe(true);
        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(false);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      });
    });

    test("copy operation copies file, original preserved", async () => {
      await withTempDir("execute", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const match = makeMatchResult();
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "copy";
        const result = renamer.execute(plan, dir);

        expect(result.success).toBe(true);
        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(true);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      });
    });

    test("symlink operation creates symlink at target", async () => {
      await withTempDir("execute", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const match = makeMatchResult();
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "symlink";
        const result = renamer.execute(plan, dir);

        expect(result.success).toBe(true);
        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(expectedPath)).toBe(true);
        const stat = lstatSync(expectedPath);
        expect(stat.isSymbolicLink()).toBe(true);
        expect(readlinkSync(expectedPath)).toBe(sourcePath);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      });
    });

    test("hardlink operation creates hardlink at target", async () => {
      await withTempDir("execute", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const match = makeMatchResult();
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "hardlink";
        const result = renamer.execute(plan, dir);

        expect(result.success).toBe(true);
        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
        expect(statSync(expectedPath).ino).toBe(statSync(sourcePath).ino);
      });
    });

    test("returns collision error when target already exists", async () => {
      await withTempDir("execute", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const match = makeMatchResult();
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "new content");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "copy";

        mkdirSync(join(dir, plan.targetDir), { recursive: true });
        writeFileSync(join(dir, plan.targetPath), "already here");
        const result = renamer.execute(plan, dir);

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe("collision");
      });
    });
  });

  describe("rollback", () => {
    test("canRollback returns false when no executions", () => {
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
        directoryTemplate: "{anime}/{type}",
      });
      expect(renamer.canRollback()).toBe(false);
    });

    test("canRollback returns true after successful execute", async () => {
      await withTempDir("rollback", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");
        const plan = renamer.plan(sourcePath, makeMatchResult(), "mkv");
        plan.action = "move";
        renamer.execute(plan, dir);

        expect(renamer.canRollback()).toBe(true);
      });
    });

    test("rollback restores source file after move", async () => {
      await withTempDir("rollback", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");
        const plan = renamer.plan(sourcePath, makeMatchResult(), "mkv");
        plan.action = "move";
        renamer.execute(plan, dir);

        const targetPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(false);
        expect(existsSync(targetPath)).toBe(true);

        const results = renamer.rollback();
        expect(results).toHaveLength(1);
        expect(results[0]?.success).toBe(true);
        expect(existsSync(sourcePath)).toBe(true);
        expect(existsSync(targetPath)).toBe(false);
        expect(readFileSync(sourcePath, "utf-8")).toBe("hello");
      });
    });

    test("rollback removes copied file", async () => {
      await withTempDir("rollback", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");
        const plan = renamer.plan(sourcePath, makeMatchResult(), "mkv");
        plan.action = "copy";
        renamer.execute(plan, dir);

        const targetPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(true);
        expect(existsSync(targetPath)).toBe(true);

        const results = renamer.rollback();
        expect(results[0]?.success).toBe(true);
        expect(existsSync(sourcePath)).toBe(true);
        expect(existsSync(targetPath)).toBe(false);
      });
    });

    test("rollback after successful execute clears canRollback", async () => {
      await withTempDir("rollback", async (dir) => {
        const renamer = new Renamer({
          filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
          directoryTemplate: "{anime}/{type}",
        });
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");
        const plan = renamer.plan(sourcePath, makeMatchResult(), "mkv");
        plan.action = "move";
        renamer.execute(plan, dir);

        expect(renamer.canRollback()).toBe(true);
        renamer.rollback();
        expect(renamer.canRollback()).toBe(false);
      });
    });
  });
});
