<script lang="ts">
  import { ENTRY_LABELS, typeBadgeClass } from "../shared";
  import { getAnimeDirectory } from "../state/detail-state";

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

  $effect(() => {
    loadDetail();
  });
</script>

{#if loading}
  <div class="flex items-center justify-center h-full">
    <div class="text-center space-y-3">
      <div class="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p class="text-surface-500 text-sm">Loading anime details...</p>
    </div>
  </div>
{:else if error || !detail}
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <svg class="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <p class="text-surface-400">{error ?? "Unknown error"}</p>
    <button class="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm transition-colors" onclick={onBack}>
      Back to Library
    </button>
  </div>
{:else}
  <div class="flex flex-col h-full">
    <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-800/50 flex-shrink-0">
      <button class="flex items-center gap-1 text-surface-400 hover:text-surface-200 transition-colors text-sm" onclick={onBack}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg> Library
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div class="p-6">
        <div class="flex gap-6">
          <div class="w-48 flex-shrink-0">
            <div class="aspect-[2/3] bg-surface-700 rounded-xl overflow-hidden">
              {#if detail.anime.coverArt}
                <img src={detail.anime.coverArt} alt={detail.anime.titleEn} class="w-full h-full object-cover" />
              {:else}
                <div class="w-full h-full flex items-center justify-center">
                  <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              {/if}
            </div>
            <div class="flex flex-col gap-2 mt-4">
              {#if artworkLoading}
                <button disabled class="flex items-center gap-2 px-4 py-2 bg-surface-700 text-surface-500 rounded-lg text-sm cursor-not-allowed">
                  <div class="w-4 h-4 border-2 border-surface-500 border-t-transparent rounded-full animate-spin"></div> Downloading...
                </button>
              {:else}
                <button class="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors" onclick={downloadArtwork}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg> Download Cover Art
                </button>
              {/if}
              {#if rescanLoading}
                <button disabled class="flex items-center gap-2 px-4 py-2 bg-surface-700 text-surface-500 rounded-lg text-sm cursor-not-allowed">
                  <div class="w-4 h-4 border-2 border-surface-500 border-t-transparent rounded-full animate-spin"></div> Scanning...
                </button>
              {:else}
                <button class="flex items-center gap-2 px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors" onclick={rescan}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg> Rescan
                </button>
              {/if}
              {#if metadataLoading}
                <button disabled class="flex items-center gap-2 px-4 py-2 bg-surface-700 text-surface-500 rounded-lg text-sm cursor-not-allowed">
                  <div class="w-4 h-4 border-2 border-surface-500 border-t-transparent rounded-full animate-spin"></div> Generating...
                </button>
              {:else}
                <button class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors" onclick={generateMetadata}>
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg> Generate Metadata
                </button>
              {/if}
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <h1 class="text-xl font-bold text-surface-50">{detail.anime.titleEn}</h1>
            {#if detail.anime.titleJa}
              <p class="text-surface-400 text-sm mt-1">{detail.anime.titleJa}</p>
            {/if}
            <div class="flex flex-wrap items-center gap-3 mt-3">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-medium {typeBadgeClass(detail.anime.entryType)}">
                {ENTRY_LABELS[detail.anime.entryType] ?? detail.anime.entryType}
              </span>
              <span class="text-sm text-surface-400">{sourceDbLabel(detail.anime.sourceDb)}</span>
              <span class="text-sm text-surface-500">·</span>
              <span class="text-sm text-surface-300">{detail.anime.totalEpisodes} episodes</span>
              <span class="text-sm text-surface-500">·</span>
              <span class="text-sm text-surface-300">{detail.filesOnDisk} files on disk</span>
              {#if missingCount > 0}
                <span class="text-sm text-surface-500">·</span>
                <span class="text-sm text-amber-400">{missingCount} missing</span>
              {/if}
            </div>

            <div class="mt-6">
              <h2 class="text-sm font-medium text-surface-300 uppercase tracking-wider mb-2">Episodes</h2>
              <div class="bg-surface-800/50 rounded-xl border border-surface-700/50 overflow-hidden">
                {#if detail.episodes.length === 0}
                  <div class="text-center text-surface-500 py-8">
                    No episodes found.
                  </div>
                {:else}
                  <table class="w-full">
                    <thead>
                      <tr class="border-b border-surface-700 text-left text-xs text-surface-400 uppercase tracking-wider">
                        <th class="px-4 py-2 font-medium">Episode</th>
                        <th class="px-4 py-2 font-medium">Title</th>
                        <th class="px-4 py-2 font-medium">File Path</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each detail.episodes as ep (ep.id)}
                        {@const isGap = gaps.has(ep.episode)}
                        <tr class="border-t border-surface-700/50 {ep.missing ? 'text-surface-500 opacity-60' : isGap ? 'text-amber-400' : 'text-surface-100'}">
                          <td class="px-4 py-2 text-sm font-medium whitespace-nowrap">
                            {ep.season}x{String(ep.episode).padStart(2, "0")}
                            {#if ep.missing}
                              <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Missing</span>
                            {:else if isGap}
                              <span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Gap</span>
                            {/if}
                          </td>
                          <td class="px-4 py-2 text-sm">{ep.titleEn}</td>
                          <td class="px-4 py-2 text-sm text-surface-400 font-mono truncate max-w-xs">
                            {#if ep.filePath}
                              {ep.filePath}
                            {:else}
                              <span class="text-surface-600">—</span>
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
