import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CachedMatch, MatchCache } from "./match-cache";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { AnimeResult, ArtworkResult, EpisodeResult } from "./plugins/database/types";

export function toUrlString(url: string | URL): string {
  return typeof url === "string" ? url : url.toString();
}

export async function withTempDir(
  label: string,
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), `kogoro-test-${label}-`));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function mockFetch(
  data: string,
  status = 200,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": "image/jpeg" },
    });
  };
}

export function mockJsonFetch(
  data: unknown,
  status = 200,
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

export function createCache(dir: string): MatchCache {
  return new MatchCache({ dbPath: join(dir, "cache.db") });
}

export const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

export interface MockDbOptions {
  searchAnime?: (title: string) => AnimeResult[];
  getEpisodes?: (animeId: string) => EpisodeResult[];
  getArtwork?: ArtworkResult[];
  getAnime?: () => AnimeResult | null;
}

export function createMockDb(
  artworksOrOptions: ArtworkResult[] | MockDbOptions = [],
): DatabasePlugin {
  if (Array.isArray(artworksOrOptions)) {
    const artworks = artworksOrOptions;
    return {
      async searchAnime() {
        return [];
      },
      async getEpisodes() {
        return [];
      },
      async getArtwork() {
        return artworks;
      },
      async getAnime() {
        return null;
      },
    };
  }
  const opts = artworksOrOptions;
  return {
    async searchAnime(title: string) {
      return opts.searchAnime?.(title) ?? [];
    },
    async getEpisodes(animeId: string) {
      return opts.getEpisodes?.(animeId) ?? [];
    },
    async getArtwork() {
      return opts.getArtwork ?? [];
    },
    async getAnime() {
      return opts.getAnime?.() ?? null;
    },
  };
}

export function makeThrowingDb(): DatabasePlugin {
  return {
    async searchAnime() {
      throw new Error("Should not be called");
    },
    async getEpisodes() {
      throw new Error("Should not be called");
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

export function makeCachedMatch(overrides: Partial<CachedMatch> = {}): CachedMatch {
  return {
    animeId: "1",
    episodeId: null,
    entryType: "tv",
    season: null,
    episode: null,
    title: null,
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeEpisodes(perSeason: number, seasonCount: number): EpisodeResult[] {
  const result: EpisodeResult[] = [];
  let id = 1;
  for (let s = 1; s <= seasonCount; s++) {
    for (let e = 1; e <= perSeason; e++) {
      result.push({
        id: String(id++),
        animeId: "1",
        season: s,
        episode: e,
        title: `Ep ${id - 1}`,
        entryType: "tv",
      });
    }
  }
  return result;
}
