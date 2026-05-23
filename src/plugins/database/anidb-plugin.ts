import { homedir } from "node:os";
import { join } from "node:path";
import { HttpClient } from "../../http-client";
import { AnidbTitleCache } from "./anidb-title-cache";
import type { ParsedTitle } from "./anidb-xml";
import { findTitles, parseTitles } from "./anidb-xml";
import type { DatabasePlugin } from "./plugin";
import type { AnimeResult, ArtworkResult, ArtworkType, EntryType, EpisodeResult } from "./types";

const BASE_URL = "http://api.anidb.net:9001/httpapi";

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

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return match?.[1];
}

function extractBlock(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1];
}

interface ParsedEpisode {
  id: string;
  epno: string | undefined;
  season: string | undefined;
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
      season: extractTag(content, "season"),
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
  };
}

export class AniDBPlugin implements DatabasePlugin {
  private httpClient: HttpClient;
  private client: string;
  private clientver: string;
  private titleCache: AnidbTitleCache;

  constructor(options: {
    client: string;
    clientver: string;
    httpClient?: HttpClient;
    cacheDir?: string;
  }) {
    this.httpClient = options.httpClient ?? new HttpClient();
    this.client = options.client;
    this.clientver = options.clientver;
    this.titleCache = new AnidbTitleCache({
      cacheDir: options.cacheDir ?? join(homedir(), ".config", "kogoro", "cache"),
      httpClient: this.httpClient,
    });
  }

  private commonParams(): string {
    return `client=${this.client}&clientver=${this.clientver}&protover=1`;
  }

  private checkAniDBError(xml: string): void {
    const match = xml.match(/<error(?:\s+code="([^"]*)")?>([^<]*)<\/error>/);
    if (!match) return;
    const code = match[1] || "unknown";
    const message = match[2] ?? "";
    throw new Error(`AniDB error ${code}: ${message}`);
  }

  private async fetchDocument(animeId: string): Promise<AnimeDocument | null> {
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return null;
    const xml = await response.text();
    this.checkAniDBError(xml);
    return parseDocument(xml);
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    return this.titleCache.searchAnime(title);
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const doc = await this.fetchDocument(animeId);
    if (!doc) return [];
    const entryType = toEntryType(doc.animeType);
    const episodes: EpisodeResult[] = [];

    for (const ep of doc.episodes) {
      const episodeNum = ep.epno ? Number.parseInt(ep.epno, 10) : NaN;
      if (Number.isNaN(episodeNum)) continue;
      const season = ep.season ? Number.parseInt(ep.season, 10) : 1;

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
    const doc = await this.fetchDocument(animeId);
    if (!doc) return null;

    const entryType = toEntryType(doc.animeType);
    const year = doc.startdate ? Number.parseInt(doc.startdate.slice(0, 4), 10) : undefined;

    const { titleEn, titleJa } = findTitles(doc.titles);
    if (!titleEn) return null;

    return {
      id: animeId,
      titleEn,
      titleJa,
      overview: doc.description,
      year,
      entryType,
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
