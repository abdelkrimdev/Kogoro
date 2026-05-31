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
      return `${base} bg-primary-500/20 text-primary-400`;
    case "movie":
      return `${base} bg-emerald-500/20 text-emerald-400`;
    case "ova":
      return `${base} bg-amber-500/20 text-amber-400`;
    case "special":
      return `${base} bg-rose-500/20 text-rose-400`;
    default:
      return `${base} bg-surface-500/20 text-surface-400`;
  }
}

export function entryTypeLabel(type: string): string {
  return ENTRY_LABELS[type] ?? type;
}
