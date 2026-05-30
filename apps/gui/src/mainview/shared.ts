export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function typeBadgeClass(type: string): string {
  switch (type) {
    case "tv":
      return "bg-primary-500/20 text-primary-400";
    case "movie":
      return "bg-emerald-500/20 text-emerald-400";
    case "ova":
      return "bg-amber-500/20 text-amber-400";
    case "special":
      return "bg-rose-500/20 text-rose-400";
    default:
      return "bg-surface-600 text-surface-300";
  }
}

export function entryTypeLabel(type: string): string {
  switch (type) {
    case "tv":
      return "TV";
    case "movie":
      return "Movie";
    case "ova":
      return "OVA";
    case "special":
      return "Specials";
    default:
      return type;
  }
}
