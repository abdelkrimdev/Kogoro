import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCacheHandlers } from "../src/cli/cache-commands";
import { MatchCache } from "../src/match-cache";

function setupTempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), "kogoro-cli-cache-"));
  return join(dir, "cache.db");
}

function cleanupTempDb(dbPath: string) {
  const dir = join(dbPath, "..");
  rmSync(dir, { recursive: true, force: true });
}

describe("cache CLI commands", () => {
  test("cache list returns JSON array of all cached entries", async () => {
    const dbPath = setupTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("hash1", {
        animeId: "1",
        episodeId: "101",
        entryType: "tv",
        season: 1,
        episode: 5,
        title: "Ep 5",
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      cache.set("hash2", {
        animeId: "2",
        episodeId: null,
        entryType: "movie",
        season: null,
        episode: null,
        title: "Movie",
        timestamp: "2026-01-02T00:00:00.000Z",
      });

      const handlers = createCacheHandlers({ dbPath });
      let logOutput = "";
      await handlers.list(
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.hash).toBe("hash1");
      expect(parsed[0]?.match.animeId).toBe("1");
      expect(parsed[1]?.hash).toBe("hash2");
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("cache lookup returns match for existing hash", async () => {
    const dbPath = setupTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("existhash", {
        animeId: "99",
        episodeId: null,
        entryType: "ova",
        season: null,
        episode: null,
        title: "Special",
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createCacheHandlers({ dbPath });
      let logOutput = "";
      await handlers.lookup(
        "existhash",
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );

      const parsed = JSON.parse(logOutput);
      expect(parsed.animeId).toBe("99");
      expect(parsed.entryType).toBe("ova");
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("cache lookup returns message for missing hash", async () => {
    const dbPath = setupTempDb();
    try {
      const handlers = createCacheHandlers({ dbPath });
      let errOutput = "";
      await handlers.lookup(
        "nonexistent",
        () => {},
        (msg: string) => {
          errOutput = msg;
        },
      );
      expect(errOutput).toBe("No cached match for hash: nonexistent");
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("cache clear removes all entries", async () => {
    const dbPath = setupTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("a", {
        animeId: "1",
        episodeId: null,
        entryType: "tv",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });
      expect(cache.has("a")).toBe(true);

      const handlers = createCacheHandlers({ dbPath });
      let logOutput = "";
      await handlers.clear(
        true,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );
      expect(logOutput).toBe("Cache cleared");
      expect(cache.has("a")).toBe(false);
    } finally {
      cleanupTempDb(dbPath);
    }
  });

  test("cache clear skips when confirmation denied", async () => {
    const dbPath = setupTempDb();
    try {
      const cache = new MatchCache({ dbPath });
      cache.set("a", {
        animeId: "1",
        episodeId: null,
        entryType: "tv",
        season: null,
        episode: null,
        title: null,
        timestamp: "2026-01-01T00:00:00.000Z",
      });

      const handlers = createCacheHandlers({ dbPath });
      let logOutput = "";
      await handlers.clear(
        false,
        (msg: string) => {
          logOutput = msg;
        },
        () => {},
      );
      expect(logOutput).toBe("Cache clear cancelled");
      expect(cache.has("a")).toBe(true);
    } finally {
      cleanupTempDb(dbPath);
    }
  });
});
