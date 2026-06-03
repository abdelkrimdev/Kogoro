import type { AnimeGroup, FileRow, ReviewPlan, ScanFileStatus } from "@kogoro/core";
import type { EpisodeRow } from "./mainview/state/detail-state";
import type { LibraryItem, LibraryState } from "./mainview/state/library-state";
import type { ReviewState, StatusFilter } from "./mainview/state/review-state";
import type { ScanProgressEntry } from "./mainview/state/scan-progress-state";
import type { WatchStatusEntry } from "./mainview/state/watch-state";

export function makeEpisode(overrides: Partial<EpisodeRow> = {}): EpisodeRow {
  return {
    id: overrides.id ?? "e1",
    season: overrides.season ?? 1,
    episode: overrides.episode ?? 1,
    titleEn: overrides.titleEn ?? "Episode 1",
    filePath: overrides.filePath ?? "/library/Steins;Gate/TV/1x01 - Prologue.mkv",
    missing: overrides.missing ?? false,
  };
}

export function makeWatchStatus(overrides: Partial<WatchStatusEntry> = {}): WatchStatusEntry {
  return {
    episodeId: overrides.episodeId ?? "e1",
    watched: overrides.watched ?? true,
    notes: overrides.notes,
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
  };
}

export function makeFile(overrides: Partial<FileRow> = {}): FileRow {
  return {
    fileId: overrides.fileId ?? "f1",
    sourcePath: overrides.sourcePath ?? "/media/Steins;Gate/S01E01.mkv",
    proposedPath: overrides.proposedPath ?? "/library/Steins;Gate/TV/1x01 - Prologue.mkv",
    status: overrides.status ?? "matched",
    animeId: overrides.animeId ?? "a1",
    episodeId: overrides.episodeId ?? "e1",
    episode: overrides.episode ?? 1,
  };
}

export function makeGroup(overrides: Partial<AnimeGroup> = {}): AnimeGroup {
  return {
    animeId: overrides.animeId ?? "a1",
    animeTitle: overrides.animeTitle ?? "Steins;Gate",
    entryType: overrides.entryType ?? "tv",
    image: overrides.image,
    files: overrides.files ?? [makeFile()],
    swapPairs: overrides.swapPairs ?? [],
    mergeMode: overrides.mergeMode,
  };
}

export function makePlan(groups: AnimeGroup[] = []): ReviewPlan {
  return {
    sessionId: "s1",
    groups,
    totalFiles: groups.reduce((sum, g) => sum + g.files.length, 0),
    ambiguousCount: groups.reduce(
      (sum, g) => sum + g.files.filter((f) => f.status === "ambiguous").length,
      0,
    ),
  };
}

export function makeReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    plan: overrides.plan ?? makePlan(),
    searchQuery: overrides.searchQuery ?? "",
    statusFilter: overrides.statusFilter ?? ("all" as StatusFilter),
  };
}

export function makeLibraryItem(overrides: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id: overrides.id ?? "1",
    titleEn: overrides.titleEn ?? "Steins;Gate",
    entryType: overrides.entryType ?? "tv",
    episodeCount: overrides.episodeCount ?? 24,
    filesOnDisk: overrides.filesOnDisk ?? 24,
    coverArt: overrides.coverArt,
  };
}

export function makeLibraryState(overrides: Partial<LibraryState> = {}): LibraryState {
  return {
    items: overrides.items ?? [],
    search: overrides.search ?? "",
    typeFilter: overrides.typeFilter ?? [],
    viewMode: overrides.viewMode ?? "grid",
    sortField: overrides.sortField ?? "titleEn",
    sortAsc: overrides.sortAsc ?? true,
  };
}

export function makeScanProgressEntry(
  overrides: { file?: string; status?: ScanFileStatus; completed?: number; total?: number } = {},
): ScanProgressEntry & { completed: number; total: number } {
  return {
    file: overrides.file ?? "/media/Steins;Gate/S01E01.mkv",
    status: overrides.status ?? "matched",
    completed: overrides.completed ?? 0,
    total: overrides.total ?? 0,
  };
}

export function createMockRPC(responses: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; params: unknown }> = [];
  return {
    calls,
    request: async (method: string, params: unknown) => {
      calls.push({ method, params });
      return responses[method] ?? null;
    },
  };
}
