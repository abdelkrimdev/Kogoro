import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createScanHandlers } from "../src/cli/scan-commands.ts";
import type { DatabasePlugin } from "../src/db/database-plugin.ts";

function createMockDb(): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return [{ id: "1", title, entryType: "tv" as const }];
    },
    async getEpisodes(_animeId: string) {
      return [
        { id: "101", animeId: "1", season: 1, episode: 1, title: "Ep 1", entryType: "tv" as const },
      ];
    },
    async getArtwork() {
      return [];
    },
  };
}

describe("scan CLI commands", () => {
  test("scan directory returns JSON with matched files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-scan-test-"));
    try {
      writeFileSync(join(dir, "[Group] Test Anime - 01.mkv"), "");

      const handlers = createScanHandlers({ database: createMockDb() });
      const output = await handlers.scan(dir);

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]?.file).toBe("[Group] Test Anime - 01.mkv");
      expect(parsed[0]?.matches).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
