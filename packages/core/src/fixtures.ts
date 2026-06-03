import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KeytarLike } from "./config/bun-secrets-keytar";
import { ConfigManager } from "./config/config-manager";
import { CredentialStore } from "./config/credential-store";
import { HttpClient } from "./io/http-client";
import { LibraryDb } from "./library/library-db";
import { type CachedMatch, MatchCache } from "./match/match-cache";
import type { MatcherLike, MatchResult } from "./match/matcher";
import type { ParsedResult, ParsedTags } from "./parse/parser";
import type { AnimeResult, ArtworkResult, DatabasePlugin, EpisodeResult } from "./types";

export interface EnrichmentSend {
  enrichmentProgress?: (data: {
    animeId: string;
    command: "artwork" | "metadata";
    completed: number;
    total: number;
    file: string;
    status: string;
  }) => void;
  enrichmentComplete?: (data: {
    animeId: string;
    command: "artwork" | "metadata";
    success: boolean;
    error?: string;
  }) => void;
}

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

export function writeTempFile(dir: string, name: string, content = "content"): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

export function mockFetch(
  data: string,
  status = 200,
  contentType = "image/jpeg",
): (url: string | URL, init?: RequestInit) => Promise<Response> {
  return async (_url: string | URL, _init?: RequestInit) => {
    return new Response(data, {
      status,
      headers: { "Content-Type": contentType },
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

export function createMockResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, init);
}

export function createMockHttpClient(
  fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>,
  opts?: { minDelay?: number; maxRetries?: number },
): HttpClient {
  return new HttpClient({ fetch, minDelay: 0, maxRetries: 0, ...opts });
}

export function createCache(dir: string): MatchCache {
  return new MatchCache({ dbPath: join(dir, "cache.db") });
}

export const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

interface MockDbOptions {
  searchAnime?: (title: string) => AnimeResult[];
  getEpisodes?: (animeId: string) => EpisodeResult[];
  getArtwork?: ArtworkResult[];
  getAnime?: () => AnimeResult | null;
}

export function createArtworkDb(artworks: ArtworkResult[] = []): DatabasePlugin {
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

export function createLibraryDb(dir: string): LibraryDb {
  return new LibraryDb({ dbPath: join(dir, "library.db") });
}

export function createMockDb(opts: MockDbOptions = {}): DatabasePlugin {
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
        titleEn: `Ep ${id - 1}`,
        entryType: "tv",
      });
    }
  }
  return result;
}

export function makeMatchResult(overrides?: Partial<MatchResult>): MatchResult {
  return {
    anime: { id: "1", titleEn: "Jujutsu Kaisen", entryType: "tv" },
    episode: {
      id: "101",
      animeId: "1",
      season: 1,
      episode: 13,
      titleEn: "Tomorrow",
      entryType: "tv",
    },
    score: 1,
    ...overrides,
  };
}

export async function seedCacheEntry(
  dir: string,
  videoFilename: string,
  overrides?: Partial<CachedMatch>,
): Promise<{ cache: MatchCache; videoPath: string; hash: string }> {
  const videoPath = join(dir, videoFilename);
  writeFileSync(videoPath, "test content");
  const cache = createCache(dir);
  const hash = await MatchCache.hashFile(videoPath);
  cache.set(hash, makeCachedMatch(overrides));
  return { cache, videoPath, hash };
}

export async function withMockFetch(
  mockImpl: typeof globalThis.fetch,
  fn: () => Promise<void>,
): Promise<void> {
  const origFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    await fn();
  } finally {
    globalThis.fetch = origFetch;
  }
}

export function createCountingFetch(
  fn?: (url: string | URL, init?: RequestInit) => Promise<Response>,
) {
  let callCount = 0;
  return {
    getCallCount: () => callCount,
    fn: (url: string | URL, init?: RequestInit) => {
      callCount++;
      if (fn) return fn(url, init);
      return Promise.resolve(createMockResponse("ok", { status: 200 }));
    },
  };
}

export function createSequenceFetch(...responses: Response[]) {
  let callCount = 0;
  return {
    getCallCount: () => callCount,
    fn: (_url: string | URL, _init?: RequestInit) => {
      if (callCount >= responses.length) {
        return Promise.resolve(createMockResponse("ok", { status: 200 }));
      }
      const r = responses[callCount];
      if (r === undefined) return Promise.resolve(createMockResponse("ok", { status: 200 }));
      callCount++;
      return Promise.resolve(r);
    },
  };
}

export function createSequenceHttpClient(...responses: Response[]): HttpClient {
  return createMockHttpClient(createSequenceFetch(...responses).fn);
}

export function createTrackingFetch(urls: string[], responseBody?: string) {
  return async (url: string | URL) => {
    urls.push(toUrlString(url));
    return createMockResponse(responseBody ?? testImageBytes, { status: 200 });
  };
}

export function createMockKeytar(initial?: Record<string, string>): KeytarLike {
  const store = new Map(Object.entries(initial ?? {}));
  return {
    setPassword(service: string, account: string, password: string): Promise<void> {
      store.set(`${service}:${account}`, password);
      return Promise.resolve();
    },
    getPassword(service: string, account: string): Promise<string | null> {
      return Promise.resolve(store.get(`${service}:${account}`) ?? null);
    },
    deletePassword(service: string, account: string): Promise<boolean> {
      return Promise.resolve(store.delete(`${service}:${account}`));
    },
  };
}

export function stubBunSecrets(impl: typeof Bun.secrets): void {
  Object.defineProperty(Bun, "secrets", {
    ...Object.getOwnPropertyDescriptor(Bun, "secrets"),
    value: impl,
  });
}

