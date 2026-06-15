import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EpisodeNumbering } from "../config/schema";
import {
  makeEpisodes,
  makeMatchResult,
  makeParsedResult,
  withTempDir,
  writeTempFile,
} from "../fixtures";
import { Renamer } from "../rename/renamer";
import { RenameExecutor } from "./rename-executor";

function createRenamer(opts?: { action?: "move" | "copy"; filenameTemplate?: string }): Renamer {
  return new Renamer({
    filenameTemplate: opts?.filenameTemplate ?? "{anime} - S{season}xE{episode:02}.{ext}",
    directoryTemplate: "{anime}/{type}",
    action: opts?.action ?? "move",
  });
}

describe("RenameExecutor", () => {
  describe("hasRollback", () => {
    test("returns false when no renamer", () => {
      const executor = new RenameExecutor({});
      expect(executor.hasRollback()).toBe(false);
    });

    test("returns false when no plans executed", () => {
      const executor = new RenameExecutor({ renamer: createRenamer() });
      expect(executor.hasRollback()).toBe(false);
    });
  });

  describe("rollback", () => {
    test("returns empty array when no renamer", () => {
      const executor = new RenameExecutor({});
      expect(executor.rollback()).toEqual([]);
    });
  });

  describe("planFromCache", () => {
    test("creates plan from match result", async () => {
      await withTempDir("rename-executor-cache", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv");
        const executor = new RenameExecutor({ renamer: createRenamer() });

        const match = makeMatchResult({
          anime: { id: "tvdb-42", titleEn: "My Anime", entryType: "tv" },
          episode: {
            id: "ep-5",
            animeId: "tvdb-42",
            season: 1,
            episode: 5,
            titleEn: "Ep 5",
            entryType: "tv",
          },
        });
        const result = executor.planFromCache(filePath, match);

        expect(result.match.anime.id).toBe("tvdb-42");
        expect(result.plan).not.toBeNull();
        expect(result.plan?.targetFilename).toContain("My Anime");
      });
    });

    test("returns null plan when no renamer", () => {
      const executor = new RenameExecutor({});
      const match = makeMatchResult();
      const result = executor.planFromCache("/fake/file.mkv", match);

      expect(result.match).not.toBeNull();
      expect(result.plan).toBeNull();
    });
  });

  describe("planRename", () => {
    test("creates plan with default relative numbering", () => {
      const executor = new RenameExecutor({ renamer: createRenamer() });
      const match = makeMatchResult({
        episode: {
          id: "ep-5",
          animeId: "1",
          season: 2,
          episode: 5,
          titleEn: "Ep 5",
          entryType: "tv",
        },
      });
      const parsed = makeParsedResult("My Anime", 2, 5);

      const plan = executor.planRename("/fake/file.mkv", match, parsed);

      expect(plan).not.toBeNull();
      expect(plan?.targetFilename).toMatch(/S2xE05/);
    });

    test("creates plan with absolute numbering", () => {
      const episodes = makeEpisodes(24, 2);
      const match = makeMatchResult({
        episode: {
          id: "ep-30",
          animeId: "1",
          season: 2,
          episode: 6,
          titleEn: "Ep 30",
          entryType: "tv",
        },
        allEpisodes: episodes,
      });
      const parsed = makeParsedResult("Test Anime", 2, 6);
      const executor = new RenameExecutor({ renamer: createRenamer() });

      const plan = executor.planRename("/fake/file.mkv", match, parsed, {
        episodeNumbering: "absolute" as EpisodeNumbering,
      });

      expect(plan).not.toBeNull();
      expect(plan?.targetFilename).toMatch(/S1xE30/);
    });

    test("returns null when no renamer", () => {
      const executor = new RenameExecutor({});
      const plan = executor.planRename(
        "/fake/file.mkv",
        makeMatchResult(),
        makeParsedResult("Anime", 1, 1),
      );
      expect(plan).toBeNull();
    });

    test("applies custom action", () => {
      const executor = new RenameExecutor({ renamer: createRenamer() });
      const plan = executor.planRename(
        "/fake/file.mkv",
        makeMatchResult(),
        makeParsedResult("Anime", 1, 1),
        { action: "copy" },
      );
      expect(plan?.action).toBe("copy");
    });

    test("defaults action to move", () => {
      const executor = new RenameExecutor({ renamer: createRenamer() });
      const plan = executor.planRename(
        "/fake/file.mkv",
        makeMatchResult(),
        makeParsedResult("Anime", 1, 1),
      );
      expect(plan?.action).toBe("move");
    });

    test("absolute numbering falls back to match episode when season not parsed", () => {
      const episodes = makeEpisodes(24, 2);
      const match = makeMatchResult({
        episode: {
          id: "ep-54",
          animeId: "1",
          season: 2,
          episode: 30,
          titleEn: "Ep 54",
          entryType: "tv",
        },
        allEpisodes: episodes,
      });
      const parsed = makeParsedResult("Test Anime", null, 30);
      const executor = new RenameExecutor({ renamer: createRenamer() });

      const plan = executor.planRename("/fake/file.mkv", match, parsed, {
        episodeNumbering: "absolute" as EpisodeNumbering,
      });

      expect(plan).not.toBeNull();
      expect(plan?.targetFilename).toMatch(/S1xE54/);
    });

    test("relative numbering uses match episode when season not parsed", () => {
      const match = makeMatchResult({
        episode: {
          id: "ep-30",
          animeId: "1",
          season: 2,
          episode: 30,
          titleEn: "Ep 30",
          entryType: "tv",
        },
      });
      const parsed = makeParsedResult("Test Anime", null, 30);
      const executor = new RenameExecutor({ renamer: createRenamer() });

      const plan = executor.planRename("/fake/file.mkv", match, parsed);

      expect(plan).not.toBeNull();
      expect(plan?.targetFilename).toMatch(/S2xE30/);
    });
  });

  describe("executeRename", () => {
    test("executes plan and moves file", async () => {
      await withTempDir("rename-executor-execute", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake content");
        const executor = new RenameExecutor({ renamer: createRenamer() });
        const match = makeMatchResult();
        const parsed = makeParsedResult("My Anime", 1, 1);

        const plan = executor.planRename(filePath, match, parsed);
        expect(plan).not.toBeNull();
        if (!plan) return;

        const result = executor.executeRename(plan, dir);

        expect(result.success).toBe(true);
        expect(existsSync(join(dir, plan.targetPath))).toBe(true);
        expect(existsSync(filePath)).toBe(false);
      });
    });

    test("returns success when no renamer", () => {
      const executor = new RenameExecutor({});
      const result = executor.executeRename(
        {
          sourcePath: "/fake/source.mkv",
          targetPath: "/fake/target.mkv",
          targetDir: "/fake",
          targetFilename: "target.mkv",
          action: "move",
        },
        "/fake",
      );
      expect(result.success).toBe(true);
    });

    test("reports failure when target already exists", async () => {
      await withTempDir("rename-executor-collision", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content a");
        const executor = new RenameExecutor({ renamer: createRenamer() });
        const match = makeMatchResult();
        const parsed = makeParsedResult("My Anime", 1, 1);

        const plan = executor.planRename(filePath, match, parsed);
        expect(plan).not.toBeNull();
        if (!plan) return;

        const targetDir = join(dir, plan.targetDir);
        mkdirSync(targetDir, { recursive: true });
        writeFileSync(join(targetDir, plan.targetFilename), "existing content");

        const result = executor.executeRename(plan, dir);

        expect(result.success).toBe(false);
        expect(result.error?.type).toBe("collision");
      });
    });
  });

  describe("rollback", () => {
    test("reverts executed moves", async () => {
      await withTempDir("rename-executor-rollback", async (dir) => {
        const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "fake content");
        const executor = new RenameExecutor({ renamer: createRenamer() });
        const match = makeMatchResult();
        const parsed = makeParsedResult("My Anime", 1, 1);

        const plan = executor.planRename(filePath, match, parsed);
        if (!plan) return;
        executor.executeRename(plan, dir);

        expect(existsSync(filePath)).toBe(false);
        expect(executor.hasRollback()).toBe(true);

        const rollbackResults = executor.rollback();

        expect(rollbackResults).toHaveLength(1);
        expect(rollbackResults[0]?.success).toBe(true);
        expect(existsSync(filePath)).toBe(true);
        expect(executor.hasRollback()).toBe(false);
      });
    });
  });
});
