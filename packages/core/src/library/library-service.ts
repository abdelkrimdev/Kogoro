import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { stripTypeDir } from "../config/schema";
import type { EventRepository } from "../events/event-repository";
import type { TrackerSource } from "../tracker/tracker-import";
import { mapTrackerStatus } from "../tracker/tracker-utils";
import type { EntryType, MatchEntry, TrackerAnime, TrackerPlugin } from "../types";
import type {
  EpisodeGroup,
  GroupTrackerMapping,
  LibraryAnime,
  LibraryEpisode,
  LibraryRepository,
} from "./library-repository";
import { computeLibraryState, type GroupFilesOnDisk } from "./library-state";

function groupCompositeKey(
  animeExternalId: string,
  sourceDb: string,
  entryType: string,
  seasonNumber: number | undefined,
): string {
  return `${animeExternalId}:${sourceDb}:${entryType}:${seasonNumber ?? "null"}`;
}

export class LibraryService {
  constructor(
    private library: LibraryRepository,
    private events: EventRepository,
  ) {}

  listAnime(): LibraryAnime[] {
    return this.library.listAnime();
  }

  getAnime(id: number): LibraryAnime | null {
    return this.library.getAnime(id);
  }

  findAnime(externalId: string, sourceDb: string): LibraryAnime | null {
    return this.library.findAnime(externalId, sourceDb);
  }

  findAnimeByTitle(title: string, sourceDb: string): LibraryAnime | null {
    return this.library.findAnimeByTitle(title, sourceDb);
  }

  getEpisodesByAnimeId(animeId: number): LibraryEpisode[] {
    return this.library.getEpisodesByAnimeId(animeId);
  }

  getStats(): { animeCount: number; episodeCount: number } {
    return this.library.getStats();
  }

  upsertAnime(data: Omit<LibraryAnime, "id" | "lastSynced">): LibraryAnime {
    return this.library.upsertAnime(data);
  }

  getAnimeDir(animeId: number): string | null {
    const episodes = this.library.getEpisodesByAnimeId(animeId);
    if (episodes.length === 0) return null;
    const paths = episodes.map((ep) => ep.filePath);
    const first = paths[0];
    if (!first) return null;
    if (paths.length === 1) return dirname(first);
    let commonParent = dirname(first);
    for (let i = 1; i < paths.length; i++) {
      const path = paths[i];
      if (!path) continue;
      while (commonParent && !path.startsWith(commonParent)) {
        commonParent = dirname(commonParent);
      }
    }
    if (commonParent) {
      commonParent = stripTypeDir(commonParent);
    }
    return commonParent;
  }

  updateCoverArtPath(animeId: number, coverArtPath: string): void {
    const existing = this.library.getAnime(animeId);
    if (!existing) return;
    this.library.upsertAnime({
      externalId: existing.externalId,
      sourceDb: existing.sourceDb,
      title: existing.title,
      titleJapanese: existing.titleJapanese,
      episodeCount: existing.episodeCount,
      coverArtPath,
      genres: existing.genres,
      libraryState: existing.libraryState,
    });
  }

  isAnimeInLibrary(externalId: string, sourceDb = "tvdb"): boolean {
    return this.library.findAnime(externalId, sourceDb) !== null;
  }

  exportMatches(): MatchEntry[] {
    return this.library.exportMatches().map((row) => ({
      animeId: row.animeId,
      animeTitle: row.animeTitle,
      entryType: row.entryType,
      episodeId: null,
      episode: row.episode,
      season: row.season,
      title: row.episodeTitle,
      filePath: row.filePath,
      sourceDb: row.sourceDb,
    }));
  }

  rebuild(sourceDb?: string): void {
    this.rebuildFromMatches(this.getFilteredMatches(sourceDb));
  }

  async rebuildWithTrackers(
    trackers: Array<{ plugin: TrackerPlugin; source: TrackerSource }>,
    sourceDb?: string,
  ): Promise<void> {
    const matches = this.getFilteredMatches(sourceDb);

    let oldEntitySnapshot:
      | {
          groupByCompositeKey: Map<string, number>;
          episodeByCompositeKey: Map<string, number>;
        }
      | undefined;

    this.rebuildFromMatches(matches, (snapshot) => {
      oldEntitySnapshot = snapshot;
    });

    for (const { plugin, source } of trackers) {
      await this.importFromTracker(plugin, source);
    }

    if (oldEntitySnapshot) {
      this.replayUnpushedEvents(oldEntitySnapshot);
    }
  }

