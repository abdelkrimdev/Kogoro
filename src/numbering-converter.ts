import type { EpisodeResult } from "./db/types";

export type NumberingScheme = "absolute" | "relative";

export function relativeToAbsolute(
  season: number,
  episode: number,
  allEpisodes: EpisodeResult[],
): number | null {
  if (season <= 0 || allEpisodes.length === 0) return null;

  const seasonCounts = new Map<number, number>();
  for (const ep of allEpisodes) {
    seasonCounts.set(ep.season, (seasonCounts.get(ep.season) ?? 0) + 1);
  }

  let absolute = 0;
  const sortedSeasons = [...seasonCounts.keys()].sort((a, b) => a - b);
  for (const s of sortedSeasons) {
    if (s >= season) break;
    absolute += seasonCounts.get(s) ?? 0;
  }
  absolute += episode;

  return absolute;
}

export function absoluteToRelative(
  absoluteEpisode: number,
  allEpisodes: EpisodeResult[],
): { season: number; episode: number } | null {
  if (allEpisodes.length === 0) return null;

  const seasonCounts = new Map<number, number>();
  for (const ep of allEpisodes) {
    seasonCounts.set(ep.season, (seasonCounts.get(ep.season) ?? 0) + 1);
  }

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

export function convertEpisodeNumbering(
  season: number,
  episode: number,
  allEpisodes: EpisodeResult[],
  sourceScheme: NumberingScheme,
  preferredScheme: NumberingScheme,
): { season: number; episode: number } | null {
  if (sourceScheme === preferredScheme) {
    return { season, episode };
  }

  if (sourceScheme === "relative" && preferredScheme === "absolute") {
    const absolute = relativeToAbsolute(season, episode, allEpisodes);
    return absolute === null ? null : { season, episode: absolute };
  }

  return absoluteToRelative(episode, allEpisodes);
}
