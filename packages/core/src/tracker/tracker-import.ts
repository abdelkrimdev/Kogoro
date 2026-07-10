import type { LibraryService } from "../library/library-service";
import type { TrackerAnime, TrackerPlugin, TrackerWatchStatus } from "../types";
import { extractSeasonNumber, findMatchingAnime, mapTrackerStatus } from "./tracker-utils";

export type TrackerSource = "mal" | "anilist" | "kitsu";

export type MatchStatus = "matched" | "unmatched" | "conflict";

export interface ImportPreviewEntry {
  trackerId: string;
  title: string;
  entryType: string;
  watchStatus: TrackerWatchStatus;
  episodesWatched: number;
  totalEpisodes: number;
  matchStatus: MatchStatus;
  existingAnimeId?: number;
  existingGroupId?: number;
  localWatchStatus?: string;
}

export interface ImportPreview {
  totalEntries: number;
  matched: ImportPreviewEntry[];
  unmatched: ImportPreviewEntry[];
  conflicts: ImportPreviewEntry[];
  statusCounts: Record<TrackerWatchStatus, number>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export interface ImportSelection {
  trackerId: string;
  groupId?: number;
  resolution?: "keepLocal" | "acceptTracker";
}

export class TrackerImportService {
  constructor(
    private library: LibraryService,
    private tracker: TrackerPlugin,
    private source: TrackerSource,
  ) {}

  async getImportPreview(): Promise<ImportPreview> {
    const trackerList = await this.tracker.getUserList();
    const libraryAnime = this.library.listAnime();

    const matched: ImportPreviewEntry[] = [];
    const unmatched: ImportPreviewEntry[] = [];
    const conflicts: ImportPreviewEntry[] = [];
    const seenTrackerIds = new Set<string>();

    for (const entry of trackerList) {
      if (seenTrackerIds.has(entry.trackerId)) continue;
      seenTrackerIds.add(entry.trackerId);

      const existingMapping = this.library.findGroupByTrackerExternalId(
        this.source,
        entry.trackerId,
      );
      if (existingMapping) {
        continue;
      }

      const existingAnime = findMatchingAnime(entry, libraryAnime);

      const previewEntry: ImportPreviewEntry = {
        trackerId: entry.trackerId,
        title: entry.title,
        entryType: entry.entryType,
        watchStatus: entry.watchStatus,
        episodesWatched: entry.episodesWatched,
        totalEpisodes: entry.totalEpisodes,
        matchStatus: "unmatched",
        existingAnimeId: existingAnime?.id,
      };

      if (existingAnime) {
        const groups = this.library.getEpisodeGroupsByAnimeId(existingAnime.id);
        const seasonNumber = extractSeasonNumber(entry);
        const existingGroup = groups.find(
          (g) => g.entryType === entry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
        );

        if (existingGroup) {
          const localStatus = mapTrackerStatus(entry.watchStatus);
          if (existingGroup.watchStatus !== localStatus) {
            previewEntry.matchStatus = "conflict";
            previewEntry.existingGroupId = existingGroup.id;
            previewEntry.localWatchStatus = existingGroup.watchStatus;
            conflicts.push(previewEntry);
          } else {
            previewEntry.matchStatus = "matched";
            previewEntry.existingGroupId = existingGroup.id;
            matched.push(previewEntry);
          }
        } else {
          previewEntry.matchStatus = "matched";
          matched.push(previewEntry);
        }
      } else {
        unmatched.push(previewEntry);
      }
    }

    const statusCounts: Record<TrackerWatchStatus, number> = {
      watching: 0,
      completed: 0,
      "plan-to-watch": 0,
      "on-hold": 0,
      dropped: 0,
    };
    for (const entry of [...matched, ...unmatched, ...conflicts]) {
      statusCounts[entry.watchStatus]++;
    }

    return {
      totalEntries: matched.length + unmatched.length + conflicts.length,
      matched,
      unmatched,
      conflicts,
      statusCounts,
    };
  }

  async confirmImport(selections?: ImportSelection[]): Promise<ImportResult> {
    const trackerList = await this.tracker.getUserList();
    const selectionMap = new Map<string, ImportSelection>();
    if (selections) {
      for (const selection of selections) {
        selectionMap.set(selection.trackerId, selection);
      }
    }

    let imported = 0;
    let skipped = 0;

    for (const entry of trackerList) {
      const existingMapping = this.library.findGroupByTrackerExternalId(
        this.source,
        entry.trackerId,
      );
      if (existingMapping) {
        skipped++;
        continue;
      }

      const selection = selectionMap.get(entry.trackerId);

      let existingAnime: { id: number; title: string } | null = null;

      if (selection?.groupId) {
        const group = this.library.getEpisodeGroup(selection.groupId);
        if (group) {
          const anime = this.library.getAnime(group.animeId);
          if (anime) {
            existingAnime = anime;
          }
        }
      }

      if (!existingAnime) {
        const libraryAnime = this.library.listAnime();
        existingAnime = findMatchingAnime(entry, libraryAnime);
      }

      if (existingAnime) {
        this.importToExistingAnime(existingAnime, entry, selection);
      } else {
        this.importAsNewAnime(entry);
      }

      imported++;
    }

    return { imported, skipped };
  }

  private importToExistingAnime(
    anime: { id: number; title: string },
    trackerEntry: TrackerAnime,
    selection?: ImportSelection,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(anime.id);
    const seasonNumber = extractSeasonNumber(trackerEntry);

    let targetGroup = groups.find(
      (g) =>
        g.entryType === trackerEntry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
    );

    if (selection?.groupId) {
      const linkedGroup = this.library.getEpisodeGroup(selection.groupId);
      if (linkedGroup) {
        targetGroup = linkedGroup;
      }
    }

    if (!targetGroup) {
      targetGroup = this.library.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: trackerEntry.entryType,
        seasonNumber,
        watchStatus: mapTrackerStatus(trackerEntry.watchStatus),
      });
    } else {
      const resolution = selection?.resolution;
      if (resolution !== "keepLocal") {
        this.library.setGroupWatchStatus(
          targetGroup.id,
          mapTrackerStatus(trackerEntry.watchStatus),
        );
      }
    }

    this.library.upsertGroupTrackerMapping({
      groupId: targetGroup.id,
      source: this.source,
      externalId: trackerEntry.trackerId,
    });
  }

  private importAsNewAnime(trackerEntry: TrackerAnime): void {
    const anime = this.library.upsertAnime({
      externalId: `tracker-${trackerEntry.trackerId}`,
      sourceDb: this.source,
      title: trackerEntry.title,
      alternativeTitles: trackerEntry.alternativeTitles,
      episodeCount: trackerEntry.totalEpisodes,
    });

    const seasonNumber = extractSeasonNumber(trackerEntry);

    const group = this.library.upsertEpisodeGroup({
      animeId: anime.id,
      entryType: trackerEntry.entryType,
      seasonNumber,
      watchStatus: mapTrackerStatus(trackerEntry.watchStatus),
    });

    this.library.upsertGroupTrackerMapping({
      groupId: group.id,
      source: this.source,
      externalId: trackerEntry.trackerId,
    });
  }
}
