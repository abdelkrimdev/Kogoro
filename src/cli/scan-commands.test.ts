import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { createScanHandlers, discoverFiles, isAlreadyOrganized } from "../cli/scan-commands";
import { ConfigManager } from "../config/config-manager";
import { OverrideStore } from "../override-store";
import { computeFileHash } from "../scanner";
import {
  createMockDb as _createMockDb,
  createCache,
  createStandardMockDb,
  makeThrowingDb,
  withTempDir,
  writeTempFile,
} from "../test-fixtures";

describe("scan CLI commands", () => {
  test("directory scan with -y returns JSON with matched files", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Test Anime - 01.mkv", "");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const output = await handlers.scan(dir, { yes: true });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.file).toBe(filePath);
      expect(parsed[0]?.status).toBe("matched");
    });
  });

  test("single file with -y returns matched status", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const output = await handlers.scan(filePath, { yes: true });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.parsed.title).toBe("My Anime");
    });
  });

  test("dry-run flag plans rename but does not move file", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan).not.toBeNull();
      expect(existsSync(filePath)).toBe(true);
    });
  });

  test("second scan of same file returns cached status", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "same content");
      const cache = createCache(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cache });
      const firstOutput = await handlers.scan(filePath, { yes: true, dryRun: true });
      const first = JSON.parse(firstOutput);
      expect(first[0]?.status).toBe("matched");

      const secondOutput = await handlers.scan(filePath, { yes: true, dryRun: true });
      const second = JSON.parse(secondOutput);
      expect(second[0]?.status).toBe("cached");
    });
  });

  test("--force ignores cache and re-matches", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");
      const cache = createCache(dir);

      const handlers = createScanHandlers({ database: createStandardMockDb(), cache });
      await handlers.scan(filePath, { yes: true, dryRun: true });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true, force: true });
      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
    });
  });

  test("--action copy copies the file and preserves original", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "My Anime - 01.mkv", "content");

      const handlers = createScanHandlers({ database: createStandardMockDb() });
      const output = await handlers.scan(filePath, { yes: true, action: "copy" });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan?.action).toBe("copy");
      expect(existsSync(filePath)).toBe(true);
    });
  });

  test("auto-resolves ambiguous DB results in non-interactive mode", async () => {
    await withTempDir("scan", async (dir) => {
      const filePath = writeTempFile(dir, "Some Anime - 01.mkv", "content");

      const ambiguousDb = _createMockDb({
        searchAnime: (_title: string) => [
          { id: "1", title: "Anime One", entryType: "tv" as const },
          { id: "2", title: "Anime Two", entryType: "tv" as const },
        ],
        getEpisodes: (animeId: string) => [
          { id: "101", animeId, season: 1, episode: 1, title: "Ep 1", entryType: "tv" as const },
          { id: "102", animeId, season: 1, episode: 1, title: "Ep 1", entryType: "tv" as const },
        ],
      });

      const handlers = createScanHandlers({ database: ambiguousDb });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
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
              { id: "1", title: "Anime One", entryType: "tv" as const },
              { id: "2", title: "Anime Two", entryType: "tv" as const },
            ];
          }
          return [{ id: "1", title, entryType: "tv" as const }];
        },
        getEpisodes: (_animeId: string) => [
          {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            title: "Ep 1",
            entryType: "tv" as const,
          },
          {
            id: "102",
            animeId: "1",
            season: 1,
            episode: 2,
            title: "Ep 2",
            entryType: "tv" as const,
          },
        ],
      });

      const handlers = createScanHandlers({ database: mixedDb });
      const output = await handlers.scan(dir, { yes: true, dryRun: true });
      const results = JSON.parse(output) as Array<{ status: string }>;

      expect(results).toHaveLength(4);
      const matched = results.filter((r) => r.status === "matched");
      const failed = results.filter((r) => r.status === "failed");
      expect(matched).toHaveLength(3);
      expect(failed).toHaveLength(1);
    });
  });

  test("discoverFiles filters excluded patterns and skips symlinks", async () => {
    await withTempDir("scan-discover", async (dir) => {
      writeTempFile(dir, "Anime - 01.mkv", "");
      writeTempFile(dir, "Anime - 02.mkv", "");
      writeTempFile(dir, "Anime - 03.part", "");
      writeTempFile(dir, "readme.txt", "");
      symlinkSync(join(dir, "Anime - 01.mkv"), join(dir, "link.mkv"));

      const files = discoverFiles(dir, [".mkv"], [".part"]);

      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith(".mkv"))).toBe(true);
      expect(files.some((f) => f.endsWith(".part"))).toBe(false);
      expect(files.some((f) => f.endsWith("link.mkv"))).toBe(false);
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
      const output = await handlers.scan(dir, { yes: true, dryRun: true });
      const results = JSON.parse(output) as Array<{ status: string; file: string }>;

      const organized = results.find((r) => r.file.includes("TV/"));
      const unorganized = results.find((r) => r.file.includes("Unorganized"));

      expect(organized?.status).toBe("skipped");
      expect(unorganized?.status).toBe("matched");
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
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan?.targetFilename).toMatch(/^Anime - s01e01 - /);
    });
  });

  test("prefers template.string over template.preset when both are set", async () => {
    await withTempDir("scan-preset-override", async (dir) => {
      const filePath = writeTempFile(dir, "[Group] Anime - 01.mkv", "content");

      const configDir = join(dir, "config");
      mkdirSync(configDir);
      const config = new ConfigManager({ configDir });
      config.set("template.preset", "plex");
      config.set("template.string", "{anime} - E{episode:02}");

      const handlers = createScanHandlers({ database: createStandardMockDb(), config });
      const output = await handlers.scan(filePath, { yes: true, dryRun: true });

      const parsed = JSON.parse(output);
      expect(parsed[0]?.status).toBe("matched");
      expect(parsed[0]?.plan?.targetFilename).toMatch(/^Anime - E01\.mkv$/);
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
      const output = await handlers.scan(filePath, { yes: true });
      const results = JSON.parse(output);

      expect(results).toHaveLength(1);
      expect(results[0]?.status).toBe("matched");
      expect(results[0]?.match?.anime.id).toBe("99");
      expect(results[0]?.match?.anime.entryType).toBe("movie");
    });
  });
});
