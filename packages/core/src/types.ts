export type EntryType = "tv" | "movie" | "ova" | "special";

export type ArtworkType = "poster" | "banner" | "fanart" | "thumbnail";

export interface AnimeResult {
  id: string;
  slug?: string;
  titleEn: string;
  titleJa?: string;
  overview?: string;
  year?: number;
  image?: string;
  status?: string;
  entryType: EntryType;
}

export interface EpisodeResult {
  id: string;
  animeId: string;
  season: number;
  episode: number;
  titleEn: string;
  titleJa?: string;
  airDate?: string;
  overview?: string;
  image?: string;
  entryType: EntryType;
}

export interface ArtworkResult {
  id: string;
  type: ArtworkType;
  url: string;
  width?: number;
  height?: number;
  language?: string;
  season?: number;
}

export interface SubtitleResult {
  id: string;
  fileId: number;
  language: string;
  format: string;
  score: number;
  fileName: string;
}

export interface DatabasePlugin {
  searchAnime(title: string): Promise<AnimeResult[]>;
  getAnime(animeId: string): Promise<AnimeResult | null>;
  getEpisodes(animeId: string): Promise<EpisodeResult[]>;
  getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]>;
}

export interface SubtitlePlugin {
  search(
    animeTitle: string,
    season?: number,
    episode?: number,
    language?: string,
  ): Promise<SubtitleResult[]>;
  download(fileId: number): Promise<string>;
}
