export interface RPCClient {
  request: (method: string, params: unknown) => Promise<unknown>;
}

export const ENTRY_LABELS: Record<string, string> = {
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

export function typeBadgeClass(type: string): string {
  const base = "badge";
  switch (type) {
    case "tv":
      return `${base} preset-tonal-primary`;
    case "movie":
      return `${base} preset-tonal-success`;
    case "ova":
      return `${base} preset-tonal-warning`;
    case "special":
      return `${base} preset-tonal-error`;
    default:
      return `${base} preset-tonal-surface`;
  }
}

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
