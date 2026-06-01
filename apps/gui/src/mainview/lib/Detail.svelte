<script lang="ts">
  import { ChevronLeft, ImageDown, RefreshCw, FileText, TriangleAlert, Tv, LoaderCircle } from '@lucide/svelte';
  import { Button, Checkbox, Input } from '@skeletonlabs/skeleton-svelte';
  import { ENTRY_LABELS, typeBadgeClass } from "../shared";
  import { getAnimeDirectory } from "../state/detail-state";
  import {
    type WatchStatusEntry,
    enrichEpisodesWithWatchStatus,
    computeWatchProgress,
  } from "../state/watch-state";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    animeId: string;
    onBack: () => void;
  }

  let { rpc, animeId, onBack }: Props = $props();

  interface AnimeDetail {
    anime: {
      id: string;
      titleEn: string;
      titleJa?: string;
      entryType: string;
      sourceDb: string;
      totalEpisodes: number;
      coverArt?: string;
    };
    episodes: Array<{
      id: string;
      season: number;
      episode: number;
      titleEn: string;
      filePath: string;
      missing: boolean;
    }>;
    filesOnDisk: number;
  }

  let detail = $state<AnimeDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let artworkLoading = $state(false);
  let metadataLoading = $state(false);
  let rescanLoading = $state(false);
  let watchStatuses = $state<WatchStatusEntry[]>([]);

  function sourceDbLabel(db: string): string {
    switch (db) {
      case "tvdb":
        return "TVDB";
      case "anidb":
        return "AniDB";
      default:
        return db;
    }
  }

  function detectGaps(episodes: AnimeDetail["episodes"]): Set<number> {
    const gaps = new Set<number>();
    let prevEp = 0;
    for (const ep of episodes) {
      if (!ep.missing && prevEp > 0 && ep.episode > prevEp + 1) {
        for (let i = prevEp + 1; i < ep.episode; i++) {
          gaps.add(i);
        }
      }
      if (!ep.missing) {
        prevEp = ep.episode;
      }
    }
    return gaps;
  }

  async function loadDetail() {
    loading = true;
    error = null;
    try {
      const result = (await rpc.request("getAnimeDetail", { id: animeId })) as AnimeDetail | null;
      detail = result;
      if (!result) {
        error = "Anime not found";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load anime details";
    }
    loading = false;
  }

  async function loadWatchStatus() {
    try {
      const result = (await rpc.request("getWatchStatusByAnime", { animeId })) as WatchStatusEntry[];
      watchStatuses = result;
    } catch (err) {
      console.error("Failed to load watch status:", err);
    }
  }

  async function toggleWatched(episodeId: string) {
    const current = watchStatuses.find((ws) => ws.episodeId === episodeId);
    const newWatched = !(current?.watched ?? false);
    const now = new Date().toISOString();

    watchStatuses = [
      ...watchStatuses.filter((ws) => ws.episodeId !== episodeId),
      { episodeId, watched: newWatched, notes: current?.notes, updatedAt: now },
    ];

    try {
      await rpc.request("setWatchStatus", { episodeId, watched: newWatched, notes: current?.notes });
    } catch (err) {
      console.error("Failed to set watch status:", err);
      await loadWatchStatus();
    }
  }

  async function saveNotes(episodeId: string, notes: string) {
    const current = watchStatuses.find((ws) => ws.episodeId === episodeId);
    const now = new Date().toISOString();

    watchStatuses = [
      ...watchStatuses.filter((ws) => ws.episodeId !== episodeId),
      { episodeId, watched: current?.watched ?? false, notes: notes || undefined, updatedAt: now },
    ];

    try {
      await rpc.request("setWatchStatus", { episodeId, watched: current?.watched ?? false, notes: notes || undefined });
    } catch (err) {
      console.error("Failed to save notes:", err);
      await loadWatchStatus();
    }
  }

  async function downloadArtwork() {
    artworkLoading = true;
    try {
      await rpc.request("enrichArtwork", { id: animeId });
    } catch (err) {
      console.error("Artwork enrichment failed:", err);
    }
    artworkLoading = false;
    await loadDetail();
  }

  async function generateMetadata() {
    metadataLoading = true;
    try {
      await rpc.request("enrichMetadata", { id: animeId });
    } catch (err) {
      console.error("Metadata enrichment failed:", err);
    }
    metadataLoading = false;
  }

  async function rescan() {
    if (!detail) return;
    const dir = getAnimeDirectory(detail.episodes);
    if (!dir) return;
    rescanLoading = true;
    try {
      await rpc.request("scanStart", { path: dir });
    } catch (err) {
      console.error("Rescan failed:", err);
    }
    rescanLoading = false;
  }

  const gaps = $derived(detail ? detectGaps(detail.episodes) : new Set<number>());
  const missingCount = $derived(detail?.episodes.filter((ep) => ep.missing).length ?? 0);
  const enrichedEpisodes = $derived(
    detail ? enrichEpisodesWithWatchStatus(detail.episodes, watchStatuses) : [],
  );
  const progress = $derived(computeWatchProgress(enrichedEpisodes));

  $effect(() => {
    loadDetail();
    loadWatchStatus();
  });
</script>

{#if loading}
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-3">
      <LoaderCircle class="size-8 animate-spin text-primary-500-400 mx-auto" />
      <p class="text-surface-600-400 text-sm">Loading anime details...</p>
    </div>
  </div>
{:else if error || !detail}
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <TriangleAlert class="size-12 text-error-400-400" />
    <p class="text-surface-700-300 text-sm">{error ?? "Unknown error"}</p>
    <Button class="preset-tonal-surface rounded-lg font-medium" onclick={onBack}>
      Back to Library
    </Button>
  </div>
{:else}
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-300-700 bg-surface-200-800/50 flex-shrink-0">
      <Button class="preset-tonal-surface rounded-lg font-medium" onclick={onBack}>
        <ChevronLeft class="size-4" /> Library
      </Button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="p-6">
        <div class="flex gap-6">
          <div class="w-48 flex-shrink-0">
            <div class="aspect-[2/3] bg-surface-300-700 rounded-xl overflow-hidden">
              {#if detail.anime.coverArt}
                <img src={detail.anime.coverArt} alt={detail.anime.titleEn} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full flex items-center justify-center">
                  <Tv class="size-12 text-surface-600-400" />
                </div>
              {/if}
            </div>
            <div class="flex flex-col gap-2 mt-4">
              {#if artworkLoading}
                <Button disabled class="flex items-center gap-2 preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoaderCircle class="size-4 animate-spin" /> Downloading...
                </Button>
              {:else}
                <Button class="flex items-center gap-2 preset-filled-primary-500 rounded-lg font-medium" onclick={downloadArtwork}>
                  <ImageDown class="size-4" /> Download Cover Art
                </Button>
              {/if}
              {#if rescanLoading}
                <Button disabled class="flex items-center gap-2 preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoaderCircle class="size-4 animate-spin" /> Scanning...
                </Button>
              {:else}
                <Button class="flex items-center gap-2 preset-tonal-surface rounded-lg font-medium" onclick={rescan}>
                  <RefreshCw class="size-4" /> Rescan
                </Button>
              {/if}
              {#if metadataLoading}
                <Button disabled class="flex items-center gap-2 preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoaderCircle class="size-4 animate-spin" /> Generating...
                </Button>
              {:else}
                <Button class="flex items-center gap-2 preset-filled-success-500 rounded-lg font-medium" onclick={generateMetadata}>
                  <FileText class="size-4" /> Generate Metadata
                </Button>
              {/if}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold text-surface-950-50">{detail.anime.titleEn}</h1>
            {#if detail.anime.titleJa}
              <p class="text-surface-700-300 text-sm mt-1">{detail.anime.titleJa}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-3 mt-3">
              <span class="{typeBadgeClass(detail.anime.entryType)} text-xs">
                {ENTRY_LABELS[detail.anime.entryType] ?? detail.anime.entryType}
              </span>
              <span class="text-sm text-surface-700-300">{sourceDbLabel(detail.anime.sourceDb)}</span>
              <span class="text-sm text-surface-600-400">·</span>
              <span class="text-sm text-surface-700-300">{detail.anime.totalEpisodes} episodes</span>
              <span class="text-sm text-surface-600-400">·</span>
              <span class="text-sm text-surface-700-300">{detail.filesOnDisk} files on disk</span>
              {#if missingCount > 0}
                <span class="text-sm text-surface-600-400">·</span>
                <span class="text-sm text-warning-400-400">{missingCount} missing</span>
              {/if}
              {#if progress.total > 0}
                <span class="text-sm text-surface-600-400">·</span>
                <span class="text-sm text-success-400-400">{progress.percent}% watched</span>
                <progress class="progress w-24 appearance-none" value={progress.percent} max="100"></progress>
              {/if}
            </div>

            <div class="mt-6">
              <h2 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide mb-2">Episodes</h2>
              <div class="table-wrap rounded-xl border border-surface-300-700/50 overflow-hidden">
                {#if detail.episodes.length === 0}
                  <div class="text-center text-surface-600-400 py-8">
                    No episodes found.
                  </div>
                {:else}
                  <table class="table">
                    <thead>
                      <tr>
                        <th class="font-medium">Episode</th>
                        <th class="font-medium">Title</th>
                        <th class="font-medium">File Path</th>
                        <th class="font-medium text-center w-16">Watched</th>
                        <th class="font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody class="[&>tr]:hover:preset-tonal-primary">
                      {#each enrichedEpisodes as ep (ep.id)}
                        {@const isGap = gaps.has(ep.episode)}
                        <tr class="{ep.missing ? 'text-surface-600-400 opacity-60' : isGap ? 'text-warning-400-400' : ''}">
                          <td class="text-sm font-medium whitespace-nowrap">
                            {ep.season}x{String(ep.episode).padStart(2, "0")}
                            {#if ep.missing}
                                <span class="badge preset-tonal-warning ml-2 text-xs">Missing</span>
                              {:else if isGap}
                                <span class="badge preset-tonal-warning ml-2 text-xs">Gap</span>
                            {/if}
                          </td>
                          <td class="text-sm">{ep.titleEn}</td>
                          <td class="text-sm text-surface-700-300 font-mono truncate max-w-xs">
                            {#if ep.filePath}
                              {ep.filePath}
                            {:else}
                              <span class="text-surface-600-400">—</span>
                            {/if}
                          </td>
                          <td class="text-center">
                            {#if !ep.missing}
                              <Checkbox
                                checked={ep.watched}
                                onchange={() => toggleWatched(ep.id)}
                                class="text-primary-500"
                              />
                            {:else}
                              <span class="text-surface-600-400">—</span>
                            {/if}
                          </td>
                          <td>
                            {#if !ep.missing}
                              <Input
                                type="text"
                                class="w-full text-sm text-surface-700-300 border-b border-surface-300-700 focus:border-primary-500 px-1 py-0.5"
                                placeholder="Add note..."
                                value={ep.notes ?? ""}
                                onchange={(e) => saveNotes(ep.id, (e.target as HTMLInputElement).value)}
                              />
                            {:else}
                              <span class="text-surface-600-400">—</span>
                            {/if}
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
