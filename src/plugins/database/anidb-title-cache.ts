import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HttpClient } from "../../http-client";
import { findTitles, parseTitles } from "./anidb-xml";
import type { AnimeResult } from "./types";

export class AnidbTitleCache {
  private static readonly CACHE_FILENAME = "anime-titles.xml";
  private static readonly DUMP_URL = "http://anidb.net/api/anime-titles.xml.gz";
  private static readonly USER_AGENT = "kogoro";
  private static readonly ONE_DAY_MS = 24 * 60 * 60 * 1000;

  private cacheDir: string;
  private ttlMs: number;
  private httpClient: HttpClient;

  constructor(options: {
    cacheDir: string;
    ttlMs?: number;
    httpClient: HttpClient;
  }) {
    this.cacheDir = options.cacheDir;
    this.ttlMs = options.ttlMs ?? AnidbTitleCache.ONE_DAY_MS;
    this.httpClient = options.httpClient;
  }

  private get cachePath(): string {
    return join(this.cacheDir, AnidbTitleCache.CACHE_FILENAME);
  }

  private isFresh(): boolean {
    try {
      const mtime = statSync(this.cachePath).mtimeMs;
      return Date.now() - mtime < this.ttlMs;
    } catch {
      return false;
    }
  }

  private async download(): Promise<void> {
    const response = await this.httpClient.fetch(AnidbTitleCache.DUMP_URL, {
      headers: { "User-Agent": AnidbTitleCache.USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Failed to download anime titles: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const decompressed = Bun.gunzipSync(new Uint8Array(buffer));
    const xml = new TextDecoder().decode(decompressed);

    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
    writeFileSync(this.cachePath, xml, "utf-8");
  }

  private loadXml(): string {
    return readFileSync(this.cachePath, "utf-8");
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    try {
      if (!this.isFresh()) {
        await this.download();
      }
      const xml = this.loadXml();
      return this.parseTitlesXml(xml, title);
    } catch {
      return [];
    }
  }

  private parseTitlesXml(xml: string, query: string): AnimeResult[] {
    const results: AnimeResult[] = [];
    const lowerQuery = query.toLowerCase();
    const animeRegex = /<anime\s+([^>]*)>([\s\S]*?)<\/anime>/g;

    for (const match of xml.matchAll(animeRegex)) {
      const attrs = match[1] ?? "";
      const content = match[2];
      if (!content) continue;

      const aid = attrs.match(/aid="(\d+)"/)?.[1];
      if (!aid) continue;

      const titles = parseTitles(content);
      const { titleEn, titleJa } = findTitles(titles);
      if (!titleEn?.toLowerCase().includes(lowerQuery)) continue;

      const yearAttr = attrs.match(/year="(\d+)"/)?.[1];
      results.push({
        id: aid,
        titleEn,
        titleJa,
        year: yearAttr ? Number.parseInt(yearAttr, 10) : undefined,
        entryType: "tv",
      });
    }
    return results;
  }
}
