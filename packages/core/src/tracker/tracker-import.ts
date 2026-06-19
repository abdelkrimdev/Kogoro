import type { LibraryService } from "../library/library-service";
import type { TrackerAnime, TrackerPlugin, TrackerWatchStatus } from "../types";
import { mapTrackerStatus } from "./tracker-utils";

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
  private linkedEntries = new Map<string, number>();
  private conflictResolutions = new Map<string, "keepLocal" | "acceptTracker">();

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

    const statusCounts: Record<TrackerWatchStatus, number> = {
      watching: 0,
      completed: 0,
      "plan-to-watch": 0,
      "on-hold": 0,
      dropped: 0,
    };

    for (const entry of trackerList) {
      statusCounts[entry.watchStatus]++;

      const existingAnime = this.findMatchingAnime(entry, libraryAnime);

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
        const seasonNumber = this.extractSeasonNumber(entry);
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

    return {
      totalEntries: trackerList.length,
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

    for (const [trackerId, groupId] of this.linkedEntries) {
      if (!selectionMap.has(trackerId)) {
        selectionMap.set(trackerId, { trackerId, groupId });
      }
    }

    for (const [trackerId, resolution] of this.conflictResolutions) {
      const existing = selectionMap.get(trackerId);
      if (existing) {
        existing.resolution = resolution;
      } else {
        selectionMap.set(trackerId, { trackerId, resolution });
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
        existingAnime = this.findMatchingAnime(entry, libraryAnime);
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

  linkEntry(trackerId: string, groupId: number): void {
    this.linkedEntries.set(trackerId, groupId);
  }

  resolveConflict(trackerId: string, resolution: "keepLocal" | "acceptTracker"): void {
    this.conflictResolutions.set(trackerId, resolution);
  }

  private findMatchingAnime(
    trackerEntry: TrackerAnime,
    libraryAnimeList: Array<{ id: number; title: string; titleJapanese?: string }>,
  ): { id: number; title: string } | null {
    const titleLower = trackerEntry.title.toLowerCase();
    const baseTitleLower = this.stripSeasonFromTitle(titleLower);

    for (const anime of libraryAnimeList) {
      if (this.titlesMatch(anime, titleLower, baseTitleLower)) {
        return anime;
      }
    }

    if (trackerEntry.alternativeTitles) {
      for (const altTitle of trackerEntry.alternativeTitles) {
        const altLower = altTitle.toLowerCase();
        const altBaseLower = this.stripSeasonFromTitle(altLower);
        for (const anime of libraryAnimeList) {
          if (this.titlesMatch(anime, altLower, altBaseLower, true)) {
            return anime;
          }
        }
      }
    }

    return null;
  }

  private titlesMatch(
    anime: { title: string; titleJapanese?: string },
    targetLower: string,
    targetBaseLower: string,
    checkJapanese = false,
  ): boolean {
    const animeTitleLower = anime.title.toLowerCase();
    if (animeTitleLower === targetLower) {
      return true;
    }
    if (this.stripSeasonFromTitle(animeTitleLower) === targetBaseLower) {
      return true;
    }
    if (checkJapanese && anime.titleJapanese?.toLowerCase() === targetLower) {
      return true;
    }
    return false;
  }

  private stripSeasonFromTitle(title: string): string {
    return title.replace(/\s+season\s+\d+/i, "").trim();
  }

  private importToExistingAnime(
    anime: { id: number; title: string },
    trackerEntry: TrackerAnime,
    selection?: ImportSelection,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(anime.id);
    const seasonNumber = this.extractSeasonNumber(trackerEntry);

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
      const resolution = this.conflictResolutions.get(trackerEntry.trackerId);
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
      episodeCount: trackerEntry.totalEpisodes,
    });

    const seasonNumber = this.extractSeasonNumber(trackerEntry);

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

  private extractSeasonNumber(trackerEntry: TrackerAnime): number | undefined {
    const title = trackerEntry.title.toLowerCase();
    const seasonMatch = title.match(/season\s+(\d+)/);
    if (seasonMatch?.[1]) {
      return Number.parseInt(seasonMatch[1], 10);
    }
    return undefined;
  }
}
