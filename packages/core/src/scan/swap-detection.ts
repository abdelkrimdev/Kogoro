export interface SwapInputEntry {
  fileId: string;
  filePath: string;
  animeId: string;
  season: number;
  episode: number;
  proposedEpisode: number | null;
  proposedSeason: number | null;
}

export interface SwapResult {
  fileAId: string;
  fileBId: string;
  filePathA: string;
  filePathB: string;
  episodeA: number;
  episodeB: number;
  seasonA: number;
  seasonB: number;
}

export function detectSwaps(entries: SwapInputEntry[]): SwapResult[] {
  const swaps: SwapResult[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a || a.proposedEpisode === null) continue;
    if (visited.has(a.fileId)) continue;

    const proposedASeason = a.proposedSeason ?? a.season;

    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (!b || b.proposedEpisode === null) continue;
      if (visited.has(b.fileId)) continue;
      if (a.animeId !== b.animeId) continue;

      const proposedBSeason = b.proposedSeason ?? b.season;

      const isSwap =
        a.proposedEpisode === b.episode &&
        proposedASeason === b.season &&
        b.proposedEpisode === a.episode &&
        proposedBSeason === a.season;

      if (isSwap) {
        swaps.push({
          fileAId: a.fileId,
          fileBId: b.fileId,
          filePathA: a.filePath,
          filePathB: b.filePath,
          episodeA: b.episode,
          episodeB: a.episode,
          seasonA: b.season,
          seasonB: a.season,
        });
        visited.add(a.fileId);
        visited.add(b.fileId);
        break;
      }
    }
  }

  return swaps;
}

export function extractEpisodeFromPath(path: string | null): number | null {
  if (!path) return null;
  const match = path.match(/E(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

export function extractSeasonFromPath(path: string | null): number | null {
  if (!path) return null;
  const match = path.match(/(?:S|Season\s*)(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}
