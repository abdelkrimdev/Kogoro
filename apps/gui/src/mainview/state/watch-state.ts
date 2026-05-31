import type { EpisodeRow } from "./detail-state";

export interface WatchStatusEntry {
  episodeId: string;
  watched: boolean;
  notes?: string;
  updatedAt: string;
}

export interface EnrichedEpisode extends EpisodeRow {
  watched: boolean;
  notes?: string;
}

export function enrichEpisodesWithWatchStatus(
  episodes: EpisodeRow[],
  watchStatuses: WatchStatusEntry[],
): EnrichedEpisode[] {
  const watchMap = new Map(watchStatuses.map((ws) => [ws.episodeId, ws]));
  return episodes.map((ep) => {
    const ws = watchMap.get(ep.id);
    return {
      ...ep,
      watched: ws?.watched ?? false,
      notes: ws?.notes,
    };
  });
}

export function computeWatchProgress(episodes: EnrichedEpisode[]): {
  watched: number;
  total: number;
  percent: number;
} {
  const total = episodes.filter((ep) => !ep.missing).length;
  const watched = episodes.filter((ep) => !ep.missing && ep.watched).length;
  return { watched, total, percent: total > 0 ? Math.round((watched / total) * 100) : 0 };
}
