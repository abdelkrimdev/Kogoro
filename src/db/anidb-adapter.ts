import { HttpClient } from "../http-client.ts";
import type { DatabasePlugin } from "./database-plugin.ts";
import type { AnimeResult, ArtworkResult, ArtworkType, EntryType, EpisodeResult } from "./types.ts";

const BASE_URL = "http://api.anidb.net:9001/httpapi";

function toEntryType(animeType: string): EntryType {
  switch (animeType) {
    case "TV Series":
      return "tv";
    case "Movie":
      return "movie";
    case "OVA":
      return "ova";
    case "Special":
    case "TV Special":
      return "special";
    default:
      return "tv";
  }
}

function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
  return match?.[1];
}

export class AniDBAdapter implements DatabasePlugin {
  private httpClient: HttpClient;
  private client: string;
  private clientver: string;

  constructor(options: {
    client: string;
    clientver: string;
    httpClient?: HttpClient;
  }) {
    this.httpClient = options.httpClient ?? new HttpClient();
    this.client = options.client;
    this.clientver = options.clientver;
  }

  private commonParams(): string {
    return `client=${this.client}&clientver=${this.clientver}&protover=1`;
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=animetitles&${this.commonParams()}`,
    );
    if (!response.ok) return [];
    const xml = await response.text();
    const results: AnimeResult[] = [];
    const lowerTitle = title.toLowerCase();
    const animeRegex = /<anime\s+([^>]*)>([\s\S]*?)<\/anime>/g;
    for (const match of xml.matchAll(animeRegex)) {
      const attrs = match[1] ?? "";
      const content = match[2];
      if (!content) continue;
      const aid = attrs.match(/aid="(\d+)"/)?.[1];
      if (!aid) continue;

      let mainTitle: string | undefined;
      let originalTitle: string | undefined;
      const titleRegex = /<title[^>]*type="([^"]*)"[^>]*lang="([^"]*)"[^>]*>([^<]*)<\/title>/g;
      for (const titleMatch of content.matchAll(titleRegex)) {
        const lang = titleMatch[2];
        const value = titleMatch[3];
        if (lang === "en" && mainTitle === undefined) {
          mainTitle = value;
        }
        if (lang === "ja" && originalTitle === undefined) {
          originalTitle = value;
        }
        if (mainTitle !== undefined && originalTitle !== undefined) {
          break;
        }
      }
      if (!mainTitle?.toLowerCase().includes(lowerTitle)) {
        continue;
      }

      const yearAttr = attrs.match(/year="(\d+)"/);
      results.push({
        id: aid,
        title: mainTitle,
        originalTitle,
        year: yearAttr ? Number.parseInt(yearAttr[1] ?? "0", 10) : undefined,
        entryType: "tv",
      });
    }
    return results;
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return [];
    const xml = await response.text();
    const animeType = extractTag(xml, "type") ?? "";
    const entryType = toEntryType(animeType);
    const episodes: EpisodeResult[] = [];
    const episodeRegex = /<episode\s+id="(\d+)">([\s\S]*?)<\/episode>/g;
    for (const match of xml.matchAll(episodeRegex)) {
      const epId = match[1];
      const content = match[2];
      if (!epId || !content) continue;
      const epnoText = extractTag(content, "epno") ?? "";
      const episodeNum = Number.parseInt(epnoText, 10);
      if (Number.isNaN(episodeNum)) continue;
      const seasonText = extractTag(content, "season") ?? "1";
      const parsedSeason = Number.parseInt(seasonText, 10);
      const season = Number.isNaN(parsedSeason) ? 1 : parsedSeason;
      const epTitle = extractTag(content, "title") ?? "";
      const epAirdate = extractTag(content, "airdate");
      episodes.push({
        id: epId,
        animeId,
        season,
        episode: episodeNum,
        title: epTitle,
        airDate: epAirdate,
        entryType,
      });
    }
    return episodes;
  }

  async getAnime(animeId: string): Promise<AnimeResult | null> {
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return null;
    const xml = await response.text();

    const animeType = extractTag(xml, "type") ?? "";
    const entryType = toEntryType(animeType);
    const description = extractTag(xml, "description");
    const startdate = extractTag(xml, "startdate");
    const year = startdate ? Number.parseInt(startdate.slice(0, 4), 10) : undefined;

    let title: string | undefined;
    let originalTitle: string | undefined;
    const titleRegex = /<title[^>]*type="([^"]*)"[^>]*lang="([^"]*)"[^>]*>([^<]*)<\/title>/g;
    const titlesMatch = xml.match(/<titles>([\s\S]*?)<\/titles>/);
    const titlesContent = titlesMatch?.[1] ?? "";
    for (const titleMatch of titlesContent.matchAll(titleRegex)) {
      const lang = titleMatch[2];
      const value = titleMatch[3];
      if (lang === "en" && title === undefined) {
        title = value;
      }
      if (lang === "ja" && originalTitle === undefined) {
        originalTitle = value;
      }
      if (title !== undefined && originalTitle !== undefined) {
        break;
      }
    }

    if (!title) return null;

    return {
      id: animeId,
      title,
      originalTitle,
      overview: description,
      year,
      entryType,
    };
  }

  async getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]> {
    const response = await this.httpClient.fetch(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return [];
    const xml = await response.text();
    if (type !== "poster") return [];
    const picture = extractTag(xml, "picture");
    if (!picture) return [];
    return [
      {
        id: `poster-${animeId}`,
        type: "poster",
        url: `https://cdn.anidb.net/images/main/${picture}`,
      },
    ];
  }
}
