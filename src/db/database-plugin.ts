import type { AnimeResult, ArtworkResult, ArtworkType, EpisodeResult } from "./types.ts";

export interface DatabasePlugin {
  searchAnime(title: string): Promise<AnimeResult[]>;
  getAnime(animeId: string): Promise<AnimeResult | null>;
  getEpisodes(animeId: string): Promise<EpisodeResult[]>;
  getArtwork(animeId: string, type: ArtworkType): Promise<ArtworkResult[]>;
  getTranslations?(animeId: string): Promise<Record<string, string>>;
}
