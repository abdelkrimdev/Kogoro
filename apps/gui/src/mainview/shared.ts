export interface RPCClient {
  request: (method: string, params: unknown) => Promise<unknown>;
}

const ENTRY_LABELS: Record<string, string> = {
  tv: "TV",
  movie: "Movie",
  ova: "OVA",
  special: "Specials",
};

export const TEMPLATE_PRESETS = [
  { value: "standard", label: "Standard (Recommended)" },
  { value: "compact", label: "Compact" },
  { value: "absolute", label: "Absolute" },
  { value: "plex", label: "Plex" },
  { value: "anidb", label: "AniDB" },
  { value: "custom", label: "Custom" },
];

export function statusColorClass(status: string): string {
  switch (status) {
    case "matched":
      return "preset-tonal-success";
    case "ambiguous":
      return "preset-tonal-warning";
    case "failed":
      return "preset-tonal-error";
    case "cached":
      return "preset-tonal-primary";
    default:
      return "preset-tonal-surface";
  }
}

export function statusBadgeClass(status: string): string {
  return `badge ${statusColorClass(status)}`;
}

export function entryTypeLabel(type: string): string {
  return ENTRY_LABELS[type] ?? type;
}

const WATCH_STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  completed: "Completed",
  "plan-to-watch": "Plan to Watch",
  plan_to_watch: "Plan to Watch",
  "on-hold": "On Hold",
  on_hold: "On Hold",
  dropped: "Dropped",
};

export function watchStatusLabel(status: string): string {
  return WATCH_STATUS_LABELS[status] ?? status;
}

const WATCH_STATUS_TEXT_COLOR: Record<string, string> = {
  watching: "text-primary-500-400",
  completed: "text-success-500-400",
  "plan-to-watch": "text-surface-600-400",
  plan_to_watch: "text-surface-600-400",
  "on-hold": "text-warning-500-400",
  on_hold: "text-warning-500-400",
  dropped: "text-error-500-400",
};

const WATCH_STATUS_BADGE: Record<string, string> = {
  watching: "badge preset-tonal-primary",
  completed: "badge preset-tonal-success",
  "plan-to-watch": "badge preset-tonal-surface",
  plan_to_watch: "badge preset-tonal-surface",
  "on-hold": "badge preset-tonal-warning",
  on_hold: "badge preset-tonal-warning",
  dropped: "badge preset-tonal-error",
};

const ENTRY_TYPE_BADGE: Record<string, string> = {
  movie: "badge preset-tonal-secondary",
  ova: "badge preset-tonal-warning",
  special: "badge preset-tonal-error",
};

export function watchStatusColorClass(status: string): string {
  return WATCH_STATUS_TEXT_COLOR[status] ?? "text-surface-600-400";
}

export function watchStatusBadgeClass(status: string): string {
  return WATCH_STATUS_BADGE[status] ?? "badge preset-tonal-surface";
}

export function entryTypeBadgeClass(entryType: string): string {
  return ENTRY_TYPE_BADGE[entryType] ?? "badge preset-tonal-primary";
}

export function watchStatusPreset(status: string): string {
  switch (status) {
    case "watching":
      return "primary";
    case "completed":
      return "success";
    case "plan-to-watch":
    case "plan_to_watch":
      return "warning";
    case "on-hold":
    case "on_hold":
      return "tertiary";
    case "dropped":
      return "error";
    default:
      return "surface";
  }
}