export function silentBunSecrets(): typeof Bun.secrets {
  return {
    get: async () => null,
    set: async () => {},
    delete: async () => false,
  };
}

export async function withTestConfig(
  label: string,
  fn: (dir: string, config: ConfigManager, credentialStore: CredentialStore) => Promise<void>,
  keytar: KeytarLike | null = null,
): Promise<void> {
  await withTempDir(label, async (dir) => {
    const config = new ConfigManager({ configDir: dir });
    const credentialStore = new CredentialStore({ keytar });
    await fn(dir, config, credentialStore);
  });
}

export function createEpisodeNumberingMatcher(
  animeId: string,
  episodes: EpisodeResult[],
  matchEpisode: EpisodeResult,
): MatcherLike {
  return {
    async match() {
      return [
        makeMatchResult({
          anime: { id: animeId, titleEn: "Test Anime", entryType: "tv" },
          episode: matchEpisode,
        }),
      ];
    },
    async matchBatch(_parsedList: ParsedResult[]) {
      return [
        makeMatchResult({
          anime: { id: animeId, titleEn: "Test Anime", entryType: "tv" },
          episode: matchEpisode,
        }),
      ];
    },
    getEpisodes() {
      return episodes;
    },
  };
}

export function createMockMatcher(results?: MatchResult[]): MatcherLike {
  const defaultResults = results ?? [makeMatchResult()];
  return {
    async match() {
      return defaultResults;
    },
    async matchBatch(parsedList: ParsedResult[]) {
      return parsedList.map((_, i) => {
        const r = defaultResults[i % defaultResults.length];
        if (!r) return makeMatchResult();
        return r;
      });
    },
    getEpisodes() {
      return [];
    },
  };
}

export function makeNoMatchResult(failureReason = "No anime found"): MatchResult {
  return { anime: { id: "", titleEn: "", entryType: "tv" }, score: 0, failureReason };
}

export function createCallCounter() {
  let count = 0;
  return {
    get: () => count,
    inc: () => {
      count++;
    },
  };
}

export function makeParsedResult(
  title: string | null,
  season: number | null = null,
  episode: number | null = null,
  tags?: Partial<ParsedTags>,
): ParsedResult {
  return {
    title,
    season,
    episode,
    tags: { group: null, resolution: null, source: null, codec: null, audio: null, ...tags },
  };
}

interface MockAnime {
  animeId: string;
  title: string;
  entryType?: "tv" | "movie" | "ova" | "special";
  episodes: Array<{ id: string; season: number; episode: number; titleEn: string }>;
}

export function createAmbiguousMatcher(): MatcherLike {
  return {
    async match(parsed) {
      return [
        {
          anime: { id: "1", titleEn: parsed.title ?? "", entryType: "tv" as const },
          episode: {
            id: "101",
            animeId: "1",
            season: 1,
            episode: 1,
            titleEn: "Ep 1",
            entryType: "tv" as const,
          },
          score: 1,
        },
        {
          anime: {
            id: "2",
            titleEn: `${parsed.title ?? ""} Special`,
            entryType: "special" as const,
          },
          episode: {
            id: "201",
            animeId: "2",
            season: 1,
            episode: 1,
            titleEn: "Special",
            entryType: "special" as const,
          },
          score: 0.85,
        },
      ];
    },
    async matchBatch(parsedList) {
      const results: MatchResult[] = [];
      for (const p of parsedList) {
        const matches = await this.match(p);
        results.push(
          matches[0] ?? {
            anime: { id: "", titleEn: "", entryType: "tv" },
            score: 0,
            failureReason: "No match",
          },
        );
      }
      return results;
    },
    getEpisodes() {
      return [];
    },
  };
}

export function createTrackingMatcher(): {
  matcher: MatcherLike;
  batchCallTitles: string[][];
} {
  const batchCallTitles: string[][] = [];
  const baseMatcher = createMockMatcher();

  return {
    batchCallTitles,
    matcher: {
      async match(parsed) {
        return baseMatcher.match(parsed);
      },
      async matchBatch(parsedList) {
        batchCallTitles.push(parsedList.map((p) => p.title ?? ""));
        return baseMatcher.matchBatch(parsedList);
      },
      getEpisodes(animeId: string) {
        return baseMatcher.getEpisodes(animeId);
      },
    },
  };
}

export function createDataMockDb(animes: MockAnime[]): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return animes
        .filter((a) => a.title.toLowerCase().includes(title.toLowerCase()))
        .map((a) => ({ id: a.animeId, titleEn: a.title, entryType: a.entryType ?? "tv" }));
    },
    async getEpisodes(animeId: string) {
      const anime = animes.find((a) => a.animeId === animeId);
      return (anime?.episodes ?? []).map((e) => ({
        id: e.id,
        season: e.season,
        episode: e.episode,
        titleEn: e.titleEn,
        animeId,
        entryType: anime?.entryType ?? "tv",
      }));
    },
    async getArtwork() {
      return [];
    },
    async getAnime() {
      return null;
    },
  };
}

export function createSilentCredentialStore(): CredentialStore {
  return new CredentialStore({ keytar: null });
}

export const noopEnrichmentSend: EnrichmentSend = {};

export function createTrackingEnrichmentSend(
  captured: Array<{ completed: number; total: number; status: string }>,
): EnrichmentSend {
  return {
    enrichmentProgress: (data: { completed: number; total: number; status: string }) => {
      captured.push(data);
    },
  };
}
