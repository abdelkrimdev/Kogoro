import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AnimeResult,
  type ArtworkResult,
  type ArtworkType,
  CONFIG_DIR,
  type DatabasePlugin,
  type EntryType,
  type EpisodeResult,
  HttpClient,
} from "@kogoro/core";

const BASE_URL = "http://api.anidb.net:9001/httpapi";
const TITLE_CACHE_FILENAME = "anime-titles.xml";
const TITLE_CACHE_URL = "https://anidb.net/api/anime-titles.xml.gz";
const TITLE_CACHE_ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PREQUEL_DEPTH = 10;

const ENTRY_TYPE_MAP: Record<string, EntryType> = {
  "TV Series": "tv",
  Movie: "movie",
  OVA: "ova",
  Special: "special",
  "TV Special": "special",
};

function toEntryType(animeType: string): EntryType {
  return ENTRY_TYPE_MAP[animeType] ?? "tv";
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[:\-_,.!?'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return match?.[1];
}

function extractBlock(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1];
}

interface ParsedTitle {
  lang: string;
  value: string;
  type?: string;
}

function parseTitles(xml: string): ParsedTitle[] {
  const titles: ParsedTitle[] = [];
  const regex = /<title\s+([^>]*)>([^<]*)<\/title>/g;
  for (const match of xml.matchAll(regex)) {
    const attrs = match[1] ?? "";
    const value = match[2];
    if (!value) continue;
    const lang = attrs.match(/(?:xml:)?lang="([^"]*)"/)?.[1] ?? "";
    const type = attrs.match(/type="([^"]*)"/)?.[1];
    titles.push({ lang, value, type });
  }
  return titles;
}

interface RelatedAnimeEntry {
  id: string;
  type: string;
}

interface ParsedEpisode {
  id: string;
  epno: string | undefined;
  titles: ParsedTitle[];
  airdate: string | undefined;
}

function parseEpisodes(xml: string): ParsedEpisode[] {
  const episodes: ParsedEpisode[] = [];
  const episodesContent = extractBlock(xml, "episodes");
  if (!episodesContent) return episodes;

  const regex = /<episode\s+id="(\d+)"[^>]*>([\s\S]*?)<\/episode>/g;
  for (const match of episodesContent.matchAll(regex)) {
    const id = match[1];
    const content = match[2];
    if (!id || !content) continue;
    episodes.push({
      id,
      epno: extractTag(content, "epno"),
      titles: parseTitles(content),
      airdate: extractTag(content, "airdate"),
    });
  }
  return episodes;
}

interface AnimeDocument {
  animeType: string;
  description: string | undefined;
  startdate: string | undefined;
  picture: string | undefined;
  titles: ParsedTitle[];
  episodes: ParsedEpisode[];
  relatedAnime: RelatedAnimeEntry[];
}

function parseRelatedAnime(xml: string): RelatedAnimeEntry[] {
  const block = extractBlock(xml, "relatedanime");
  if (!block) return [];
  const entries: RelatedAnimeEntry[] = [];
  const regex = /<anime\s+id="(\d+)"\s+type="([^"]*)">[^<]*<\/anime>/g;
  for (const match of block.matchAll(regex)) {
    entries.push({ id: match[1] ?? "", type: match[2] ?? "" });
  }
  return entries;
}

function parseDocument(xml: string): AnimeDocument {
  const titlesBlock = extractBlock(xml, "titles") ?? "";
  return {
    animeType: extractTag(xml, "type") ?? "",
    description: extractTag(xml, "description"),
    startdate: extractTag(xml, "startdate"),
    picture: extractTag(xml, "picture"),
    titles: parseTitles(titlesBlock),
    episodes: parseEpisodes(xml),
    relatedAnime: parseRelatedAnime(xml),
  };
}

function findTitles(titles: Iterable<{ lang: string; value: string | undefined; type?: string }>): {
  titleEn: string | undefined;
  titleJa: string | undefined;
} {
  let titleEn: string | undefined;
  let titleJa: string | undefined;
  for (const t of titles) {
    if (titleEn === undefined) {
      if (t.type === "main" && t.lang !== "ja") titleEn = t.value;
      else if (t.lang === "en") titleEn = t.value;
    }
    if (titleJa === undefined && t.lang === "ja") titleJa = t.value;
    if (titleEn !== undefined && titleJa !== undefined) break;
  }
  return { titleEn, titleJa };
}

export class AniDBPlugin implements DatabasePlugin {
  private httpClient: HttpClient;
  private client: string;
  private clientver: string;
  private cacheDir: string;
  private seasonCache = new Map<string, number>();
  private docCache = new Map<string, AnimeDocument>();
  private rootTitleCache = new Map<string, { titleEn: string; titleJa?: string }>();

  constructor(options: {
    client: string;
    clientver: string;
    httpClient?: HttpClient;
    cacheDir?: string;
  }) {
    this.httpClient = options.httpClient ?? new HttpClient();
    this.client = options.client;
    this.clientver = options.clientver;
    this.cacheDir = options.cacheDir ?? join(CONFIG_DIR, "anidb");
  }

  private commonParams(): string {
    return `client=${this.client}&clientver=${this.clientver}&protover=1`;
  }

  private checkAniDBError(xml: string, codes?: string[]): void {
    const match = xml.match(/<error(?:\s+code="([^"]*)")?>([^<]*)<\/error>/);
    if (!match) return;
    const code = match[1] || "unknown";
    const message = match[2] ?? "";
    if (codes && !codes.includes(code)) return;
    throw new Error(`AniDB error ${code}: ${message}`);
  }

