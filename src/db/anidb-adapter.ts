import type { DatabasePlugin } from "./database-plugin.ts";
import type { AnimeResult, ArtworkResult, ArtworkType, EntryType, EpisodeResult } from "./types.ts";

const BASE_URL = "http://api.anidb.net:9001/httpapi";

type FetchFunction = (url: string | URL, init?: RequestInit) => Promise<Response>;

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
  private fetchFn: FetchFunction;
  private client: string;
  private clientver: string;

  constructor(options: {
    client: string;
    clientver: string;
    fetch?: FetchFunction;
  }) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.client = options.client;
    this.clientver = options.clientver;
  }

  private commonParams(): string {
    return `client=${this.client}&clientver=${this.clientver}&protover=1`;
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    const response = await this.fetchFn(`${BASE_URL}?request=animetitles&${this.commonParams()}`);
    if (!response.ok) return [];
    const xml = await response.text();
    const results: AnimeResult[] = [];
    const animeRegex = /<anime\s+([^>]*)>([\s\S]*?)<\/anime>/g;
    for (;;) {
      const match = animeRegex.exec(xml);
      if (match === null) break;
      const attrs = match[1] ?? "";
      const content = match[2];
      if (!content) continue;
      const aid = attrs.match(/aid="(\d+)"/)?.[1];
      if (!aid) continue;
      const titles: Array<{ type: string; lang: string; value: string }> = [];
      const titleRegex = /<title[^>]*type="([^"]*)"[^>]*lang="([^"]*)"[^>]*>([^<]*)<\/title>/g;
      for (;;) {
        const titleMatch = titleRegex.exec(content);
        if (titleMatch === null) break;
        titles.push({
          type: titleMatch[1] ?? "",
          lang: titleMatch[2] ?? "",
          value: titleMatch[3] ?? "",
        });
      }
      const mainTitle = titles.find((t) => t.lang === "en")?.value;
      if (!mainTitle) continue;
      const lowerTitle = title.toLowerCase();
      if (!mainTitle.toLowerCase().includes(lowerTitle)) continue;
      const originalTitle = titles.find((t) => t.lang === "ja")?.value;
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
    const response = await this.fetchFn(
      `${BASE_URL}?request=anime&aid=${animeId}&${this.commonParams()}`,
    );
    if (!response.ok) return [];
    const xml = await response.text();
    const animeType = extractTag(xml, "type") ?? "";
    const entryType = toEntryType(animeType);
    const episodes: EpisodeResult[] = [];
    const episodeRegex = /<episode\s+id="(\d+)">([\s\S]*?)<\/episode>/g;
    for (;;) {
      const match = episodeRegex.exec(xml);
      if (match === null) break;
      const epId = match[1];
      const content = match[2];
      if (!epId || !content) continue;
      const epnoText = extractTag(content, "epno") ?? "";
      const episodeNum = Number.parseInt(epnoText, 10);
      if (Number.isNaN(episodeNum)) continue;
      const epTitle = extractTag(content, "title") ?? "";
      const epAirdate = extractTag(content, "airdate");
      episodes.push({
        id: epId,
        animeId,
        season: 1,
        episode: episodeNum,
        title: epTitle,
        airDate: epAirdate,
        entryType,
      });
    }
    return episodes;
  }

  async getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]> {
    const response = await this.fetchFn(
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
        type: "poster" as ArtworkType,
        url: `https://cdn.anidb.net/images/main/${picture}`,
      },
    ];
  }
}
