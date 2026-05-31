export interface EpisodeRow {
  id: string;
  season: number;
  episode: number;
  titleEn: string;
  filePath: string;
  missing: boolean;
}

export function getAnimeDirectory(episodes: EpisodeRow[]): string | null {
  const paths = episodes.filter((ep) => ep.filePath).map((ep) => ep.filePath);
  const first = paths[0];
  if (!first) return null;

  const idx = first.lastIndexOf("/");
  if (idx === -1) return null;
  return first.substring(0, idx);
}
