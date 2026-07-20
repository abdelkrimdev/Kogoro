import { randomUUID } from "node:crypto";
import type { AnimeAggregate } from "../library/anime-aggregate";
import type {
  AnimeResult,
  FileRow,
  ReviewGroup,
  ReviewPlan,
  ScanFileStatus,
  SwapPair,
  TopCandidate,
} from "../types";
import type { ScanResult } from "./scanner";
import {
  detectSwaps as detectSwapsCore,
  extractEpisodeFromPath,
  extractSeasonFromPath,
  type SwapInputEntry,
} from "./swap-detection";

export function buildCanonicalIdMap(plan: ReviewPlan): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of plan.groups) {
    for (const file of group.files) {
      if (file.animeId && file.animeId !== group.animeId) {
        map.set(file.animeId, group.animeId);
      }
    }
  }
  return map;
}

export interface ScanSwapPair {
  files: [string, string];
  episodeA: number;
  episodeB: number;
  seasonA: number;
  seasonB: number;
}

export interface ScanGroupEntry {
  scanResult: ScanResult;
  swapDetected?: ScanSwapPair;
}

export interface ScanGroup {
  animeId: string;
  anime: AnimeResult;
  entries: ScanGroupEntry[];
  swapPairs: ScanSwapPair[];
  mergeMode: boolean;
}

export interface ScanReviewPlan {
  groups: ScanGroup[];
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
  return [...ids].sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))[0] ?? "";
}

export function detectSwaps(
  results: ScanResult[],
  preGrouped?: Map<string, ScanResult[]>,
): ScanSwapPair[] {
  const byAnime = preGrouped ?? groupByAnime(results);
  const swaps: ScanSwapPair[] = [];

  for (const [, group] of byAnime) {
    const entries: SwapInputEntry[] = [];
    for (const r of group) {
      if (!r.match?.episode || r.parsed.episode === null) continue;

      const matchEp = r.match.episode;
      const proposedEpisode = r.plan?.targetPath
        ? extractEpisodeFromPath(r.plan.targetPath)
        : matchEp.episode;
      const proposedSeason = r.plan?.targetPath
        ? extractSeasonFromPath(r.plan.targetPath)
        : matchEp.season;

      entries.push({
        fileId: r.file,
        filePath: r.file,
        animeId: r.match.anime.id,
        season: r.parsed.season ?? matchEp.season,
        episode: r.parsed.episode,
        proposedEpisode,
        proposedSeason,
      });
    }

    const results = detectSwapsCore(entries);
    for (const r of results) {
      swaps.push({
        files: [r.filePathA, r.filePathB],
        episodeA: r.episodeA,
        episodeB: r.episodeB,
        seasonA: r.seasonA,
        seasonB: r.seasonB,
      });
    }
  }

  return swaps;
}

export function buildReviewPlan(
  results: ScanResult[],
  animeAggregate?: AnimeAggregate,
  sourceDb?: string,
): ScanReviewPlan {
  const byTitle = groupByAnime(results);
  const allSwaps = detectSwaps(results, byTitle);

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

  const swapsByCanonicalId = new Map<string, ScanSwapPair[]>();
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

  const groups: ScanGroup[] = [];

  for (const [title, scanResults] of byTitle) {
    const firstMatch = scanResults[0]?.match;
    if (!firstMatch) continue;

    const anime = firstMatch.anime;
    const cid = titleToCanonicalId.get(title) ?? "";
    const swaps = swapsByCanonicalId.get(cid) ?? [];

    const entries: ScanGroupEntry[] = scanResults
      .map((sr) => {
        const entry: ScanGroupEntry = { scanResult: sr };
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
      animeAggregate != null &&
      (animeAggregate.animeExistsByTitle(title, sourceDb ?? "tvdb") ||
        animeAggregate.animeExists(cid, sourceDb));

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

function toSwapInputFromRow(row: FileRow): SwapInputEntry | null {
  if (!row.animeId || row.episode === null) return null;

  const proposedEpisode = extractEpisodeFromPath(row.proposedPath);
  if (proposedEpisode === null) return null;

  const proposedSeason = extractSeasonFromPath(row.proposedPath);

  return {
    fileId: row.fileId,
    filePath: row.sourcePath,
    animeId: row.animeId,
    season: row.season ?? 1,
    episode: row.episode,
    proposedEpisode,
    proposedSeason,
  };
}

function detectSwapsFromRows(files: FileRow[]): SwapPair[] {
  const entries = files.map(toSwapInputFromRow).filter((e): e is SwapInputEntry => e !== null);
  const results = detectSwapsCore(entries);
  return results.map((r) => ({ fileAId: r.fileAId, fileBId: r.fileBId }));
}

function toFileRow(result: ScanResult, fileId: string): FileRow {
  let status: ScanFileStatus;
  if (result.status === "matched" || result.status === "cached") {
    status = result.plan ? "matched" : "cached";
  } else {
    status = result.status as ScanFileStatus;
  }

  return {
    fileId,
    sourcePath: result.file,
    proposedPath: result.plan?.targetPath ?? null,
    status,
    animeId: result.match?.anime.id ?? null,
    episodeId: result.match?.episode?.id ?? null,
    season: result.match?.episode?.season ?? null,
    episode: result.match?.episode?.episode ?? null,
    episodeName: result.match?.episode?.titleEn ?? null,
    failureReason: result.failureReason,
  };
}

export async function aggregateReviewPlan(
  results: ScanResult[],
  sessionId: string,
  animeAggregate?: AnimeAggregate,
  sourceDb?: string,
  computeTopCandidates?: (sourcePath: string) => Promise<TopCandidate[]>,
): Promise<ReviewPlan> {
  const groupsByTitle = new Map<string, { group: ReviewGroup; animeIds: string[] }>();
  let ambiguousCount = 0;

  for (const result of results) {
    if (result.status === "ambiguous") {
      ambiguousCount++;
    }

    const row = toFileRow(result, randomUUID());
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

  const groupList: ReviewGroup[] = [];
  for (const [, { group, animeIds }] of groupsByTitle) {
    group.animeId = lowestNumericId(animeIds);

    if (animeAggregate && group.animeId) {
      group.mergeMode =
        animeAggregate.animeExistsByTitle(group.animeTitle, sourceDb ?? "tvdb") ||
        animeAggregate.animeExists(group.animeId, sourceDb);
    }

    group.files.sort((a, b) => {
      const aSeason = a.season ?? 0;
      const bSeason = b.season ?? 0;
      if (aSeason !== bSeason) return aSeason - bSeason;
      return (a.episode ?? 0) - (b.episode ?? 0);
    });
    group.swapPairs = detectSwapsFromRows(group.files);
    groupList.push(group);
  }

  groupList.sort((a, b) => a.animeTitle.localeCompare(b.animeTitle));

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
