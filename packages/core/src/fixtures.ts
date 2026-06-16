import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KeytarLike } from "./config/bun-secrets-keytar";
import { ConfigManager } from "./config/config-manager";
import { CredentialStore } from "./config/credential-store";
import { hashFile } from "./io/file-hash";

export { hashFile } from "./io/file-hash";

import { HttpClient } from "./io/http-client";
import { LibraryRepository } from "./library/library-repository";
import { createLibraryDb as createLibraryDbInstance } from "./library/test-utils";
import { CacheService } from "./match/cache-service";
import type { CachedMatch } from "./match/match-repository";
import { MatchRepository } from "./match/match-repository";
import {
  AMBIGUOUS_MATCH_REASON,
  bestPerAnimeId,
  isClearWinner,
  type MatcherLike,
  type MatchResult,
} from "./match/matcher";
import { ScanStateRepository } from "./match/scan-state-repository";
import { ScanStateService } from "./match/scan-state-service";
import { createMatchCacheDb as createMatchCacheDbInstance } from "./match/test-utils";
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

export const testImageBytes = "\xff\xd8\xff\xe0\u0000\u0010JFIF\u0000\u0001";

interface MockDbOptions {
  searchAnime?: (title: string) => AnimeResult[];
  getEpisodes?: (animeId: string) => EpisodeResult[];
  getArtwork?: ArtworkResult[];
  getAnime?: () => AnimeResult | null;
  track?: boolean;
}

interface MockDbTracking {
  searchCalls: ReturnType<typeof createCallCounter>;
  episodeCalls: ReturnType<typeof createCallCounter>;
  searchTitles: string[];
  episodeIds: string[];
}

type MockDbResult = DatabasePlugin & { tracking?: MockDbTracking };

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

export function createLibraryRepository(dir?: string): {
  repo: LibraryRepository;
  close: () => void;
} {
  const { db, sqlite } = createLibraryDbInstance(dir);
  const repo = new LibraryRepository(db);
  return { repo, close: () => sqlite.close() };
}

export function createMatchRepository(dir?: string): { repo: MatchRepository; close: () => void } {
  const { db, sqlite } = createMatchCacheDbInstance(dir);
  const repo = new MatchRepository(db);
  return { repo, close: () => sqlite.close() };
}

export function createMatchCacheService(dir?: string): {
  matchRepo: MatchRepository;
  scanStateRepo: ScanStateRepository;
  cacheService: CacheService;
  scanStateService: ScanStateService;
  close: () => void;
} {
  const { db, sqlite } = createMatchCacheDbInstance(dir);
  const matchRepo = new MatchRepository(db);
  const scanStateRepo = new ScanStateRepository(db);
  const cacheService = new CacheService(matchRepo, scanStateRepo);
  const scanStateService = new ScanStateService(scanStateRepo);
  return { matchRepo, scanStateRepo, cacheService, scanStateService, close: () => sqlite.close() };
}

export function createMockDb(opts: MockDbOptions = {}): MockDbResult {
  const tracking: MockDbTracking | undefined = opts.track
    ? {
        searchCalls: createCallCounter(),
        episodeCalls: createCallCounter(),
        searchTitles: [],
        episodeIds: [],
      }
    : undefined;

  const db: DatabasePlugin = {
    async searchAnime(title: string) {
      tracking?.searchCalls.inc();
      tracking?.searchTitles.push(title);
      return (
        opts.searchAnime?.(title) ??
        (tracking ? [{ id: "1", titleEn: title, entryType: "tv" }] : [])
      );
    },
    async getEpisodes(animeId: string) {
      tracking?.episodeCalls.inc();
      tracking?.episodeIds.push(animeId);
      return opts.getEpisodes?.(animeId) ?? [];
    },
    async getArtwork() {
      return opts.getArtwork ?? [];
    },
    async getAnime() {
      return opts.getAnime?.() ?? null;
    },
  };

  return Object.assign(db, { tracking });
}

export function makeCachedMatch(overrides: Partial<CachedMatch> = {}): CachedMatch {
  return {
    animeId: "1",
    episodeId: null,
    entryType: "tv",
    season: null,
    episode: null,
    title: null,
    sourceDb: "tvdb",
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
  cacheService?: CacheService,
): Promise<{ matchRepo: MatchRepository | undefined; videoPath: string; hash: string }> {
  const videoPath = join(dir, videoFilename);
  writeFileSync(videoPath, "test content");
  const hash = await hashFile(videoPath);
  if (cacheService) {
    cacheService.set(hash, makeCachedMatch(overrides));
    return { matchRepo: undefined, videoPath, hash };
  }
  const { repo: matchRepo } = createMatchRepository(dir);
  matchRepo.set(hash, makeCachedMatch(overrides));
  return { matchRepo, videoPath, hash };
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
          allEpisodes: episodes,
        }),
      ];
    },
    async matchBatch(_parsedList: ParsedResult[]) {
      return [
        makeMatchResult({
          anime: { id: animeId, titleEn: "Test Anime", entryType: "tv" },
          episode: matchEpisode,
          allEpisodes: episodes,
        }),
      ];
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
        const best = bestPerAnimeId(matches);
        const winner = isClearWinner(best);
        if (!winner) {
          results.push({
            anime: { id: "", titleEn: "", entryType: "tv" },
            score: 0,
            failureReason: AMBIGUOUS_MATCH_REASON,
          });
        } else {
          results.push(winner);
        }
      }
      return results;
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
    },
  };
}

export function makeSeasonEpisodes(
  season: number,
  count: number,
  opts: {
    animeId?: string;
    startEpisode?: number;
    entryType?: "tv" | "movie" | "ova" | "special";
  } = {},
): EpisodeResult[] {
  const { animeId = "1", startEpisode = 1, entryType = "tv" } = opts;
  return Array.from({ length: count }, (_, i) => ({
    id: `s${season}e${i + 1}`,
    animeId,
    season,
    episode: startEpisode + i,
    titleEn: `S${season}E${i + 1}`,
    entryType,
  }));
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

export function makeReviewGroup(
  overrides?: Partial<import("./types").ReviewGroup>,
): import("./types").ReviewGroup {
  return {
    animeId: "anime-1",
    animeTitle: "Anime",
    entryType: "tv",
    files: [],
    swapPairs: [],
    ...overrides,
  };
}

export function makeScanResult(
  file: string,
  overrides?: Partial<import("./scan/scanner").ScanResult>,
): import("./scan/scanner").ScanResult {
  return {
    file,
    hash: `hash-${file}`,
    parsed: makeParsedResult(null),
    match: null,
    plan: null,
    cached: false,
    skipped: false,
    status: "matched",
    ...overrides,
  };
}
