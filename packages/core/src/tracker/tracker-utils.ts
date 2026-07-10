import type { TrackerAnime, TrackerWatchStatus } from "../types";

export const ANILIST_CLIENT_ID = "45221";
export const ANILIST_REDIRECT_URI = "http://localhost:43219/callback/anilist";
export const MAL_CLIENT_ID = "97e4bfe9c07f9e679ec96e4906862030";
export const MAL_REDIRECT_URI = "http://localhost:43219/callback/mal";

export type LocalWatchStatus = "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped";

export function mapTrackerStatus(status: TrackerWatchStatus): LocalWatchStatus {
  switch (status) {
    case "plan-to-watch":
      return "plan_to_watch";
    case "on-hold":
      return "on_hold";
    default:
      return status;
  }
}

export function mapLocalStatusToTracker(status: string): TrackerWatchStatus {
  switch (status) {
    case "plan_to_watch":
      return "plan-to-watch";
    case "on_hold":
      return "on-hold";
    default:
      return status as TrackerWatchStatus;
  }
}

function stripSeasonFromTitle(title: string): string {
  return title.replace(/\s+season\s+\d+/i, "").trim();
}

export function extractSeasonNumber(trackerEntry: TrackerAnime): number | undefined {
  const title = trackerEntry.title.toLowerCase();
  const seasonMatch = title.match(/season\s+(\d+)/);
  if (seasonMatch?.[1]) {
    return Number.parseInt(seasonMatch[1], 10);
  }
  return undefined;
}

function titlesMatch(
  animeTitleLower: string,
  alternativeTitles: string[] | undefined,
  targetLower: string,
  targetBaseLower: string,
): boolean {
  if (animeTitleLower === targetLower) return true;
  if (stripSeasonFromTitle(animeTitleLower) === targetBaseLower) return true;
  if (alternativeTitles) {
    return alternativeTitles.some((t) => t.toLowerCase() === targetLower);
  }
  return false;
}

export function findMatchingAnime(
  trackerEntry: TrackerAnime,
  libraryAnimeList: Array<{ id: number; title: string; alternativeTitles?: string[] }>,
): { id: number; title: string } | null {
  const titleLower = trackerEntry.title.toLowerCase();
  const baseTitleLower = stripSeasonFromTitle(titleLower);

  for (const anime of libraryAnimeList) {
    const animeTitleLower = anime.title.toLowerCase();
    if (titlesMatch(animeTitleLower, anime.alternativeTitles, titleLower, baseTitleLower)) {
      return anime;
    }
  }

  if (trackerEntry.alternativeTitles) {
    for (const altTitle of trackerEntry.alternativeTitles) {
      const altLower = altTitle.toLowerCase();
      const altBaseLower = stripSeasonFromTitle(altLower);
      for (const anime of libraryAnimeList) {
        const animeTitleLower = anime.title.toLowerCase();
        if (titlesMatch(animeTitleLower, anime.alternativeTitles, altLower, altBaseLower)) {
          return anime;
        }
      }
    }
  }

  return null;
}
