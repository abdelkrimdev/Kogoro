import { randomUUID } from "node:crypto";
import type { LibraryService } from "../library/library-service";
import type {
  AnimeResult,
  FileRow,
  AnimeGroup as ScanAnimeGroup,
  ScanFileStatus,
  ReviewPlan as ScanReviewPlan,
  SwapPair as ScanSwapPair,
  TopCandidate,
} from "../types";
import type { ScanResult } from "./scanner";

export type { TopCandidate };

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

    const title = result.match.anime.titleEn;
    if (!title) continue;

    const existing = groups.get(title);
    if (existing) {
      existing.push(result);
    } else {
      groups.set(title, [result]);
    }
  }

  return groups;
}

function lowestNumericId(ids: string[]): string {
  return ids.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))[0] ?? "";
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
  libraryService?: LibraryService,
  sourceDb?: string,
): ReviewPlan {
  const byTitle = groupByAnime(results);
  const allSwaps = detectSwapsFromGroups(byTitle);

  const titleToCanonicalId = new Map<string, string>();
  for (const [title, scanResults] of byTitle) {
    const ids = scanResults
      .map((r) => r.match?.anime.id)
      .filter((id): id is string => id !== undefined);
    titleToCanonicalId.set(title, lowestNumericId(ids));
  }

  const fileToCanonicalId = new Map<string, string>();
  for (const [title, scanResults] of byTitle) {
    const cid = titleToCanonicalId.get(title) ?? "";
    for (const sr of scanResults) {
      fileToCanonicalId.set(sr.file, cid);
    }
  }

  const swapsByCanonicalId = new Map<string, SwapPair[]>();
  for (const swap of allSwaps) {
    const firstFile = swap.files[0];
    if (!firstFile) continue;
    const cid = fileToCanonicalId.get(firstFile);
    if (!cid) continue;
    const existing = swapsByCanonicalId.get(cid);
    if (existing) {
      existing.push(swap);
    } else {
      swapsByCanonicalId.set(cid, [swap]);
    }
  }

  const groups: AnimeGroup[] = [];

  for (const [title, scanResults] of byTitle) {
    const firstMatch = scanResults[0]?.match;
    if (!firstMatch) continue;

    const anime = firstMatch.anime;
    const cid = titleToCanonicalId.get(title) ?? "";
    const swaps = swapsByCanonicalId.get(cid) ?? [];

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

    const mergeMode =
      libraryService != null &&
      (libraryService.findAnimeByTitle(title, sourceDb ?? "tvdb") !== null ||
        libraryService.isAnimeInLibrary(cid, sourceDb));

    groups.push({
      animeId: cid,
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
    episodeName: result.match?.episode?.titleEn ?? null,
    failureReason: result.failureReason,
  };
}

export async function aggregateReviewPlan(
  results: ScanResult[],
  sessionId: string,
  libraryService?: LibraryService,
  sourceDb?: string,
  computeTopCandidates?: (sourcePath: string) => Promise<TopCandidate[]>,
): Promise<ScanReviewPlan> {
  const groupsByTitle = new Map<string, { group: ScanAnimeGroup; animeIds: string[] }>();
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

    let entry = groupsByTitle.get(animeTitle);
    if (!entry) {
      entry = {
        group: {
          animeId: "",
          animeTitle,
          entryType,
          image: matchedAnime?.image,
          files: [],
          swapPairs: [],
          mergeMode: false,
        },
        animeIds: [],
      };
      groupsByTitle.set(animeTitle, entry);
    }
    if (matchedAnime) {
      entry.animeIds.push(animeId);
    }
    entry.group.files.push(row);
  }

  const groupList: ScanAnimeGroup[] = [];
  for (const [, { group, animeIds }] of groupsByTitle) {
    group.animeId = lowestNumericId(animeIds);

    if (libraryService && group.animeId) {
      group.mergeMode =
        libraryService.findAnimeByTitle(group.animeTitle, sourceDb ?? "tvdb") !== null ||
        libraryService.isAnimeInLibrary(group.animeId, sourceDb);
    }

    group.swapPairs = detectSwapsFromFileRows(group.files);
    groupList.push(group);
  }

  if (computeTopCandidates) {
    for (const group of groupList) {
      for (const file of group.files) {
        if (file.status === "ambiguous") {
          file.topCandidates = await computeTopCandidates(file.sourcePath);
        }
      }
    }
  }

  return {
    sessionId,
    groups: groupList,
    totalFiles: results.length,
    ambiguousCount,
  };
}
