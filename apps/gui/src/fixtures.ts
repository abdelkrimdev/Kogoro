import type { FileRow, MatcherLike, ReviewGroup, ReviewPlan, ScanFileStatus } from "@kogoro/core";
import {
  HashCache,
  Matcher,
  OverrideStore,
  Renamer,
  SCHEMA_DEFAULTS,
  Scanner,
  ScanOrchestrator,
  TEMPLATE_PRESETS,
  walk,
} from "@kogoro/core";
import { createMatchCacheService, createMockDb } from "@kogoro/core/testing";
import type { EpisodeRow } from "./mainview/state/detail-state";
import type { LibraryItem, LibraryState } from "./mainview/state/library-state";
import type { ReviewState, StatusFilter } from "./mainview/state/review-state";
import type { ScanProgressEntry } from "./mainview/state/scan-progress-state";
import type { EnrichedFolder } from "./mainview/state/scan-state";
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
  };
}

export function makeFile(overrides: Partial<FileRow> = {}): FileRow {
  return {
    fileId: "f1",
    sourcePath: "/media/Steins;Gate/S01E01.mkv",
    proposedPath: "/library/Steins;Gate/TV/1x01 - Prologue.mkv",
    status: "matched",
    animeId: "a1",
    episodeId: "e1",
    season: 1,
    episode: 1,
    episodeName: "Prologue",
    ...overrides,
  };
}

export function makeGroup(overrides: Partial<ReviewGroup> = {}): ReviewGroup {
  return {
    animeId: overrides.animeId ?? "a1",
    animeTitle: overrides.animeTitle ?? "Steins;Gate",
    entryType: overrides.entryType ?? "tv",
    image: overrides.image,
    files: overrides.files ?? [makeFile()],
    swapPairs: overrides.swapPairs ?? [],
    mergeMode: overrides.mergeMode,
    rejected: overrides.rejected,
  };
}

export function makePlan(groups: ReviewGroup[] = []): ReviewPlan {
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
    episodeCount: overrides.episodeCount ?? 24,
    filesOnDisk: overrides.filesOnDisk ?? 24,
    coverArt: overrides.coverArt,
    libraryState: overrides.libraryState ?? "on_disk",
    groups: overrides.groups ?? [{ entryType: "tv", watchStatus: "completed" }],
    groupCount: overrides.groupCount ?? 1,
  };
}

export function makeLibraryState(overrides: Partial<LibraryState> = {}): LibraryState {
  return {
    items: overrides.items ?? [],
    search: overrides.search ?? "",
    viewMode: overrides.viewMode ?? "grid",
    sortField: overrides.sortField ?? "titleEn",
    sortAsc: overrides.sortAsc ?? true,
    libraryStateFilter: overrides.libraryStateFilter ?? "all",
    watchStatusFilter: overrides.watchStatusFilter ?? "all",
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

export function makeEnrichedFolder(overrides: Partial<EnrichedFolder> = {}): EnrichedFolder {
  return {
    path: overrides.path ?? "/anime/Show",
    basename: overrides.basename ?? "Show",
    addedAt: overrides.addedAt ?? "2026-01-01T00:00:00.000Z",
    lastScannedAt: overrides.lastScannedAt,
    exists: overrides.exists ?? true,
    status: overrides.status ?? "new",
    selected: overrides.selected ?? false,
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

export function createFailingDbPlugin() {
  return createMockDb({
    searchAnime: () => [],
    getEpisodes: () => [],
  });
}

export function createOrchestratorWithRealScan(
  dir: string,
  matcherOrDb?: MatcherLike | ReturnType<typeof createMockDb>,
) {
  let matcher: MatcherLike;
  if (
    matcherOrDb &&
    "match" in matcherOrDb &&
    typeof matcherOrDb.match === "function" &&
    "matchBatch" in matcherOrDb
  ) {
    matcher = matcherOrDb as MatcherLike;
  } else {
    matcher = new Matcher({
      database: (matcherOrDb as ReturnType<typeof createMockDb>) ?? createMockDb(),
    });
  }

  const overrideStore = new OverrideStore(dir);
  const renamer = new Renamer({
    filenameTemplate: `${TEMPLATE_PRESETS.standard}.{ext}`,
    directoryTemplate: SCHEMA_DEFAULTS.template.directory,
  });

  const { cacheService } = createMatchCacheService();
  const hashCache = new HashCache({ cacheService, overrideStore });
  const scanner = new Scanner({ hashCache, matcher, renamer, overrideStore });

  return new ScanOrchestrator({
    pipeline: {
      walk: async (path: string) => walk(path, SCHEMA_DEFAULTS["media-extensions"]),
      scanBatch: async (filePaths, options, ctx) =>
        scanner.scanBatch(filePaths, { force: options.force, dryRun: options.dryRun, ctx }),
    },
    matcher,
    renamer,
  });
}
