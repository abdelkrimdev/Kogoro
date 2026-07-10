import {
  type AnimeResult,
  type ArtworkResult,
  type ArtworkType,
  type DatabasePlugin,
  type EntryType,
  type EpisodeResult,
  HttpClient,
} from "@kogoro/core";

interface TVDBSearchResult {
  id: string;
  slug?: string;
  name: string;
  aliases?: string[];
  image?: string;
  year?: string;
  overview?: string;
  status?: string;
  translations?: { eng?: string };
  name_translated?: string;
  tvdb_id?: string;
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

interface TVDBTranslation {
  name: string;
  overview?: string;
  language: string;
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

function findAlias(aliases: TVDBAlias[] | undefined, lang: string): string | undefined {
  return aliases?.find((a) => a.lang === lang)?.name;
}

function getAlternativeTitles(
  titleEn: string,
  titleJa: string | undefined,
  aliases: TVDBAlias[] | undefined,
): string[] | undefined {
  const alts: string[] = [];
  if (titleJa && titleJa !== titleEn) {
    alts.push(titleJa);
  }
  if (aliases) {
    for (const alias of aliases) {
      if (alias.name !== titleEn && alias.name !== titleJa) {
        alts.push(alias.name);
      }
    }
  }
  return alts.length > 0 ? alts : undefined;
}

export class TVDBPlugin implements DatabasePlugin {
  private token: string | null = null;
  private apiKey: string;
  private baseUrl: string;
  private httpClient: HttpClient;

  constructor(options: {
    apiKey: string;
    baseUrl: string;
    httpClient: HttpClient;
  }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.httpClient = options.httpClient;
  }

  private async ensureToken(): Promise<string | null> {
    if (this.token) return this.token;

    const response = await this.httpClient.fetch(`${this.baseUrl}/login`, {
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

  private async authenticatedGet(path: string): Promise<Response | null> {
    const token = await this.ensureToken();
    if (!token) return null;

    return this.httpClient.fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  private async apiRequest<T>(path: string): Promise<T | null> {
    const response = await this.authenticatedGet(path);
    if (!response?.ok) return null;

    const json = (await response.json()) as { data: T };
    return json.data;
  }

  async searchAnime(title: string): Promise<AnimeResult[]> {
    const normalizedTitle = title
      .replace(/[:\-_,.!?'"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = normalizedTitle.split(" ");

    for (let end = words.length; end >= 1; end--) {
      const query = words.slice(0, end).join(" ");
      const data = await this.apiRequest<TVDBSearchResult[]>(
        `/search?query=${encodeURIComponent(query)}&type=series`,
      );

      if (data && data.length > 0) {
        return data.map(
          (item): AnimeResult => ({
            id: item.tvdb_id ?? String(item.id).replace(/^series-/, ""),
            slug: item.slug,
            titleEn: item.translations?.eng ?? item.name_translated ?? item.name,
            titleJa: item.aliases?.[0],
            alternativeTitles: item.aliases?.filter((a) => a !== item.aliases?.[0]),
            overview: item.overview,
            year: item.year ? Number.parseInt(item.year, 10) : undefined,
            image: item.image,
            status: item.status,
            entryType: "tv",
          }),
        );
      }
    }

    return [];
  }

  async getAnime(animeId: string): Promise<AnimeResult | null> {
    const data = await this.apiRequest<TVDBSeriesResult>(`/series/${animeId}`);

    if (!data) return null;

    const [enTranslation, jaTranslation] = await Promise.all([
      this.apiRequest<TVDBTranslation>(`/series/${animeId}/translations/eng`),
      this.apiRequest<TVDBTranslation>(`/series/${animeId}/translations/jpn`),
    ]);

    const titleEn = enTranslation?.name ?? findAlias(data.aliases, "eng") ?? data.name;
    const titleJa = jaTranslation?.name ?? findAlias(data.aliases, "jpn");

    return {
      id: String(data.id),
      slug: data.slug,
      titleEn,
      titleJa,
      alternativeTitles: getAlternativeTitles(titleEn, titleJa, data.aliases),
      overview: enTranslation?.overview ?? data.overview,
      year: data.year ? Number.parseInt(data.year, 10) : undefined,
      image: data.image,
      status: data.status,
      entryType: "tv",
    };
  }

  private async fetchEpisodesByLang(animeId: string, lang: string): Promise<TVDBEpisodeItem[]> {
    const allEpisodes: TVDBEpisodeItem[] = [];
    let page = 0;

    while (true) {
      const response = await this.authenticatedGet(
        `/series/${animeId}/episodes/default/${lang}?page=${page}`,
      );

      if (!response?.ok) break;

      const json = (await response.json()) as {
        data?: { episodes?: TVDBEpisodeItem[] };
        links?: { next?: string | null };
      };

      if (!json.data?.episodes || json.data.episodes.length === 0) break;

      allEpisodes.push(...json.data.episodes);
      if (!json.links?.next) break;
      page++;
    }

    return allEpisodes;
  }

  async getEpisodes(animeId: string): Promise<EpisodeResult[]> {
    const [enEpisodes, jaEpisodes] = await Promise.all([
      this.fetchEpisodesByLang(animeId, "eng"),
      this.fetchEpisodesByLang(animeId, "jpn"),
    ]);

    if (enEpisodes.length === 0) return [];

    const jaNames = new Map<number, string>();
    for (const ep of jaEpisodes) {
      if (ep.number !== undefined && ep.name) {
        jaNames.set(ep.number, ep.name);
      }
    }

    return enEpisodes.map(
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
    const data = await this.apiRequest<{ artworks: TVDBArtworkItem[] }>(
      `/series/${animeId}/artworks`,
    );

    if (!data?.artworks) return [];

    const results: ArtworkResult[] = [];
    for (const item of data.artworks) {
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
