import { randomUUID } from "node:crypto";
import type { AnimeGroup, FileRow, ReviewPlan, ScanFileStatus, SwapPair } from "./scan-types";
import type { ScanResult } from "./scanner";

function fileIdFromPath(_path: string): string {
  return randomUUID();
}

function detectSwaps(files: FileRow[]): SwapPair[] {
  const swaps: SwapPair[] = [];
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
  const status: ScanFileStatus =
    result.status === "matched" || result.status === "cached"
      ? result.plan
        ? "matched"
        : "cached"
      : (result.status as ScanFileStatus);

  return {
    fileId: fileIdFromPath(result.file),
    sourcePath: result.file,
    proposedPath: result.plan?.targetPath ?? null,
    status,
    animeId: result.match?.anime.id ?? null,
    episodeId: result.match?.episode?.id ?? null,
    episode: result.match?.episode?.episode ?? null,
    failureReason: result.failureReason,
  };
}

export function aggregateReviewPlan(results: ScanResult[], sessionId: string): ReviewPlan {
  const groups = new Map<string, AnimeGroup>();
  let ambiguousCount = 0;

  for (const result of results) {
    if (result.status === "ambiguous") {
      ambiguousCount++;
    }

    const row = toFileRow(result);
    const animeId = result.match?.anime.id ?? `failed-${row.fileId}`;
    const animeTitle = result.match?.anime.titleEn ?? "Unresolved";
    const entryType = result.match?.anime.entryType ?? "tv";

    let group = groups.get(animeId);
    if (!group) {
      group = {
        animeId,
        animeTitle,
        entryType,
        image: result.match?.anime.image,
        files: [],
        swapPairs: [],
      };
      groups.set(animeId, group);
    }
    group.files.push(row);
  }

  const groupList = Array.from(groups.values());
  for (const group of groupList) {
    group.swapPairs = detectSwaps(group.files);
  }

  return {
    sessionId,
    groups: groupList,
    totalFiles: results.length,
    ambiguousCount,
  };
}
