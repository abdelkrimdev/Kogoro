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
  type?: TVDBEpisodeType;
}

type TVDBEpisodeType =
  | "series"
  | "movie"
  | "ova"
  | "special"
  | "short"
  | "music_video"
  | "trailer"
  | "behind_the_scenes";

interface TVDBArtworkItem {
  id: number;
  image: string;
  type: number;
  width?: number;
  height?: number;
  language?: string;
  season?: number;
}

function toEntryType(type: string | undefined): EntryType {
  switch (type) {
    case "movie":
      return "movie";
    case "ova":
      return "ova";
    case "special":
    case "short":
    case "music_video":
    case "trailer":
    case "behind_the_scenes":
      return "special";
    default:
      return "tv";
  }
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

function extractTitleJa(aliases: TVDBAlias[] | string[] | undefined): string | undefined {
  for (const alias of aliases ?? []) {
    const name = typeof alias === "string" ? alias : alias.name;
    const lang = typeof alias === "string" ? undefined : alias.lang;
    if (lang === undefined || lang === "jpn") return name;
  }
  return undefined;
}

export class TVDBPlugin implements DatabasePlugin {
  private token: string | null = null;
  private apiKey: string;
  private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;

  constructor(options: {
    apiKey?: string;
    fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
  }) {
    this.apiKey = options.apiKey ?? "";
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  private async ensureToken(): Promise<string | null> {
    if (this.token) return this.token;

    const response = await this.fetchFn(`${BASE_URL}/login`, {
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

  private async apiRequest<T>(path: string, method: string = "GET"): Promise<T | null> {
    const token = await this.ensureToken();
    if (!token) return null;

    const response = await this.fetchFn(`${BASE_URL}${path}`, {
      method,
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
        titleEn: item.name,
        titleJa: extractTitleJa(item.aliases),
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
      titleEn: data.name,
      titleJa: extractTitleJa(data.aliases),
      overview: data.overview,
      year: data.year ? Number.parseInt(data.year, 10) : undefined,
      image: data.image,
      status: data.status,
      entryType: "tv",
    };
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const data = await this.apiRequest<{
      episodes?: TVDBEpisodeItem[];
    }>(`/series/${animeId}/episodes/default`);

    if (!data?.episodes) return [];

    const jaData = await this.apiRequest<{
      episodes?: TVDBEpisodeItem[];
    }>(`/series/${animeId}/episodes/official/jpn`);

    const jaNames = new Map<number, string>();
    for (const ep of jaData?.episodes ?? []) {
      if (ep.number !== undefined && ep.name) {
        jaNames.set(ep.number, ep.name);
      }
    }

    return data.episodes.map(
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
        entryType: toEntryType(item.type),
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
