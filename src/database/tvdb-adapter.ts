import type {
  AnimeResult,
  ArtworkResult,
  ArtworkType,
  DatabasePlugin,
  EntryType,
  EpisodeResult,
} from "./types.ts";

export type HttpFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

export interface TVDBAdapterOptions {
  apiKey?: string;
  token?: string;
  fetch?: HttpFetch;
}

function artworkTypeToTvdbId(type: ArtworkType): number {
  switch (type) {
    case "poster":
      return 2;
    case "fanart":
      return 1;
    case "banner":
      return 3;
  }
}

function tvdbTypeToEntryType(typeId: number | undefined): EntryType {
  switch (typeId) {
    case 5:
      return "Movie";
    case 6:
      return "Special";
    default:
      return "TV";
  }
}

const BASE_URL = "https://api4.thetvdb.com/v4";

export class TVDBAdapter implements DatabasePlugin {
  private apiKey: string | undefined;
  private token: string | undefined;
  private fetcher: HttpFetch;

  constructor(options: TVDBAdapterOptions = {}) {
    this.apiKey = options.apiKey;
    this.token = options.token;
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  private async ensureToken(): Promise<string> {
    if (this.token) return this.token;
    if (!this.apiKey) throw new Error("TVDB API key is required");

    const res = await this.fetcher(`${BASE_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.apiKey }),
    });
    const data = (await res.json()) as { token?: string };
    if (!data.token) throw new Error("Failed to obtain TVDB token");
    this.token = data.token;
    return this.token;
  }

  private async apiGet(path: string): Promise<unknown> {
    const token = await this.ensureToken();
    const res = await this.fetcher(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return { data: [] };
    return res.json();
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    try {
      const response = (await this.apiGet(`/search?query=${encodeURIComponent(title)}`)) as {
        data?: Array<{
          id: number;
          name: string;
          year?: string;
          image?: string;
          overview?: string;
        }>;
      };
      return (response.data ?? []).map((item) => ({
        id: String(item.id),
        title: item.name,
        year: item.year ? Number(item.year) : undefined,
        image: item.image,
        overview: item.overview,
      }));
    } catch {
      return [];
    }
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    try {
      const response = (await this.apiGet(
        `/series/${encodeURIComponent(animeId)}/episodes/default`,
      )) as {
        data?: Array<{
          id: number;
          name: string;
          seasonNumber: number;
          number: number;
          type?: { id: number };
          airDate?: string;
          overview?: string;
        }>;
      };
      return (response.data ?? []).map((item) => ({
        id: String(item.id),
        seasonNumber: item.seasonNumber,
        episodeNumber: item.number,
        title: item.name,
        entryType: tvdbTypeToEntryType(item.type?.id),
        airDate: item.airDate,
        overview: item.overview,
      }));
    } catch {
      return [];
    }
  }

  async getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]> {
    try {
      const tvdbType = artworkTypeToTvdbId(type);
      const response = (await this.apiGet(`/series/${encodeURIComponent(animeId)}/artworks`)) as {
        data?: Array<{
          id: number;
          type: number;
          image: string;
          width?: number;
          height?: number;
        }>;
      };
      return (response.data ?? [])
        .filter((item) => item.type === tvdbType)
        .map((item) => ({
          id: String(item.id),
          type,
          url: item.image,
          width: item.width,
          height: item.height,
        }));
    } catch {
      return [];
    }
  }
}