  private getFilteredMatches(sourceDb?: string): MatchEntry[] {
    const allMatches = this.exportMatches();
    const filtered = sourceDb ? allMatches.filter((m) => m.sourceDb === sourceDb) : allMatches;
    return filtered.filter((m) => existsSync(m.filePath));
  }

  rebuildFromMatches(
    matches: MatchEntry[],
    onBeforeWipe?: (snapshot: {
      groupByCompositeKey: Map<string, number>;
      episodeByCompositeKey: Map<string, number>;
    }) => void,
  ): void {
    this.library.transaction((tx) => {
      const oldState = tx.getAllEpisodesWithAnime();

      const oldEpisodeKey = new Map<string, number>();
      for (const row of oldState) {
        const key = `${row.animeExternalId}:${row.animeSourceDb}:${row.season ?? 1}:${row.episodeNumber}`;
        oldEpisodeKey.set(key, row.episodeId);
      }

      const oldWatched = new Map<number, boolean>();
      for (const row of oldState) {
        oldWatched.set(row.episodeId, row.watched);
      }

      const oldGroups = tx.getAllEpisodeGroups();
      const oldAnimeById = new Map<number, { externalId: string; sourceDb: string }>();
      for (const a of tx.listAnime()) {
        oldAnimeById.set(a.id, { externalId: a.externalId, sourceDb: a.sourceDb });
      }

      const oldGroupById = new Map<number, EpisodeGroup>();
      const groupStateByKey = new Map<
        string,
        {
          watchStatus: EpisodeGroup["watchStatus"];
          synopsis?: string;
          rating?: number;
          coverArtPath?: string;
        }
      >();
      const groupByCompositeKey = new Map<string, number>();
      for (const group of oldGroups) {
        oldGroupById.set(group.id, group);
        const animeInfo = oldAnimeById.get(group.animeId);
        if (!animeInfo) continue;
        const key = groupCompositeKey(
          animeInfo.externalId,
          animeInfo.sourceDb,
          group.entryType,
          group.seasonNumber,
        );
        groupStateByKey.set(key, {
          watchStatus: group.watchStatus,
          synopsis: group.synopsis,
          rating: group.rating,
          coverArtPath: group.coverArtPath,
        });
        groupByCompositeKey.set(key, group.id);
      }

      const mappingsByKey = new Map<string, GroupTrackerMapping[]>();
      for (const mapping of tx.getAllTrackerMappings()) {
        const group = oldGroupById.get(mapping.groupId);
        if (!group) continue;
        const animeInfo = oldAnimeById.get(group.animeId);
        if (!animeInfo) continue;
        const key = groupCompositeKey(
          animeInfo.externalId,
          animeInfo.sourceDb,
          group.entryType,
          group.seasonNumber,
        );
        const entry = mappingsByKey.get(key);
        const mapped: GroupTrackerMapping = {
          groupId: 0,
          source: mapping.source,
          externalId: mapping.externalId,
        };
        if (entry) {
          entry.push(mapped);
        } else {
          mappingsByKey.set(key, [mapped]);
        }
      }

      if (onBeforeWipe) {
        onBeforeWipe({ groupByCompositeKey, episodeByCompositeKey: oldEpisodeKey });
      }

      tx.deleteAll();

      const now = new Date().toISOString();
      const animeIds = new Set<number>();

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      for (const match of matches) {
        const libraryAnime = tx.upsertAnime({
          externalId: match.animeId,
          sourceDb: match.sourceDb,
          title: match.animeTitle,
          episodeCount: 0,
          lastSynced: now,
        });
        const animeId = libraryAnime.id;

        animeIds.add(animeId);

        if (match.episode !== null && match.filePath) {
          const seasonNum = match.season ?? 1;
          const groupKey = `${animeId}:${match.entryType}:${seasonNum}`;

          let groupEntry = groupKeyToGroup.get(groupKey);
          if (!groupEntry) {
            const compositeKey = groupCompositeKey(
              match.animeId,
              match.sourceDb,
              match.entryType,
              match.season ?? 1,
            );
            const savedState = groupStateByKey.get(compositeKey);

            const group = tx.upsertEpisodeGroup({
              animeId,
              entryType: match.entryType as EntryType,
              seasonNumber: seasonNum,
              watchStatus: savedState?.watchStatus ?? "plan_to_watch",
              synopsis: savedState?.synopsis,
              rating: savedState?.rating,
              coverArtPath: savedState?.coverArtPath,
              lastSynced: now,
            });
            groupEntry = { animeId, groupId: group.id };
            groupKeyToGroup.set(groupKey, groupEntry);

            const savedMappings = mappingsByKey.get(compositeKey);
            if (savedMappings) {
              for (const mapping of savedMappings) {
                tx.upsertGroupTrackerMapping({
                  groupId: group.id,
                  source: mapping.source,
                  externalId: mapping.externalId,
                });
              }
            }
          }

          const epResult = tx.upsertEpisodeFromMatch({
            animeId,
            groupId: groupEntry.groupId,
            episode: match.episode,
            filePath: match.filePath,
            title: match.title,
            season: match.season,
          });

          const oldKey = `${match.animeId}:${match.sourceDb}:${match.season ?? 1}:${match.episode}`;
          const oldEpId = oldEpisodeKey.get(oldKey);
          if (oldEpId !== undefined) {
            const oldWatchedValue = oldWatched.get(oldEpId);
            if (oldWatchedValue !== undefined) {
              tx.migrateEpisodeWatched(epResult.id, oldWatchedValue);
            }
          }
        }
      }

      for (const id of animeIds) {
        tx.updateEpisodeCount(id);
      }

      for (const id of animeIds) {
        this.computeAndPersistLibraryState(id, tx);
      }
    });
  }

