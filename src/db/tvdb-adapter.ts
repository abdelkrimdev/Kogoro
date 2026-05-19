import type { DatabasePlugin } from "./database-plugin.ts";
import type { AnimeResult, ArtworkResult, ArtworkType, EntryType, EpisodeResult } from "./types.ts";

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

interface TVDBTranslation {
  language: string;
  name: string;
  overview: string;
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

function extractOriginalTitle(aliases: TVDBAlias[] | string[] | undefined): string | undefined {
  if (!aliases || aliases.length === 0) return undefined;
  const first = aliases[0];
  if (first === undefined) return undefined;
  if (typeof first === "string") return first;
  return first.name;
}

export class TVDBAdapter implements DatabasePlugin {
  private token: string | null = null;
  private fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;

  constructor(
    private options: {
      apiKey?: string;
      fetch?: (url: string | URL, init?: RequestInit) => Promise<Response>;
    },
  ) {
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  private async ensureToken(): Promise<string | null> {
    if (this.token) return this.token;

    const response = await this.fetchFn(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.options.apiKey ?? "" }),
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
        title: item.name,
        originalTitle: extractOriginalTitle(item.aliases),
        overview: item.overview,
        year: item.year ? Number.parseInt(item.year, 10) : undefined,
        image: item.image,
        status: item.status,
        entryType: "tv",
      }),
    );
  }

  async getTranslations(animeId: string): Promise<Record<string, string>> {
    const data = await this.apiRequest<TVDBTranslation[]>(`/series/${animeId}/translations`);
    if (!data || !Array.isArray(data)) return {};
    const result: Record<string, string> = {};
    for (const t of data) {
      result[t.language] = t.name;
    }
    return result;
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const data = await this.apiRequest<{
      series?: TVDBSeriesResult;
      episodes?: TVDBEpisodeItem[];
    }>(`/series/${animeId}/episodes/default`);

    if (!data?.episodes) return [];

    const translations = await this.getTranslations(animeId);

    return data.episodes.map(
      (item): EpisodeResult => ({
        id: String(item.id),
        animeId,
        season: item.seasonNumber ?? 1,
        episode: item.number ?? 0,
        title: item.name ?? "",
        originalTitle: undefined,
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        titleEn: translations["eng"],
        // biome-ignore lint/complexity/useLiteralKeys: index signature requires bracket notation
        titleJa: translations["jpn"],
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
