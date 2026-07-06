import type { TrackerWatchStatus } from "../types";

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
