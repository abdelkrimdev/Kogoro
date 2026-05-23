import { HttpClient } from "../../http-client";
import type { DatabasePlugin } from "./plugin";
import type { AnimeResult, ArtworkResult, ArtworkType, EntryType, EpisodeResult } from "./types";

const BASE_URL = "https://api4.thetvdb.com/v4";

interface TVDBSearchResult {
  id: number;
  slug?: string;
  name: string;
  aliases?: string[];
  image?: string;
  year?: string;
  overview?: string;
  status?: string;
  translations?: { eng?: string };
  name_translated?: string;
}

interface TVDBAlias {
  name: string;
  lang?: string;
}

interface TVDBSeriesResult {
  id: number;
  slug?: string;
  name: string;
  aliases?: TVDBAlias[];
  image?: string;
  year?: string;
  overview?: string;
  status?: string;
}

interface TVDBEpisodeItem {
  id: number;
  seasonNumber?: number;
  number?: number;
  name?: string;
  overview?: string;
  aired?: string;
  image?: string;
  isMovie?: number;
}

interface TVDBArtworkItem {
  id: number;
  image: string;
  type: number;
  width?: number;
  height?: number;
  language?: string;
  season?: number;
}

function toEntryType(movieFlag: number | undefined, seasonNum: number | undefined): EntryType {
  if (movieFlag === 1) return "movie";
  if (seasonNum === 0) return "special";
  return "tv";
}

function toArtworkType(type: number): ArtworkType {
  switch (type) {
    case 1:
    case 14:
      return "poster";
    case 2:
    case 15:
      return "fanart";
    case 3:
      return "banner";
    default:
      return "thumbnail";
  }
}

function extractTitleJa(aliases: TVDBAlias[] | undefined): string | undefined {
  for (const alias of aliases ?? []) {
    if (alias.lang === undefined || alias.lang === "jpn") return alias.name;
  }
  return undefined;
}

function extractTitleEn(aliases: TVDBAlias[] | undefined): string | undefined {
  for (const alias of aliases ?? []) {
    if (alias.lang === "eng") return alias.name;
  }
  return undefined;
}

export class TVDBPlugin implements DatabasePlugin {
  private token: string | null = null;
  private apiKey: string;
  private httpClient: HttpClient;

  constructor(options: {
    apiKey: string;
    httpClient?: HttpClient;
  }) {
    this.apiKey = options.apiKey;
    this.httpClient = options.httpClient ?? new HttpClient();
  }

  private async ensureToken(): Promise<string | null> {
    if (this.token) return this.token;

    const response = await this.httpClient.fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.apiKey }),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as {
      data: { token: string };
    };
    this.token = json.data.token;
    return this.token;
  }

  private async apiRequest<T>(path: string): Promise<T | null> {
    const token = await this.ensureToken();
    if (!token) return null;

    const response = await this.httpClient.fetch(`${BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;

    const json = (await response.json()) as { data: T };
    return json.data;
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    const data = await this.apiRequest<TVDBSearchResult[]>(
      `/search?query=${encodeURIComponent(title)}&type=series`,
    );

    if (!data) return [];

    return data.map(
      (item): AnimeResult => ({
        id: String(item.id),
        slug: item.slug,
        titleEn: item.translations?.eng ?? item.name_translated ?? item.name,
        titleJa: item.aliases?.[0],
        overview: item.overview,
        year: item.year ? Number.parseInt(item.year, 10) : undefined,
        image: item.image,
        status: item.status,
        entryType: "tv",
      }),
    );
  }

  async getAnime(animeId: string): Promise<AnimeResult | null> {
    const data = await this.apiRequest<TVDBSeriesResult>(`/series/${animeId}`);

    if (!data) return null;

    return {
      id: String(data.id),
      slug: data.slug,
      titleEn: extractTitleEn(data.aliases) ?? data.name,
      titleJa: extractTitleJa(data.aliases),
      overview: data.overview,
      year: data.year ? Number.parseInt(data.year, 10) : undefined,
      image: data.image,
      status: data.status,
      entryType: "tv",
    };
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const enData = await this.apiRequest<{
      episodes?: TVDBEpisodeItem[];
    }>(`/series/${animeId}/episodes/default/eng?page=0`);

    if (!enData?.episodes) return [];

    const jaData = await this.apiRequest<{
      episodes?: TVDBEpisodeItem[];
    }>(`/series/${animeId}/episodes/default/jpn?page=0`);

    const jaNames = new Map<number, string>();
    for (const ep of jaData?.episodes ?? []) {
      if (ep.number !== undefined && ep.name) {
        jaNames.set(ep.number, ep.name);
      }
    }

    return enData.episodes.map(
      (item): EpisodeResult => ({
        id: String(item.id),
        animeId,
        season: item.seasonNumber ?? 1,
        episode: item.number ?? 0,
        titleEn: item.name ?? "",
        titleJa: item.number !== undefined ? jaNames.get(item.number) : undefined,
        airDate: item.aired ?? undefined,
        overview: item.overview ?? undefined,
        image: item.image ?? undefined,
        entryType: toEntryType(item.isMovie, item.seasonNumber),
      }),
    );
  }

  async getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]> {
    const data = await this.apiRequest<TVDBArtworkItem[]>(`/series/${animeId}/artworks`);

    if (!data) return [];

    const results: ArtworkResult[] = [];
    for (const item of data) {
      const artworkType = toArtworkType(item.type);
      if (artworkType !== type) continue;
      results.push({
        id: String(item.id),
        type: artworkType,
        url: item.image,
        width: item.width,
        height: item.height,
        language: item.language ?? undefined,
        season: item.season ?? undefined,
      });
    }
    return results;
  }
}
