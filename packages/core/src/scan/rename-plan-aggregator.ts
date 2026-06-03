import { randomUUID } from "node:crypto";
import type { LibraryDb } from "../library/library-db";
import type {
  AnimeResult,
  FileRow,
  AnimeGroup as ScanAnimeGroup,
  ScanFileStatus,
  ReviewPlan as ScanReviewPlan,
  SwapPair as ScanSwapPair,
} from "../types";
import type { ScanResult } from "./scanner";

export interface SwapPair {
  files: [string, string];
  episodeA: number;
  episodeB: number;
  seasonA: number;
  seasonB: number;
}

export interface AnimeGroupEntry {
  scanResult: ScanResult;
  swapDetected?: SwapPair;
}

export interface AnimeGroup {
  animeId: string;
  anime: AnimeResult;
  entries: AnimeGroupEntry[];
  swapPairs: SwapPair[];
  mergeMode: boolean;
}

export interface ReviewPlan {
  groups: AnimeGroup[];
  totalFiles: number;
  totalAnime: number;
  totalSwaps: number;
  totalAmbiguous: number;
}

export function groupByAnime(results: ScanResult[]): Map<string, ScanResult[]> {
  const groups = new Map<string, ScanResult[]>();

  for (const result of results) {
    if (!result.match || result.status === "failed") continue;

    const animeId = result.match.anime.id;
    if (!animeId) continue;

    const existing = groups.get(animeId);
    if (existing) {
      existing.push(result);
    } else {
      groups.set(animeId, [result]);
    }
  }

  return groups;
}

function detectSwapsFromGroups(byAnime: Map<string, ScanResult[]>): SwapPair[] {
  const swaps: SwapPair[] = [];

  for (const [, group] of byAnime) {
    const withEpisodes = group.filter(
      (r) => r.match?.episode !== undefined && r.parsed.episode !== null,
    );

    for (let i = 0; i < withEpisodes.length; i++) {
      for (let j = i + 1; j < withEpisodes.length; j++) {
        const a = withEpisodes[i];
        const b = withEpisodes[j];
        if (!a || !b) continue;

        const aMatch = a.match?.episode;
        const bMatch = b.match?.episode;
        if (!aMatch || !bMatch) continue;

        const aParsedSeason = a.parsed.season ?? aMatch.season;
        const aParsedEpisode = a.parsed.episode ?? 0;
        const bParsedSeason = b.parsed.season ?? bMatch.season;
        const bParsedEpisode = b.parsed.episode ?? 0;

        const isSwap =
          aParsedEpisode === bMatch.episode &&
          aParsedSeason === bMatch.season &&
          bParsedEpisode === aMatch.episode &&
          bParsedSeason === aMatch.season;

        if (isSwap) {
          swaps.push({
            files: [a.file, b.file],
            episodeA: aMatch.episode,
            episodeB: bMatch.episode,
            seasonA: aMatch.season,
            seasonB: bMatch.season,
          });
        }
      }
    }
  }

  return swaps;
}

export function detectSwaps(results: ScanResult[]): SwapPair[] {
  return detectSwapsFromGroups(groupByAnime(results));
}

export function buildReviewPlan(
  results: ScanResult[],
  libraryDb?: LibraryDb,
  sourceDb?: string,
): ReviewPlan {
  const byAnime = groupByAnime(results);
  const allSwaps = detectSwapsFromGroups(byAnime);

  const fileToAnimeId = new Map<string, string>();
  for (const [animeId, scanResults] of byAnime) {
    for (const sr of scanResults) {
      fileToAnimeId.set(sr.file, animeId);
    }
  }

  const swapsByAnime = new Map<string, SwapPair[]>();
  for (const swap of allSwaps) {
    const firstFile = swap.files[0];
    if (!firstFile) continue;
    const animeId = fileToAnimeId.get(firstFile);
    if (!animeId) continue;
    const existing = swapsByAnime.get(animeId);
    if (existing) {
      existing.push(swap);
    } else {
      swapsByAnime.set(animeId, [swap]);
    }
  }

  const groups: AnimeGroup[] = [];

  for (const [animeId, scanResults] of byAnime) {
    const firstMatch = scanResults[0]?.match;
    if (!firstMatch) continue;

    const anime = firstMatch.anime;
    const swaps = swapsByAnime.get(animeId) ?? [];

    const entries: AnimeGroupEntry[] = scanResults
      .map((sr) => {
        const entry: AnimeGroupEntry = { scanResult: sr };
        for (const swap of swaps) {
          if (swap.files.includes(sr.file)) {
            entry.swapDetected = swap;
            break;
          }
        }
        return entry;
      })
      .sort((a, b) => {
        const aEp = a.scanResult.parsed.episode ?? 0;
        const bEp = b.scanResult.parsed.episode ?? 0;
        return aEp - bEp;
      });

    const mergeMode = libraryDb != null && libraryDb.findAnime(animeId, sourceDb ?? "tvdb") != null;

    groups.push({
      animeId,
      anime,
      entries,
      swapPairs: swaps,
      mergeMode,
    });
  }

  groups.sort((a, b) => a.anime.titleEn.localeCompare(b.anime.titleEn));

  let totalSwaps = 0;
  let totalAmbiguous = 0;
  for (const group of groups) {
    totalSwaps += group.swapPairs.length;
    for (const entry of group.entries) {
      if (entry.scanResult.status === "ambiguous") {
        totalAmbiguous++;
      }
    }
  }

  return {
    groups,
    totalFiles: results.length,
    totalAnime: groups.length,
    totalSwaps,
    totalAmbiguous,
  };
}

