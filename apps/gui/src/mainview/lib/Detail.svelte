<script lang="ts">
  import { ChevronLeft, ImageDown, RefreshCw, FileText, TriangleAlert, Tv, ArrowUpFromLine } from '@lucide/svelte';
  import EpisodeGroupAccordion from "./EpisodeGroupAccordion.svelte";
  import type { AnimeDetail } from "../../shared/types";
  import { getAnimeDirectory } from "../state/detail-state";
  import LoadingSpinner from "./LoadingSpinner.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    animeId: string;
    onBack: () => void;
  }

  let { rpc, animeId, onBack }: Props = $props();

  let detail = $state<AnimeDetail | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let artworkLoading = $state(false);
  let metadataLoading = $state(false);
  let trackerLoading = $state(false);
  let rescanLoading = $state(false);

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

  async function syncTrackerData() {
    trackerLoading = true;
    try {
      await rpc.request("enrichTracker", { id: animeId });
    } catch (err) {
      console.error("Tracker enrichment failed:", err);
    }
    trackerLoading = false;
    await loadDetail();
  }

  async function rescan() {
    if (!detail) return;
    const allEpisodes = detail.groups.flatMap((g) => g.episodes.map((ep) => ({
      id: ep.id,
      season: g.seasonNumber ?? 1,
      episode: ep.episodeNumber,
      titleEn: ep.titleEn,
      filePath: ep.filePath,
      missing: false,
    })));
    const dir = getAnimeDirectory(allEpisodes);
    if (!dir) return;
    rescanLoading = true;
    try {
      await rpc.request("scanStart", { path: dir });
    } catch (err) {
      console.error("Rescan failed:", err);
    }
    rescanLoading = false;
  }

  const totalEpisodes = $derived(
    detail?.groups.reduce((sum, g) => sum + g.episodes.length, 0) ?? 0
  );
  const totalWatched = $derived(
    detail?.groups.reduce((sum, g) => sum + g.episodes.filter((ep) => ep.watched).length, 0) ?? 0
  );
  const progressPercent = $derived(
    totalEpisodes > 0 ? Math.round((totalWatched / totalEpisodes) * 100) : 0
  );

  $effect(() => {
    loadDetail();
    rpc.request("syncAnime", { animeId }).catch(() => {});
  });
</script>

{#if loading}
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-3">
      <LoadingSpinner size="lg" class="text-primary-500-400 mx-auto" />
      <p class="text-surface-600-400 text-sm">Loading anime details...</p>
    </div>
  </div>
{:else if error || !detail}
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <TriangleAlert class="size-12 text-error-500-400" />
    <p class="text-surface-700-300 text-sm">{error ?? "Unknown error"}</p>
    <button type="button" class="btn preset-tonal-surface rounded-lg font-medium" onclick={onBack}>
      Back to Library
    </button>
  </div>
{:else}
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-300-700 bg-surface-200-800/50 shrink-0">
      <button type="button" class="btn preset-tonal-surface rounded-lg font-medium" onclick={onBack}>
        <ChevronLeft class="size-4" /> Library
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="p-6">
        <div class="flex gap-6">
          <div class="w-48 shrink-0">
            <div class="card preset-outlined-surface-300-700 aspect-2/3 rounded-xl overflow-hidden">
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
                <button type="button" disabled class="flex items-center gap-2 btn preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoadingSpinner size="sm" /> Downloading...
                </button>
              {:else}
                <button type="button" class="flex items-center gap-2 btn preset-filled-primary-500 rounded-lg font-medium" onclick={downloadArtwork}>
                  <ImageDown class="size-4" /> Download Cover Art
                </button>
              {/if}
              {#if rescanLoading}
                <button type="button" disabled class="flex items-center gap-2 btn preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoadingSpinner size="sm" /> Scanning...
                </button>
              {:else}
                <button type="button" class="flex items-center gap-2 btn preset-tonal-surface rounded-lg font-medium" onclick={rescan}>
                  <RefreshCw class="size-4" /> Rescan
                </button>
              {/if}
              {#if metadataLoading}
                <button type="button" disabled class="flex items-center gap-2 btn preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoadingSpinner size="sm" /> Generating...
                </button>
              {:else}
                <button type="button" class="flex items-center gap-2 btn preset-filled-success-500 rounded-lg font-medium" onclick={generateMetadata}>
                  <FileText class="size-4" /> Generate Metadata
                </button>
              {/if}
              {#if trackerLoading}
                <button type="button" disabled class="flex items-center gap-2 btn preset-tonal-surface rounded-lg font-medium cursor-not-allowed">
                  <LoadingSpinner size="sm" /> Syncing Trackers...
                </button>
              {:else}
                <button type="button" class="flex items-center gap-2 btn preset-tonal-secondary rounded-lg font-medium" onclick={syncTrackerData}>
                  <ArrowUpFromLine class="size-4" /> Sync Tracker Data
                </button>
              {/if}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold text-surface-950-50">{detail.anime.titleEn}</h1>
            {#if detail.anime.alternativeTitles?.length}
              <p class="text-surface-700-300 text-sm mt-1">{detail.anime.alternativeTitles.join(" / ")}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-3 mt-3">
              <span class="text-sm text-surface-700-300">{detail.anime.totalEpisodes} episodes</span>
              <span class="text-sm text-surface-600-400">·</span>
              <span class="text-sm text-surface-700-300">{totalEpisodes} files on disk</span>
              {#if progressPercent > 0}
                <span class="text-sm text-surface-600-400">·</span>
                <span class="text-sm text-success-500-400">{progressPercent}% watched</span>
                <progress class="progress w-24" value={progressPercent} max="100"></progress>
              {/if}
            </div>

            {#if detail.anime.genres && detail.anime.genres.length > 0}
              <div class="flex flex-wrap gap-2 mt-3">
                {#each detail.anime.genres as genre (genre)}
                  <span class="badge preset-tonal-surface">{genre}</span>
                {/each}
              </div>
            {/if}

            <div class="mt-6 space-y-4">
              <h2 class="text-sm font-semibold text-surface-700-300 uppercase tracking-wide">Episode Groups</h2>
              {#if detail.groups.length === 0}
                <div class="text-center text-surface-600-400 py-8">
                  No episode groups found.
                </div>
              {:else}
                {#each detail.groups as group (group.id)}
                  <EpisodeGroupAccordion {group} {rpc} defaultOpen={detail.groups.length === 1} />
                {/each}
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
