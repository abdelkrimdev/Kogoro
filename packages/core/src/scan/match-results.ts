import type { MatchEntry } from "../types";
import type { GroupApproval } from "./group-approval";
import type { ScanResult } from "./scanner";

export function buildMatchResults(
  results: ScanResult[],
  canonicalIdMap: Map<string, string>,
  groupApproval: GroupApproval,
  sourceDb: string,
): MatchEntry[] {
  const entries: MatchEntry[] = [];

  for (const r of results) {
    if (!r.match) continue;
    if (r.status !== "matched" && r.status !== "cached") continue;

    const originalId = r.match.anime.id;
    const canonicalId = canonicalIdMap.get(originalId) ?? originalId;
    if (groupApproval.isRejected(canonicalId)) continue;
    if (groupApproval.hasApprovals && !groupApproval.isApproved(canonicalId)) continue;

    entries.push({
      animeId: canonicalId,
      animeTitle: r.match.anime.titleEn,
      entryType: r.match.anime.entryType,
      episodeId: r.match.episode?.id ?? null,
      episode: r.match.episode?.episode ?? null,
      season: r.match.episode?.season ?? null,
      title: r.match.episode?.titleEn ?? null,
      filePath: r.file,
      sourceDb,
    });
  }

  return entries;
}
