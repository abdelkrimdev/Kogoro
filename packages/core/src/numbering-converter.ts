import type { EpisodeResult } from "./types";

export function relativeToAbsolute(
  season: number,
  episode: number,
  allEpisodes: EpisodeResult[],
): number | null {
  if (season <= 0 || allEpisodes.length === 0) return null;

  const seasonCounts = countBySeason(allEpisodes);
  const sortedSeasons = [...seasonCounts.keys()].sort((a, b) => a - b);

  let absolute = 0;
  for (const s of sortedSeasons) {
    if (s >= season) break;
    absolute += seasonCounts.get(s) ?? 0;
  }

  return absolute + episode;
}

export function absoluteToRelative(
  absoluteEpisode: number,
  allEpisodes: EpisodeResult[],
): { season: number; episode: number } | null {
  if (allEpisodes.length === 0) return null;

  const seasonCounts = countBySeason(allEpisodes);
  const sortedSeasons = [...seasonCounts.keys()].sort((a, b) => a - b);

  let accumulated = 0;
  for (const s of sortedSeasons) {
    const count = seasonCounts.get(s) ?? 0;
    if (absoluteEpisode <= accumulated + count) {
      return { season: s, episode: absoluteEpisode - accumulated };
    }
    accumulated += count;
  }

  return null;
}

function countBySeason(episodes: EpisodeResult[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const ep of episodes) {
    counts.set(ep.season, (counts.get(ep.season) ?? 0) + 1);
  }
  return counts;
}
