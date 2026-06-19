import type { TrackerWatchStatus } from "../types";

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
