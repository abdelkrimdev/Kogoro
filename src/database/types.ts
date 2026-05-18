export type ArtworkType = "poster" | "fanart" | "banner";

export type EntryType = "TV" | "Movie" | "OVA" | "Special";

export interface AnimeResult {
  id: string;
  title: string;
  year?: number;
  image?: string;
  overview?: string;
}

export interface EpisodeResult {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  titleEn?: string;
  titleJa?: string;
  entryType: EntryType;
  airDate?: string;
  overview?: string;
}

export interface ArtworkResult {
  id: string;
  type: ArtworkType;
  url: string;
  width?: number;
  height?: number;
}

export interface DatabasePlugin {
  searchAnime(title: string): Promise<AnimeResult[]>;
  getEpisodes(animeId: string): Promise<EpisodeResult[]>;
  getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]>;
}