// --- Scan workflow aggregator (issue-62) ---

function generateFileId(): string {
  return randomUUID();
}

function detectSwapsFromFileRows(files: FileRow[]): ScanSwapPair[] {
  const swaps: ScanSwapPair[] = [];
  const visited = new Set<string>();

  for (let i = 0; i < files.length; i++) {
    const fileA = files[i];
    if (!fileA?.animeId || fileA.episode === null) continue;
    if (visited.has(fileA.fileId)) continue;

    const proposedA = extractEpisodeFromPath(fileA.proposedPath);
    if (proposedA === null) continue;

    for (let j = i + 1; j < files.length; j++) {
      const fileB = files[j];
      if (!fileB?.animeId || fileB.episode === null) continue;
      if (visited.has(fileB.fileId)) continue;
      if (fileA.animeId !== fileB.animeId) continue;

      const proposedB = extractEpisodeFromPath(fileB.proposedPath);
      if (proposedB === null) continue;

      if (proposedA === fileB.episode && proposedB === fileA.episode) {
        swaps.push({ fileAId: fileA.fileId, fileBId: fileB.fileId });
        visited.add(fileA.fileId);
        visited.add(fileB.fileId);
        break;
      }
    }
  }

  return swaps;
}

function extractEpisodeFromPath(path: string | null): number | null {
  if (!path) return null;
  const match = path.match(/E(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

function toFileRow(result: ScanResult): FileRow {
  let status: ScanFileStatus;
  if (result.status === "matched" || result.status === "cached") {
    status = result.plan ? "matched" : "cached";
  } else {
    status = result.status as ScanFileStatus;
  }

  return {
    fileId: generateFileId(),
    sourcePath: result.file,
    proposedPath: result.plan?.targetPath ?? null,
    status,
    animeId: result.match?.anime.id ?? null,
    episodeId: result.match?.episode?.id ?? null,
    episode: result.match?.episode?.episode ?? null,
    failureReason: result.failureReason,
  };
}

export function aggregateReviewPlan(
  results: ScanResult[],
  sessionId: string,
  libraryDb?: LibraryDb,
  sourceDb?: string,
): ScanReviewPlan {
  const groups = new Map<string, ScanAnimeGroup>();
  let ambiguousCount = 0;

  for (const result of results) {
    if (result.status === "ambiguous") {
      ambiguousCount++;
    }

    const row = toFileRow(result);
    const matchedAnime = result.match?.anime;
    const animeId = matchedAnime?.id ?? `failed-${row.fileId}`;
    const animeTitle = matchedAnime?.titleEn ?? "Unresolved";
    const entryType = matchedAnime?.entryType ?? "tv";

    let group = groups.get(animeId);
    if (!group) {
      const mergeMode =
        libraryDb != null &&
        matchedAnime != null &&
        libraryDb.findAnime(animeId, sourceDb ?? "tvdb") != null;

      group = {
        animeId,
        animeTitle,
        entryType,
        image: matchedAnime?.image,
        files: [],
        swapPairs: [],
        mergeMode,
      };
      groups.set(animeId, group);
    }
    group.files.push(row);
  }

  const groupList = Array.from(groups.values());
  for (const group of groupList) {
    group.swapPairs = detectSwapsFromFileRows(group.files);
  }

  return {
    sessionId,
    groups: groupList,
    totalFiles: results.length,
    ambiguousCount,
  };
}