  mergeFromMatches(matches: MatchEntry[]): void {
    const grouped = new Map<string, MatchEntry[]>();
    for (const match of matches) {
      const key = `${match.animeTitle}\0${match.sourceDb}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.push(match);
      } else {
        grouped.set(key, [match]);
      }
    }

    this.library.transaction((tx) => {
      const newFilePaths = new Set<string>();
      const sourceDbs = new Set<string>();
      for (const match of matches) {
        if (match.filePath) {
          newFilePaths.add(match.filePath);
        }
        sourceDbs.add(match.sourceDb);
      }

      if (newFilePaths.size > 0) {
        const excludeSourceDb = sourceDbs.size === 1 ? sourceDbs.values().next().value : undefined;
        this.deleteStaleEpisodes(tx, newFilePaths, excludeSourceDb);
      }

      this.deleteAnimeFromOtherSourceDbs(tx, sourceDbs);

      const groupKeyToGroup = new Map<string, { animeId: number; groupId: number }>();

      const affectedAnimeIds = new Set<number>();

      for (const [, group] of grouped) {
        const first = group[0];
        if (!first) continue;

        const canonicalId =
          group
            .map((m) => m.animeId)
            .sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10))[0] ?? first.animeId;

        let libraryAnime =
          tx.findAnimeByTitle(first.animeTitle, first.sourceDb) ??
          tx.findAnime(canonicalId, first.sourceDb);
        if (libraryAnime) {
          if (Number.parseInt(canonicalId, 10) < Number.parseInt(libraryAnime.externalId, 10)) {
            libraryAnime = tx.upsertAnime({
              externalId: canonicalId,
              sourceDb: first.sourceDb,
              title: first.animeTitle,
              episodeCount: 0,
            });
          }
        } else {
          libraryAnime = tx.upsertAnime({
            externalId: canonicalId,
            sourceDb: first.sourceDb,
            title: first.animeTitle,
            episodeCount: 0,
          });
        }

        affectedAnimeIds.add(libraryAnime.id);

        for (const match of group) {
          if (match.episode !== null && match.filePath) {
            const seasonNum = match.season ?? 1;
            const groupKey = `${libraryAnime.id}:${match.entryType}:${seasonNum}`;

            let groupEntry = groupKeyToGroup.get(groupKey);
            if (!groupEntry) {
              const existingGroup = tx.findEpisodeGroup(
                libraryAnime.id,
                match.entryType,
                seasonNum,
              );
              const group = existingGroup
                ? tx.upsertEpisodeGroup({
                    animeId: libraryAnime.id,
                    entryType: match.entryType as EntryType,
                    seasonNumber: seasonNum,
                    watchStatus: existingGroup.watchStatus,
                    lastSynced: new Date().toISOString(),
                  })
                : tx.upsertEpisodeGroup({
                    animeId: libraryAnime.id,
                    entryType: match.entryType as EntryType,
                    seasonNumber: seasonNum,
                    watchStatus: "plan_to_watch",
                  });
              groupEntry = { animeId: libraryAnime.id, groupId: group.id };
              groupKeyToGroup.set(groupKey, groupEntry);
            }

            tx.upsertEpisodeFromMatch({
              animeId: libraryAnime.id,
              groupId: groupEntry.groupId,
              episode: match.episode,
              filePath: match.filePath,
              title: match.title,
              season: match.season,
            });
          }
        }

        tx.updateEpisodeCount(libraryAnime.id);
      }

      for (const id of affectedAnimeIds) {
        this.computeAndPersistLibraryState(id, tx);
      }
    });
  }

  // Episode Groups

  getEpisodeGroupsByAnimeId(animeId: number): EpisodeGroup[] {
    return this.library.getEpisodeGroupsByAnimeId(animeId);
  }

  getEpisodeGroup(id: number): EpisodeGroup | null {
    return this.library.getEpisodeGroup(id);
  }

  upsertEpisodeGroup(data: Omit<EpisodeGroup, "id" | "lastSynced">): EpisodeGroup {
    return this.library.upsertEpisodeGroup(data);
  }

  setGroupWatchStatus(groupId: number, status: EpisodeGroup["watchStatus"]): EpisodeGroup | null {
    const oldGroup = this.library.getEpisodeGroup(groupId);
    const result = this.library.updateEpisodeGroupStatus(groupId, status);
    if (result && oldGroup && oldGroup.watchStatus !== status) {
      this.events.append({
        entityType: "group",
        entityId: groupId,
        eventType: "status_change",
        oldValue: oldGroup.watchStatus,
        newValue: status,
      });
    }
    return result;
  }

  updateEpisodeGroupMetadata(
    groupId: number,
    metadata: { synopsis?: string; rating?: number; coverArtPath?: string },
  ): EpisodeGroup | null {
    const oldGroup = this.library.getEpisodeGroup(groupId);
    const result = this.library.updateEpisodeGroupMetadata(groupId, metadata);
    if (result && oldGroup) {
      if (metadata.synopsis !== undefined && metadata.synopsis !== oldGroup.synopsis) {
        this.events.append({
          entityType: "group",
          entityId: groupId,
          eventType: "notes_update",
          oldValue: oldGroup.synopsis ?? null,
          newValue: metadata.synopsis,
        });
      }
      if (metadata.rating !== undefined && metadata.rating !== oldGroup.rating) {
        this.events.append({
          entityType: "group",
          entityId: groupId,
          eventType: "notes_update",
          oldValue: oldGroup.rating != null ? String(oldGroup.rating) : null,
          newValue: String(metadata.rating),
        });
      }
    }
    return result;
  }

  deleteEpisodeGroup(groupId: number): void {
    this.library.deleteEpisodeGroup(groupId);
  }

  getEpisodesByGroupId(groupId: number): LibraryEpisode[] {
    return this.library.getEpisodesByGroupId(groupId);
  }

  getAllEpisodeGroups(): EpisodeGroup[] {
    return this.library.getAllEpisodeGroups();
  }

  getAllTrackerMappings(): GroupTrackerMapping[] {
    return this.library.getAllTrackerMappings();
  }

  private computeAndPersistLibraryState(animeId: number, repo?: LibraryRepository): void {
    const r = repo ?? this.library;
    const groups = r.getEpisodeGroupsByAnimeId(animeId);
    const groupFiles: GroupFilesOnDisk[] = groups.map((g) => ({
      groupId: g.id,
      filesOnDisk: r.getFilesOnDiskByGroupId(g.id),
    }));
    const state = computeLibraryState(groupFiles);
    r.updateLibraryState(animeId, state);
  }

  private async importFromTracker(tracker: TrackerPlugin, source: TrackerSource): Promise<void> {
    const trackerList = await tracker.getUserList();
    const libraryAnime = this.library.listAnime();

    for (const entry of trackerList) {
      const existingMapping = this.library.findGroupByTrackerExternalId(source, entry.trackerId);
      if (existingMapping) continue;

      const existingAnime = this.findMatchingAnime(entry, libraryAnime);
      if (existingAnime) {
        this.importToExistingAnimeFromTracker(existingAnime, entry, source);
      } else {
        this.importAsNewAnimeFromTracker(entry, source);
      }
    }
  }

  private findMatchingAnime(
    trackerEntry: TrackerAnime,
    libraryAnimeList: Array<{ id: number; title: string; titleJapanese?: string }>,
  ): { id: number; title: string } | null {
    const titleLower = trackerEntry.title.toLowerCase();
    const baseTitleLower = titleLower.replace(/\s+season\s+\d+/i, "").trim();

    for (const anime of libraryAnimeList) {
      const animeTitleLower = anime.title.toLowerCase();
      if (animeTitleLower === titleLower) return anime;
      if (animeTitleLower.replace(/\s+season\s+\d+/i, "").trim() === baseTitleLower) return anime;
    }

    if (trackerEntry.alternativeTitles) {
      for (const altTitle of trackerEntry.alternativeTitles) {
        const altLower = altTitle.toLowerCase();
        const altBaseLower = altLower.replace(/\s+season\s+\d+/i, "").trim();
        for (const anime of libraryAnimeList) {
          const animeTitleLower = anime.title.toLowerCase();
          if (animeTitleLower === altLower) return anime;
          if (animeTitleLower.replace(/\s+season\s+\d+/i, "").trim() === altBaseLower) return anime;
          if (anime.titleJapanese?.toLowerCase() === altLower) return anime;
        }
      }
    }

    return null;
  }

  private importToExistingAnimeFromTracker(
    anime: { id: number; title: string },
    trackerEntry: TrackerAnime,
    source: TrackerSource,
  ): void {
    const groups = this.library.getEpisodeGroupsByAnimeId(anime.id);
    const seasonNumber = this.extractSeasonNumber(trackerEntry);

    const existingGroup = groups.find(
      (g) =>
        g.entryType === trackerEntry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
    );

    if (existingGroup) {
      this.library.updateEpisodeGroupStatus(
        existingGroup.id,
        mapTrackerStatus(trackerEntry.watchStatus),
      );
    } else {
      this.library.upsertEpisodeGroup({
        animeId: anime.id,
        entryType: trackerEntry.entryType,
        seasonNumber,
        watchStatus: mapTrackerStatus(trackerEntry.watchStatus),
      });
    }

    const group =
      existingGroup ??
      this.library
        .getEpisodeGroupsByAnimeId(anime.id)
        .find(
          (g) =>
            g.entryType === trackerEntry.entryType && (g.seasonNumber ?? 1) === (seasonNumber ?? 1),
        );

    if (group) {
      this.library.upsertGroupTrackerMapping({
        groupId: group.id,
        source,
        externalId: trackerEntry.trackerId,
      });
    }
  }

  private importAsNewAnimeFromTracker(trackerEntry: TrackerAnime, source: TrackerSource): void {
    const anime = this.library.upsertAnime({
      externalId: `tracker-${trackerEntry.trackerId}`,
      sourceDb: source,
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
      source,
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

  private replayUnpushedEvents(oldSnapshot: {
    groupByCompositeKey: Map<string, number>;
    episodeByCompositeKey: Map<string, number>;
  }): void {
    const unpushed = this.events.getUnpushed();
    if (unpushed.length === 0) return;

    const newGroupByCompositeKey = new Map<string, number>();
    for (const a of this.library.listAnime()) {
      for (const g of this.library.getEpisodeGroupsByAnimeId(a.id)) {
        const key = groupCompositeKey(a.externalId, a.sourceDb, g.entryType, g.seasonNumber);
        newGroupByCompositeKey.set(key, g.id);
      }
    }

    this.library.transaction((tx) => {
      for (const event of unpushed) {
        if (event.entityType === "group") {
          const oldGroupId = [...oldSnapshot.groupByCompositeKey.entries()].find(
            ([, id]) => id === event.entityId,
          )?.[0];
          if (!oldGroupId) continue;

          const newGroupId = newGroupByCompositeKey.get(oldGroupId);
          if (newGroupId === undefined) continue;

          if (event.eventType === "status_change" && event.newValue) {
            tx.updateEpisodeGroupStatus(newGroupId, event.newValue as EpisodeGroup["watchStatus"]);
          } else if (event.eventType === "notes_update" && event.newValue !== null) {
            const group = tx.getEpisodeGroup(newGroupId);
            if (!group) continue;
            const metadata: { synopsis?: string; rating?: number } = {};
            if (group.synopsis === event.oldValue) {
              metadata.synopsis = event.newValue;
            } else if (group.rating?.toString() === event.oldValue) {
              metadata.rating = Number.parseFloat(event.newValue);
            }
            if (Object.keys(metadata).length > 0) {
              tx.updateEpisodeGroupMetadata(newGroupId, metadata);
            }
          }
        } else if (event.entityType === "episode") {
          const oldEpKey = [...oldSnapshot.episodeByCompositeKey.entries()].find(
            ([, id]) => id === event.entityId,
          )?.[0];
          if (!oldEpKey) continue;

          const [animeExternalId, sourceDb, seasonStr, episodeStr] = oldEpKey.split(":");
          const newAnime = tx.findAnime(animeExternalId ?? "", sourceDb ?? "");
          if (!newAnime) continue;

          const episodeNumber = Number.parseInt(episodeStr ?? "0", 10);
          const season = Number.parseInt(seasonStr ?? "1", 10);

          if (event.eventType === "watched_toggle" && event.newValue) {
            const watched = event.newValue === "true";
            const episodes = tx.getEpisodesByAnimeId(newAnime.id);
            const ep = episodes.find(
              (e) => e.episodeNumber === episodeNumber && (e.season ?? 1) === season,
            );
            if (ep) {
              tx.setEpisodeWatched(ep.id, watched);
            }
          }
        }
      }
    });
  }

  // Tracker Mappings

  getTrackerMappingsByGroupId(groupId: number): GroupTrackerMapping[] {
    return this.library.getTrackerMappingsByGroupId(groupId);
  }

  upsertGroupTrackerMapping(mapping: GroupTrackerMapping): void {
    this.library.upsertGroupTrackerMapping(mapping);
  }

  findGroupByTrackerExternalId(source: string, externalId: string): { groupId: number } | null {
    return this.library.findGroupByTrackerExternalId(source, externalId);
  }

  getTrackerMapping(groupId: number, source: string): GroupTrackerMapping | null {
    return this.library.getTrackerMapping(groupId, source);
  }

  removeTrackerMappingsBySource(source: string): void {
    this.library.removeTrackerMappingsBySource(source);
  }

  removeTrackerMapping(groupId: number, source: string): void {
    this.library.removeTrackerMapping(groupId, source);
  }

  // Watched status

  setEpisodeWatched(episodeId: number, watched: boolean): LibraryEpisode | null {
    const oldWatched = this.library.getEpisodeWatchStatus(episodeId);
    const result = this.library.setEpisodeWatched(episodeId, watched);
    if (result && oldWatched !== null && oldWatched !== watched) {
      this.events.append({
        entityType: "episode",
        entityId: episodeId,
        eventType: "watched_toggle",
        oldValue: String(oldWatched),
        newValue: String(watched),
      });
    }
    return result;
  }

  getEpisodeWatchStatus(episodeId: number): boolean | null {
    return this.library.getEpisodeWatchStatus(episodeId);
  }

  getEpisodeWatchStatusByAnimeId(animeId: number): Array<{ episodeId: number; watched: boolean }> {
    return this.library.getEpisodeWatchStatusByAnimeId(animeId);
  }

  private deleteAnimeFromOtherSourceDbs(tx: LibraryRepository, newSourceDbs: Set<string>): void {
    const allAnime = tx.listAnime();
    const animeToDelete: number[] = [];
    for (const entry of allAnime) {
      if (!newSourceDbs.has(entry.sourceDb)) {
        animeToDelete.push(entry.id);
      }
    }
    if (animeToDelete.length > 0) {
      tx.deleteAnimeByIds(animeToDelete);
    }
  }

  private deleteStaleEpisodes(
    tx: LibraryRepository,
    filePaths: Set<string>,
    excludeSourceDb?: string,
  ): void {
    const allEpisodes = tx.getEpisodesWithSourceDb();

    const episodeIdsToDelete: number[] = [];
    const affectedAnimeIds = new Set<number>();

    for (const ep of allEpisodes) {
      if (filePaths.has(ep.filePath) && ep.sourceDb !== excludeSourceDb) {
        episodeIdsToDelete.push(ep.id);
        affectedAnimeIds.add(ep.animeId);
      }
    }

    tx.deleteEpisodesByIds(episodeIdsToDelete);

    const orphanedAnimeIds: number[] = [];
    for (const animeId of affectedAnimeIds) {
      if (tx.getEpisodeCountByAnimeId(animeId) === 0) {
        orphanedAnimeIds.push(animeId);
      }
    }

    tx.deleteAnimeByIds(orphanedAnimeIds);
  }
}
