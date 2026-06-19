import type { LibraryService } from "../library/library-service";
import type { TrackerAnime, TrackerPlugin, TrackerWatchStatus } from "../types";

export type TrackerSource = "mal" | "anilist" | "kitsu";

export interface ImportPreviewEntry {
  trackerId: string;
  title: string;
  entryType: string;
  watchStatus: TrackerWatchStatus;
  episodesWatched: number;
  totalEpisodes: number;
  existingAnimeId?: number;
}

export interface ImportPreview {
  totalEntries: number;
  matched: ImportPreviewEntry[];
  unmatched: ImportPreviewEntry[];
  statusCounts: Record<TrackerWatchStatus, number>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

function mapTrackerStatus(
  status: TrackerWatchStatus,
): "watching" | "completed" | "plan_to_watch" | "on_hold" | "dropped" {
  switch (status) {
    case "plan-to-watch":
      return "plan_to_watch";
    case "on-hold":
      return "on_hold";
    default:
      return status;
  }
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
        existingAnimeId: existingAnime?.id,
      };

      if (existingAnime) {
        matched.push(previewEntry);
      } else {
        unmatched.push(previewEntry);
      }
    }

    return {
      totalEntries: trackerList.length,
      matched,
      unmatched,
      statusCounts,
    };
  }

  async confirmImport(): Promise<ImportResult> {
    const trackerList = await this.tracker.getUserList();

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

      const libraryAnime = this.library.listAnime();
      const existingAnime = this.findMatchingAnime(entry, libraryAnime);

      if (existingAnime) {
        this.importToExistingAnime(existingAnime, entry);
      } else {
        this.importAsNewAnime(entry);
      }

      imported++;
    }

    return { imported, skipped };
  }

  private findMatchingAnime(
    trackerEntry: TrackerAnime,
    libraryAnimeList: Array<{ id: number; title: string; titleJapanese?: string }>,
  ): { id: number; title: string } | null {
    const titleLower = trackerEntry.title.toLowerCase();
    const baseTitleLower = this.stripSeasonFromTitle(titleLower);

    for (const anime of libraryAnimeList) {
      const animeTitleLower = anime.title.toLowerCase();
      if (animeTitleLower === titleLower) {
        return anime;
      }
      if (this.stripSeasonFromTitle(animeTitleLower) === baseTitleLower) {
        return anime;
      }
    }

    if (trackerEntry.alternativeTitles) {
      for (const altTitle of trackerEntry.alternativeTitles) {
        const altLower = altTitle.toLowerCase();
        const altBaseLower = this.stripSeasonFromTitle(altLower);
        for (const anime of libraryAnimeList) {
          const animeTitleLower = anime.title.toLowerCase();
          if (animeTitleLower === altLower) {
            return anime;
          }
          if (this.stripSeasonFromTitle(animeTitleLower) === altBaseLower) {
            return anime;
          }
          if (anime.titleJapanese?.toLowerCase() === altLower) {
            return anime;
          }
        }
      }
    }

    return null;
  }

  private stripSeasonFromTitle(title: string): string {
    return title.replace(/\s+season\s+\d+/i, "").trim();
  }

  private importToExistingAnime(
    anime: { id: number; title: string },
    trackerEntry: TrackerAnime,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(anime.id);
    const seasonNumber = this.extractSeasonNumber(trackerEntry);

    let targetGroup = groups.find(
      (g) =>
        g.entryType === trackerEntry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
    );

    if (!targetGroup) {
      targetGroup = this.library.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: trackerEntry.entryType,
        seasonNumber,
        watchStatus: mapTrackerStatus(trackerEntry.watchStatus),
      });
    } else {
      this.library.setGroupWatchStatus(targetGroup.id, mapTrackerStatus(trackerEntry.watchStatus));
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
