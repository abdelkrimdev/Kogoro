import { describe, expect, test } from "bun:test";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EpisodeResult } from "../src/db/types.ts";
import type { MatchResult } from "../src/matcher.ts";
import { Renamer } from "../src/renamer.ts";

function makeTvMatch(): MatchResult {
  return {
    anime: { id: "1", title: "Jujutsu Kaisen", entryType: "tv" },
    episode: {
      id: "101",
      animeId: "1",
      season: 1,
      episode: 13,
      title: "Tomorrow",
      entryType: "tv",
    } satisfies EpisodeResult,
    score: 1,
  };
}

describe("Renamer", () => {
  test("plans rename for TV episode with filename and directory templates", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const plan = renamer.plan("/source/Jujutsu Kaisen - 01.mkv", makeTvMatch(), "mkv");

    expect(plan.sourcePath).toBe("/source/Jujutsu Kaisen - 01.mkv");
    expect(plan.targetDir).toBe("Jujutsu Kaisen/TV");
    expect(plan.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.targetPath).toBe("Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x13 - Tomorrow.mkv");
    expect(plan.action).toBe("move");
  });

  test("plans rename for Movie entry type", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match: MatchResult = {
      anime: { id: "2", title: "Your Name", entryType: "movie" },
      episode: {
        id: "201",
        animeId: "2",
        season: 1,
        episode: 1,
        title: "Your Name",
        entryType: "movie",
      } satisfies EpisodeResult,
      score: 1,
    };

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

    const match: MatchResult = {
      anime: { id: "3", title: "FLCL", entryType: "ova" },
      episode: {
        id: "301",
        animeId: "3",
        season: 1,
        episode: 1,
        title: "Fooly Cooly",
        entryType: "ova",
      } satisfies EpisodeResult,
      score: 1,
    };

    const plan = renamer.plan("/source/flcl_01.mkv", match, "mkv");

    expect(plan.targetDir).toBe("FLCL/OVA");
    expect(plan.targetFilename).toBe("FLCL - 01.mkv");
  });

  test("plans rename for Special entry type", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {episode:02}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match: MatchResult = {
      anime: { id: "4", title: "Attack on Titan", entryType: "special" },
      episode: {
        id: "401",
        animeId: "4",
        season: 1,
        episode: 1,
        title: "Special 1",
        entryType: "special",
      } satisfies EpisodeResult,
      score: 1,
    };

    const plan = renamer.plan("/source/aot_special.mkv", match, "mkv");

    expect(plan.targetDir).toBe("Attack on Titan/Specials");
    expect(plan.targetFilename).toBe("Attack on Titan - 01.mkv");
  });

  test("appends resolution tag on collision", () => {
    const renamer = new Renamer({
      filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
      directoryTemplate: "{anime}/{type}",
    });

    const match = makeTvMatch();
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

    const match = makeTvMatch();

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

    const match = makeTvMatch();
    const tags = { group: null, resolution: "1080p", source: null, codec: null, audio: null };

    renamer.plan("/source/file1.mkv", match, "mkv"); // base
    renamer.plan("/source/file2.mkv", match, "mkv", tags); // tagged
    const plan3 = renamer.plan("/source/file3.mkv", match, "mkv", tags); // should be numeric

    expect(plan3.targetFilename).toBe("Jujutsu Kaisen - 1x13 - Tomorrow (2).mkv");
  });

  describe("execute", () => {
    function setupTest(): { renamer: Renamer; match: MatchResult; dir: string } {
      const renamer = new Renamer({
        filenameTemplate: "{anime} - {season}x{episode:02} - {title}.{ext}",
        directoryTemplate: "{anime}/{type}",
      });
      return {
        renamer,
        match: makeTvMatch(),
        dir: mkdtempSync(join(tmpdir(), "kogoro-renamer-test-")),
      };
    }

    function cleanup(dir: string) {
      rmSync(dir, { recursive: true, force: true });
    }

    test("move operation moves file to target path, creates parent dirs", () => {
      const { renamer, match, dir } = setupTest();
      try {
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "move";
        renamer.execute(plan, dir);

        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(false);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      } finally {
        cleanup(dir);
      }
    });

    test("copy operation copies file, original preserved", () => {
      const { renamer, match, dir } = setupTest();
      try {
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "copy";
        renamer.execute(plan, dir);

        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(sourcePath)).toBe(true);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      } finally {
        cleanup(dir);
      }
    });

    test("symlink operation creates symlink at target", () => {
      const { renamer, match, dir } = setupTest();
      try {
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "symlink";
        renamer.execute(plan, dir);

        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(expectedPath)).toBe(true);
        const stat = lstatSync(expectedPath);
        expect(stat.isSymbolicLink()).toBe(true);
        expect(readlinkSync(expectedPath)).toBe(sourcePath);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
      } finally {
        cleanup(dir);
      }
    });

    test("hardlink operation creates hardlink at target", () => {
      const { renamer, match, dir } = setupTest();
      try {
        const sourcePath = join(dir, "source.mkv");
        writeFileSync(sourcePath, "hello");

        const plan = renamer.plan(sourcePath, match, "mkv");
        plan.action = "hardlink";
        renamer.execute(plan, dir);

        const expectedPath = join(dir, plan.targetPath);
        expect(existsSync(expectedPath)).toBe(true);
        expect(readFileSync(expectedPath, "utf-8")).toBe("hello");
        expect(statSync(expectedPath).ino).toBe(statSync(sourcePath).ino);
      } finally {
        cleanup(dir);
      }
    });
  });
});
