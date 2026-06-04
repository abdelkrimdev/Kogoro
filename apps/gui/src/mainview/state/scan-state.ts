export type FolderStatus = "new" | "indexed" | "missing";

export interface EnrichedFolder {
  path: string;
  basename: string;
  addedAt: string;
  lastScannedAt?: string;
  exists: boolean;
  status: FolderStatus;
  relativeTimestamp?: string;
}

export function deriveFolderStatus(
  _addedAt: string,
  lastScannedAt: string | undefined,
  exists: boolean,
): FolderStatus {
  if (!exists) return "missing";
  if (lastScannedAt === undefined || lastScannedAt === "") return "new";
  return "indexed";
}

export function deriveScanFolders(
  folders: { path: string; addedAt: string; lastScannedAt?: string }[],
  existenceMap: Record<string, boolean>,
): EnrichedFolder[] {
  return folders.map((f) => {
    const exists = existenceMap[f.path] ?? false;
    const status = deriveFolderStatus(f.addedAt, f.lastScannedAt, exists);
    const basename = f.path === "/" ? "/" : (f.path.split("/").filter(Boolean).pop() ?? f.path);
    const enriched: EnrichedFolder = {
      path: f.path,
      basename,
      addedAt: f.addedAt,
      lastScannedAt: f.lastScannedAt,
      exists,
      status,
    };
    if (f.lastScannedAt) {
      enriched.relativeTimestamp = relativeTimestamp(f.lastScannedAt);
    }
    return enriched;
  });
}

export function relativeTimestamp(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 1) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}
