export interface FribbRawEntry {
  type?: string;
  anidb_id?: number;
  anilist_id?: number;
  animecountdown_id?: number;
  animenewsnetwork_id?: number;
  "anime-planet_id"?: string;
  anisearch_id?: number;
  imdb_id?: string[];
  kitsu_id?: number;
  livechart_id?: number;
  mal_id?: number;
  simkl_id?: number;
  themoviedb_id?: { tv?: number; movie?: number[] };
  tvdb_id?: number;
  season?: { tvdb?: number; tmdb?: number };
  episode_offset?: { tvdb?: number; tmdb?: number };
}

export interface FribbRawCollection {
  name: string;
  ids: number[];
}
