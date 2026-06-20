export interface EpisodeRow {
  id: string;
  season: number;
  episode: number;
  titleEn: string;
  filePath: string;
  missing: boolean;
}

export interface EpisodeGroupEpisode {
  id: string;
  episodeNumber: number;
  titleEn: string;
  filePath: string;
  watched: boolean;
}

export interface EpisodeGroupRow {
  id: string;
  entryType: string;
  seasonNumber?: number;
  watchStatus: string;
  synopsis?: string;
  rating?: number;
  coverArt?: string;
  onDiskCount: number;
  missingCount: number;
  episodes: EpisodeGroupEpisode[];
}

export function getAnimeDirectory(episodes: EpisodeRow[]): string | null {
  const paths = episodes.filter((ep) => ep.filePath).map((ep) => ep.filePath);
  const first = paths[0];
  if (!first) return null;

  const idx = first.lastIndexOf("/");
  if (idx === -1) return null;
  return first.substring(0, idx);
}

export function groupLabel(group: EpisodeGroupRow): string {
  const typeLabels: Record<string, string> = {
    tv: "TV",
    movie: "Movie",
    ova: "OVA",
    special: "Specials",
  };
  const typeLabel = typeLabels[group.entryType] ?? group.entryType;
  if (group.seasonNumber !== undefined) {
    return `Season ${group.seasonNumber} (${typeLabel})`;
  }
  return typeLabel;
}
