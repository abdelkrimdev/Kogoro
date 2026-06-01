export const ENTRY_LABELS: Record<string, string> = {
  tv: "TV",
  movie: "Movie",
  ova: "OVA",
  special: "Specials",
};

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

export function entryTypeLabel(type: string): string {
  return ENTRY_LABELS[type] ?? type;
}
