import type { EventRepository } from "../events/event-repository";
import type { EpisodeGroup, LibraryEpisode, LibraryRepository } from "./library-repository";

export interface WatchTrackerDeps {
  library: LibraryRepository;
  events: EventRepository;
}

export class WatchTracker {
  constructor(private deps: WatchTrackerDeps) {}

  setEpisodeWatched(episodeId: number, watched: boolean): LibraryEpisode | null {
    const oldWatched = this.deps.library.getEpisodeWatchStatus(episodeId);
    const result = this.deps.library.setEpisodeWatched(episodeId, watched);
    if (result && oldWatched !== null && oldWatched !== watched) {
      this.deps.events.append({
        entityType: "episode",
        entityId: episodeId,
        eventType: "watched_toggle",
        oldValue: String(oldWatched),
        newValue: String(watched),
      });
    }
    return result;
  }

  updateEpisodeNotes(episodeId: number, notes: string): LibraryEpisode | null {
    const oldEpisode = this.deps.library.getEpisode(episodeId);
    const result = this.deps.library.setEpisodeNotes(episodeId, notes);
    if (result && oldEpisode && oldEpisode.notes !== notes) {
      this.deps.events.append({
        entityType: "episode",
        entityId: episodeId,
        eventType: "notes_update",
        oldValue: oldEpisode.notes ?? null,
        newValue: notes,
      });
    }
    return result;
  }

  getEpisodeWatchStatus(episodeId: number): boolean | null {
    return this.deps.library.getEpisodeWatchStatus(episodeId);
  }

  getEpisodeWatchStatusByAnimeId(animeId: number): Array<{ episodeId: number; watched: boolean }> {
    return this.deps.library.getEpisodeWatchStatusByAnimeId(animeId);
  }

  setGroupWatchStatus(groupId: number, status: EpisodeGroup["watchStatus"]): EpisodeGroup | null {
    const oldGroup = this.deps.library.getEpisodeGroup(groupId);
    const result = this.deps.library.updateEpisodeGroupStatus(groupId, status);
    if (result && oldGroup && oldGroup.watchStatus !== status) {
      this.deps.events.append({
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
    const oldGroup = this.deps.library.getEpisodeGroup(groupId);
    const result = this.deps.library.updateEpisodeGroupMetadata(groupId, metadata);
    if (result && oldGroup) {
      if (metadata.synopsis !== undefined && metadata.synopsis !== oldGroup.synopsis) {
        this.deps.events.append({
          entityType: "group",
          entityId: groupId,
          eventType: "notes_update",
          oldValue: oldGroup.synopsis ?? null,
          newValue: metadata.synopsis,
        });
      }
      if (metadata.rating !== undefined && metadata.rating !== oldGroup.rating) {
        this.deps.events.append({
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
}
