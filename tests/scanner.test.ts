import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabasePlugin } from "../src/database/types.ts";
import { Scanner } from "../src/scanner.ts";

function createMockDb(): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return [{ id: "1", title }];
    },
    async getEpisodes(_animeId: string) {
      return [
        { id: "101", seasonNumber: 1, episodeNumber: 1, title: "Ep 1", entryType: "TV" as const },
      ];
    },
    async getArtwork() {
      return [];
    },
  };
}

describe("Scanner", () => {
  test("scanFile parses filename and matches against database", async () => {
    const scanner = new Scanner({ database: createMockDb() });
    const result = await scanner.scanFile("[Group] My Anime - 01.mkv");

    expect(result.file).toBe("[Group] My Anime - 01.mkv");
    expect(result.parsed.title).toBe("My Anime");
    expect(result.parsed.episode).toBe(1);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.anime.title).toBe("My Anime");
    expect(result.matches[0]?.episode?.episodeNumber).toBe(1);
  });

  test("scanDir discovers media files, parses, and matches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-scanner-test-"));
    try {
      writeFileSync(join(dir, "[SubsPlease] One Piece - 01.mkv"), "");
      writeFileSync(join(dir, "[SubsPlease] One Piece - 02.mkv"), "");
      writeFileSync(join(dir, "readme.txt"), "not a media file");

      const scanner = new Scanner({ database: createMockDb() });
      const results = await scanner.scanDir(dir, [".mkv"]);

      expect(results).toHaveLength(2);
      expect(results[0]?.parsed.title).toBeTruthy();
      expect(results[1]?.parsed.title).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