  private async resolveSeason(animeId: string, depth = 0): Promise<number> {
    const cached = this.seasonCache.get(animeId);
    if (cached !== undefined) return cached;
    if (depth >= MAX_PREQUEL_DEPTH) return depth + 1;

    const doc = await this.fetchDocument(animeId);
    if (!doc) return depth + 1;

    const prequel = doc.relatedAnime.find((r) => r.type === "Prequel");
    if (!prequel) {
      this.seasonCache.set(animeId, 1);
      return 1;
    }

    const prequelSeason = await this.resolveSeason(prequel.id, depth + 1);
    this.seasonCache.set(animeId, prequelSeason + 1);
    return prequelSeason + 1;
  }

  private async resolveRootTitle(
    animeId: string,
    depth = 0,
  ): Promise<{ titleEn: string; titleJa?: string } | null> {
    const cached = this.rootTitleCache.get(animeId);
    if (cached) return cached;
    if (depth >= MAX_PREQUEL_DEPTH) return null;

    const doc = await this.fetchDocument(animeId);
    if (!doc) return null;

    const prequel = doc.relatedAnime.find((r) => r.type === "Prequel");

    if (prequel) {
      const root = await this.resolveRootTitle(prequel.id, depth + 1);
      if (root?.titleEn) {
        this.rootTitleCache.set(animeId, root);
        return root;
      }
    }

    const { titleEn, titleJa } = findTitles(doc.titles);
    if (!titleEn) return null;
    const result = { titleEn, titleJa };
    this.rootTitleCache.set(animeId, result);
    return result;
  }

  private async fetchDocument(animeId: string): Promise<AnimeDocument | null> {
    const cached = this.docCache.get(animeId);
    if (cached) return cached;
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return null;
    const xml = await response.text();
    this.checkAniDBError(xml);
    const doc = parseDocument(xml);
    this.docCache.set(animeId, doc);
    return doc;
  }

  private get titleCachePath(): string {
    return join(this.cacheDir, TITLE_CACHE_FILENAME);
  }

  private isTitleCacheFresh(): boolean {
    try {
      const mtime = statSync(this.titleCachePath).mtimeMs;
      return Date.now() - mtime < TITLE_CACHE_ONE_DAY_MS;
    } catch {
      return false;
    }
  }

  private async downloadTitleCache(): Promise<void> {
    const response = await this.httpClient.fetch(TITLE_CACHE_URL, {
      headers: { "User-Agent": "kogoro" },
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
    writeFileSync(this.titleCachePath, xml, "utf-8");
  }

  private loadTitleCacheXml(): string {
    return readFileSync(this.titleCachePath, "utf-8");
  }

  private searchTitleCache(query: string): AnimeResult[] {
    const xml = this.loadTitleCacheXml();
    const results: AnimeResult[] = [];
    const normalizedQuery = normalize(query);
    const animeRegex = /<anime\s+([^>]*)>([\s\S]*?)<\/anime>/g;

    for (const match of xml.matchAll(animeRegex)) {
      const attrs = match[1] ?? "";
      const content = match[2];
      if (!content) continue;

      const aid = attrs.match(/aid="(\d+)"/)?.[1];
      if (!aid) continue;

      const titles = parseTitles(content);
      const { titleEn, titleJa } = findTitles(titles);
      if (!titleEn) continue;

      const matched = titles.some((t) => t.value && normalize(t.value).includes(normalizedQuery));
      if (!matched) continue;

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

  async searchAnime(title: string): Promise<AnimeResult[]> {
    try {
      if (!this.isTitleCacheFresh()) {
        await this.downloadTitleCache();
      }
      return this.searchTitleCache(title);
    } catch {
      return [];
    }
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const doc = await this.fetchDocument(animeId);
    if (!doc) return [];
    const entryType = toEntryType(doc.animeType);
    const episodes: EpisodeResult[] = [];

    const season = await this.resolveSeason(animeId);

    for (const ep of doc.episodes) {
      const episodeNum = ep.epno ? Number.parseInt(ep.epno, 10) : NaN;
      if (Number.isNaN(episodeNum)) continue;

      const { titleEn, titleJa } = findTitles(ep.titles);

      episodes.push({
        id: ep.id,
        animeId,
        season,
        episode: episodeNum,
        titleEn: titleEn ?? titleJa ?? "",
        titleJa,
        airDate: ep.airdate,
        entryType,
      });
    }
    return episodes;
  }

  async getAnime(animeId: string): Promise<AnimeResult | null> {
    const rootTitles = await this.resolveRootTitle(animeId);
    if (!rootTitles) return null;

    const doc = await this.fetchDocument(animeId);
    if (!doc) return null;

    return {
      id: animeId,
      titleEn: rootTitles.titleEn,
      titleJa: rootTitles.titleJa,
      overview: doc.description,
      year: doc.startdate ? Number.parseInt(doc.startdate.slice(0, 4), 10) : undefined,
      entryType: toEntryType(doc.animeType),
    };
  }

  async getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]> {
    const doc = await this.fetchDocument(animeId);
    if (!doc) return [];
    if (type !== "poster") return [];
    if (!doc.picture) return [];
    return [
      {
        id: `poster-${animeId}`,
        type: "poster",
        url: `https://cdn.anidb.net/images/main/${doc.picture}`,
      },
    ];
  }
}
