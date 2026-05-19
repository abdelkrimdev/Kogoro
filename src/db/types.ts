export type EntryType = "tv" | "movie" | "ova" | "special";

export type ArtworkType = "poster" | "banner" | "fanart" | "thumbnail";

export interface AnimeResult {
  id: string;
  slug?: string;
  title: string;
  originalTitle?: string;
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
  title: string;
  originalTitle?: string;
  titleEn?: string;
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
