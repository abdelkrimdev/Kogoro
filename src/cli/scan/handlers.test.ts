import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ConfigManager } from "../../config/config-manager";
import { OverrideStore } from "../../override-store";
import { computeFileHash } from "../../scanner";
import {
  createMockDb as _createMockDb,
  createCache,
  createStandardMockDb,
  makeEpisodes,
  makeThrowingDb,
  withTempDir,
  writeTempFile,
} from "../../test-fixtures";
import { createScanHandlers, isAlreadyOrganized } from "./handlers";

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
      const cache = createCache(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cache });
      const first = await handlers.scan(filePath, { yes: true, dryRun: true });
      expect(first[0]?.status).toBe("matched");

      const second = await handlers.scan(filePath, { yes: true, dryRun: true });
      expect(second[0]?.status).toBe("cached");
    });
  });

  test("--force ignores cache and re-matches", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");
      const cache = createCache(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cache });
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

  test("auto-resolves ambiguous DB results in non-interactive mode", async () => {
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

  test("directory scan with mixed outcomes returns correct statuses", async () => {
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

  test("isAlreadyOrganized detects files in organized directory structure", () => {
    expect(isAlreadyOrganized("/media/Jujutsu Kaisen/TV/Jujutsu Kaisen - 1x01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/One Piece/Movies/One Piece - Movie 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/Naruto/OVA/Naruto - OVA 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/Attack on Titan/Specials/AOT - 01.mkv")).toBe(true);
    expect(isAlreadyOrganized("/media/unorganized/[Group] Anime - 01.mkv")).toBe(false);
    expect(isAlreadyOrganized("/media/Anime/TV")).toBe(false);
  });

  test("skips already-organized files without hashing or DB lookup", async () => {
    await withTempDir("scan-organized", async (dir) => {
      const tvDir = join(dir, "Jujutsu Kaisen", "TV");
      mkdirSync(tvDir, { recursive: true });
      writeTempFile(tvDir, "Jujutsu Kaisen - 1x01.mkv", "content");
      writeTempFile(dir, "[Group] Unorganized - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const results = await handlers.scan(dir, { yes: true, dryRun: true });

      const organized = results.find((r) => r.file.includes("TV/"));
      const unorganized = results.find((r) => r.file.includes("Unorganized"));

      expect(organized?.status).toBe("skipped");
      expect(unorganized?.status).toBe("matched");
    });
  });

  test("uses scanRoot as baseDir for files in subdirectories", async () => {
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

  test("uses template.preset for filename template via ConfigManager", async () => {
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

  test("prefers template.custom over template.preset when both are set", async () => {
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

  test("uses pre-existing override and skips DB query", async () => {
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
});
