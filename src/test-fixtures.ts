import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigManager } from "./config/config-manager";
import { CredentialStore, type KeytarLike } from "./config/credential-store";
import { type CachedMatch, MatchCache } from "./match-cache";
import type { Matcher, MatchResult } from "./matcher";
import type { ParsedResult, ParsedTags } from "./parser";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { AnimeResult, ArtworkResult, EpisodeResult } from "./plugins/database/types";
import type { SubtitlePlugin } from "./plugins/subtitle/plugin";
import type { SubtitleResult } from "./plugins/subtitle/types";

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

export function makeMatchResult(overrides?: Partial<MatchResult>): MatchResult {
  return {
    anime: { id: "1", title: "Jujutsu Kaisen", entryType: "tv" },
    episode: {
      id: "101",
      animeId: "1",
      season: 1,
      episode: 13,
      title: "Tomorrow",
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

export function createTrackingFetch(urls: string[], responseBody?: string) {
  return async (url: string | URL) => {
    urls.push(toUrlString(url));
    return createMockResponse(responseBody ?? testImageBytes, { status: 200 });
  };
}

export function createLogCapture() {
  let output = "";
  let errorOutput = "";
  return {
    get output() {
      return output;
    },
    get errorOutput() {
      return errorOutput;
    },
    onLog(msg: string) {
      output = msg;
    },
    onError(msg: string) {
      errorOutput = msg;
    },
    onLogAppend(msg: string) {
      output += `${msg}\n`;
    },
    onErrorAppend(msg: string) {
      errorOutput += `${msg}\n`;
    },
    reset() {
      output = "";
      errorOutput = "";
    },
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
  // biome-ignore lint/suspicious/noExplicitAny: test stub for Bun internals
  (Bun as any).secrets = impl;
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

export function captureConsoleLog<T>(fn: () => T): { result: T; logs: string[] } {
  const origLog = console.log;
  const logs: string[] = [];
  console.log = (msg: string) => logs.push(msg);
  try {
    const result = fn();
    return { result, logs };
  } finally {
    console.log = origLog;
  }
}

export function createStandardMockDb(overrides?: Partial<MockDbOptions>): DatabasePlugin {
  return createMockDb({
    searchAnime: (title: string) => [{ id: "12345", title, entryType: "tv" as const }],
    getEpisodes: () => [
      {
        id: "1001",
        animeId: "12345",
        season: 1,
        episode: 1,
        title: "Ryomen Sukuna",
        airDate: "2020-10-03",
        entryType: "tv" as const,
      },
    ],
    ...overrides,
  });
}

export function createMockMatcher(results?: MatchResult[]): Matcher {
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
  } as unknown as Matcher;
}

interface MockSubtitlePluginOptions {
  searchResults?: SubtitleResult[];
  downloadContent?: string;
}

export function createMockSubtitlePlugin(opts: MockSubtitlePluginOptions = {}): SubtitlePlugin {
  return {
    async search(): Promise<SubtitleResult[]> {
      return (
        opts.searchResults ?? [
          {
            id: "sub1",
            fileId: 101,
            language: "en",
            format: "srt",
            score: 5000,
            fileName: "Jujutsu Kaisen - 1x01 - Ryomen Sukuna.srt",
          },
        ]
      );
    },
    async download(): Promise<string> {
      return opts.downloadContent ?? "1\n00:00:01,000 --> 00:00:05,000\nHello world\n";
    },
  };
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
  episodes: Array<{ id: string; season: number; episode: number; title: string }>;
}

export function createDataMockDb(animes: MockAnime[]): DatabasePlugin {
  return {
    async searchAnime(title: string) {
      return animes
        .filter((a) => a.title.toLowerCase().includes(title.toLowerCase()))
        .map((a) => ({ id: a.animeId, title: a.title, entryType: a.entryType ?? "tv" }));
    },
    async getEpisodes(animeId: string) {
      const anime = animes.find((a) => a.animeId === animeId);
      return (anime?.episodes ?? []).map((e) => ({
        ...e,
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
