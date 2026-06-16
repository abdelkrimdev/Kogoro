import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ConfigManager, computeFileHash, OverrideStore, SCHEMA_DEFAULTS } from "@kogoro/core";
import {
  createMockDb as _createMockDb,
  createMatchCacheService,
  makeEpisodes,
  withTempDir,
  writeTempFile,
} from "@kogoro/core/testing";
import { createStandardMockDb, makeMockLogger, makeThrowingDb } from "../fixtures";
import { createScanHandlers } from "./handlers";

describe("scan CLI commands", () => {
  test("directory scan with -y returns JSON with matched files", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Test Anime - 01.mkv", "");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(dir, { yes: true });

      expect(results).toHaveLength(1);
      expect(results[0]?.file).toBe(filePath);
      expect(results[0]?.status).toBe("matched");
    });
  });

  test("single file with -y returns matched status", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(filePath, { yes: true });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.parsed.title).toBe("My Anime");
    });
  });

  test("dry-run flag plans rename but does not move file", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(filePath, { yes: true, dryRun: true });

      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan).not.toBeNull();
      expect(existsSync(filePath)).toBe(true);
    });
  });

  test("second scan of same file returns cached status", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "same content");
      const { cacheService } = createMatchCacheService(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cacheService });
      const first = await handlers.scan(filePath, { yes: true, dryRun: true });
      expect(first[0]?.status).toBe("matched");

      const second = await handlers.scan(filePath, { yes: true, dryRun: true });
      expect(second[0]?.status).toBe("cached");
    });
  });

  test("--force ignores cache and re-matches", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");
      const { cacheService } = createMatchCacheService(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cacheService });
      await handlers.scan(filePath, { yes: true, dryRun: true });
      const results = await handlers.scan(filePath, { yes: true, dryRun: true, force: true });
      expect(results[0]?.status).toBe("matched");
    });
  });

  test("--action copy copies the file and preserves original", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(filePath, { yes: true, action: "copy" });

      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan?.action).toBe("copy");
      expect(existsSync(filePath)).toBe(true);
    });
  });

  test("resolves ambiguous results when non-interactive", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "Some Anime - 01.mkv", "content");

      const ambiguousDb = _createMockDb({
        searchAnime: (_title: string) => [
          { id: "1", titleEn: "Anime One", entryType: "tv" as const },
          { id: "2", titleEn: "Anime Two", entryType: "tv" as const },
        ],
        getEpisodes: (animeId: string) => [
          { id: "101", animeId, season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" as const },
          { id: "102", animeId, season: 1, episode: 1, titleEn: "Ep 1", entryType: "tv" as const },
        ],
      });

      const handlers = createScanHandlers({ database: ambiguousDb });
      const results = await handlers.scan(filePath, { yes: true, dryRun: true });

      expect(results[0]?.status).toBe("matched");
    });
  });

  test("returns matched and failed statuses for mixed files", async () => {
    await withTempDir("scan-mixed", async (dir) => {
      writeTempFile(dir, "[Group] One Piece - 01.mkv", "");
      writeTempFile(dir, "[Group] One Piece - 02.mkv", "");
      writeTempFile(dir, "Some Anime - 01.mkv", "");
      writeTempFile(dir, "randomfile.mkv", "");

      const mixedDb = _createMockDb({
        searchAnime: (title: string) => {
          if (title.toLowerCase().includes("some")) {
            return [
              { id: "1", titleEn: "Anime One", entryType: "tv" as const },
              { id: "2", titleEn: "Anime Two", entryType: "tv" as const },
            ];
          }
          return [{ id: "1", titleEn: title, entryType: "tv" as const }];
        },
        getEpisodes: (_animeId: string) => [
          {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv" as const,
          },
          {
            id: "102",
            animeId: "1",
            season: 1,
            episode: 2,
            titleEn: "Ep 2",
            entryType: "tv" as const,
          },
        ],
      });

      const handlers = createScanHandlers({ database: mixedDb });
      const results = await handlers.scan(dir, { yes: true, dryRun: true });

      expect(results).toHaveLength(4);
      const matched = results.filter((r) => r.status === "matched");
      const failed = results.filter((r) => r.status === "failed");
      expect(matched).toHaveLength(3);
      expect(failed).toHaveLength(1);
    });
  });

  test("organizes files from subdirectories into the scan root", async () => {
    await withTempDir("scan-root", async (dir) => {
      const subDir = join(dir, "out", "Oshi no Ko");
      mkdirSync(subDir, { recursive: true });
      const filePath = writeTempFile(subDir, "[Group] Test Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(dir, { yes: true });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(
        existsSync(join(dir, "Test Anime", "TV", "Test Anime - 1x01 - Ryomen Sukuna.mkv")),
      ).toBe(true);
      expect(existsSync(filePath)).toBe(false);
    });
  });

  test("applies preset filename template", async () => {
    await withTempDir("scan-preset", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");

      const configDir = join(dir, "config");
      mkdirSync(configDir);
      const config = new ConfigManager({ configDir });
      config.set("template.preset", "plex");

      const handlers = createScanHandlers({ database: createStandardMockDb(), config });
      const results = await handlers.scan(filePath, { yes: true, dryRun: true });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan?.targetFilename).toMatch(/^Anime - s01e01 - /);
    });
  });

  test("prefers custom filename template over preset", async () => {
    await withTempDir("scan-preset-override", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");

      const configDir = join(dir, "config");
      mkdirSync(configDir);
      const config = new ConfigManager({ configDir });
      config.set("template.preset", "plex");
      config.set("template.custom", "{anime} - E{episode:02}");

      const handlers = createScanHandlers({ database: createStandardMockDb(), config });
      const results = await handlers.scan(filePath, { yes: true, dryRun: true });

      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan?.targetFilename).toMatch(/^Anime - E01\.mkv$/);
    });
  });

  test("extensions option filters by extension", async () => {
    await withTempDir("scan-ext", async (dir) => {
      writeTempFile(dir, "video.mkv", "content");
      writeTempFile(dir, "text.txt", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(dir, {
        yes: true,
        dryRun: true,
        extensions: [".txt"],
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.file).toContain(".txt");
    });
  });

  test("applies a stored override without querying database", async () => {
    await withTempDir("scan-override", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Some Show - 01.mkv", "content");

      const overrideStore = new OverrideStore(dir);
      const fileHash = computeFileHash(basename(filePath));
      overrideStore.set(fileHash, {
        animeId: "99",
        episodeId: "ep-42",
        entryType: "movie",
      });

      const throwingDb = makeThrowingDb();

      const handlers = createScanHandlers({ database: throwingDb, overrideStore });
      const results = await handlers.scan(filePath, { yes: true });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.match?.anime.id).toBe("99");
      expect(results[0]?.match?.anime.entryType).toBe("movie");
    });
  });

  test("--episode-numbering absolute converts relative filename to absolute", async () => {
    await withTempDir("scan-numbering", async (dir) => {
      writeTempFile(dir, "[Group] Test Anime - S02E06.mkv", "content");

      const episodes = makeEpisodes(24, 2);
      const db = _createMockDb({
        searchAnime: (title: string) => [{ id: "1", titleEn: title, entryType: "tv" as const }],
        getEpisodes: () => episodes,
      });

      const handlers = createScanHandlers({ database: db });
      const results = await handlers.scan(dir, {
        yes: true,
        dryRun: true,
        episodeNumbering: "absolute",
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan?.targetFilename).toMatch(/1x30/);
    });
  });

  test("--episode-numbering relative uses parsed season and episode", async () => {
    await withTempDir("scan-numbering", async (dir) => {
      writeTempFile(dir, "[Group] Test Anime - S02E05.mkv", "content");

      const episodes = makeEpisodes(24, 2);
      const db = _createMockDb({
        searchAnime: (title: string) => [{ id: "1", titleEn: title, entryType: "tv" as const }],
        getEpisodes: () => episodes,
      });

      const handlers = createScanHandlers({ database: db });
      const results = await handlers.scan(dir, {
        yes: true,
        dryRun: true,
        episodeNumbering: "relative",
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.plan?.targetFilename).toMatch(/2x05/);
    });
  });

  describe("resolution chains", () => {
    test("prioritizes config episode numbering over built-in default", async () => {
      await withTempDir("scan-numbering-chain", async (dir) => {
        writeTempFile(dir, "[Group] Test Anime - S02E06.mkv", "content");

        const episodes = makeEpisodes(24, 2);
        const db = _createMockDb({
          searchAnime: (title: string) => [{ id: "1", titleEn: title, entryType: "tv" as const }],
          getEpisodes: () => episodes,
        });

        const configDir = join(dir, "config");
        mkdirSync(configDir);
        const config = new ConfigManager({ configDir });
        config.set("episodeNumbering", "absolute");

        const handlers = createScanHandlers({ database: db, config });
        const results = await handlers.scan(dir, { yes: true, dryRun: true });

        expect(results).toHaveLength(1);
        expect(results[0]?.status).toBe("matched");
        expect(results[0]?.plan?.targetFilename).toMatch(/1x30/);
      });
    });

    test("falls back to built-in default for episode numbering", async () => {
      await withTempDir("scan-numbering-default", async (dir) => {
        writeTempFile(dir, "[Group] Test Anime - S02E06.mkv", "content");

        const episodes = makeEpisodes(24, 2);
        const db = _createMockDb({
          searchAnime: (title: string) => [{ id: "1", titleEn: title, entryType: "tv" as const }],
          getEpisodes: () => episodes,
        });

        const handlers = createScanHandlers({ database: db });
        const results = await handlers.scan(dir, { yes: true, dryRun: true });

        expect(results).toHaveLength(1);
        expect(SCHEMA_DEFAULTS["episode-numbering"]).toBe("relative");
        expect(results[0]?.plan?.targetFilename).toMatch(/2x06/);
      });
    });

    test("prioritizes config action over built-in default", async () => {
      await withTempDir("scan-action-chain", async (dir) => {
        const filePath = writeTempFile(dir, "My Anime - 01.mkv", "content");

        const configDir = join(dir, "config");
        mkdirSync(configDir);
        const config = new ConfigManager({ configDir });
        config.set("renameAction", "copy");

        const handlers = createScanHandlers({ database: createStandardMockDb(), config });
        const results = await handlers.scan(filePath, { yes: true });

        expect(results).toHaveLength(1);
        expect(results[0]?.status).toBe("matched");
        expect(results[0]?.plan?.action).toBe("copy");
        expect(existsSync(filePath)).toBe(true);
      });
    });

    test("prioritizes config concurrency over built-in default", async () => {
      await withTempDir("scan-concurrency-chain", async (dir) => {
        writeTempFile(dir, "[Group] Anime - 01.mkv", "content");

        const configDir = join(dir, "config");
        mkdirSync(configDir);
        const config = new ConfigManager({ configDir });
        config.set("scanConcurrency", "2");

        const handlers = createScanHandlers({ database: createStandardMockDb(), config });
        const results = await handlers.scan(dir, { yes: true, dryRun: true });

        expect(results).toHaveLength(1);
        expect(results[0]?.status).toBe("matched");
      });
    });

    test("prioritizes config exclude patterns", async () => {
      await withTempDir("scan-exclude-chain", async (dir) => {
        writeTempFile(dir, "[Group] Anime - 01.nfo", "content");
        writeTempFile(dir, "[Group] Anime - 01.mkv", "content");

        const configDir = join(dir, "config");
        mkdirSync(configDir);
        const config = new ConfigManager({ configDir });
        config.set("excludePatterns", ".nfo");

        const handlers = createScanHandlers({ database: createStandardMockDb(), config });
        const results = await handlers.scan(dir, { yes: true, dryRun: true });

        expect(results).toHaveLength(1);
        expect(results[0]?.file).toContain(".mkv");
      });
    });

    test("prioritizes config media extensions", async () => {
      await withTempDir("scan-ext-chain", async (dir) => {
        writeTempFile(dir, "video.custom", "content");
        writeTempFile(dir, "video.mkv", "content");

        const configDir = join(dir, "config");
        mkdirSync(configDir);
        const config = new ConfigManager({ configDir });
        config.set("mediaExtensions", ".custom");

        const handlers = createScanHandlers({ database: createStandardMockDb(), config });
        const results = await handlers.scan(dir, {
          yes: true,
          dryRun: true,
        });

        expect(results).toHaveLength(1);
        expect(results[0]?.file).toContain(".custom");
      });
    });
  });

  describe("progress events", () => {
    test("emits scan:progress events to logger", async () => {
      await withTempDir("scan-progress", async (dir) => {
        writeTempFile(dir, "[Group] Test Anime - 01.mkv", "content");

        const { logger, progressLines } = makeMockLogger();
        const handlers = createScanHandlers({ database: createStandardMockDb() });
        await handlers.scan(dir, { yes: true }, logger);

        expect(progressLines.length).toBeGreaterThanOrEqual(1);
        const firstProgress = progressLines[0] ?? "";
        expect(firstProgress).toStartWith("scan:progress ");
        const parsed = JSON.parse(firstProgress.slice("scan:progress ".length)) as {
          completed: number;
          total: number;
          file: string;
          status: string;
        };
        expect(parsed.completed).toBe(1);
        expect(parsed.total).toBe(1);
        expect(parsed.status).toBe("matched");
      });
    });
  });
});
