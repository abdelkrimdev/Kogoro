<script lang="ts">
  import { LayoutDashboard, Folder, Search, Settings, LoaderCircle } from "@lucide/svelte";
  import { onMount } from "svelte";
  import type { DashboardData } from "../../shared/types";
  import type { RPCClient } from "../shared";
  import type { View } from "../state/nav";

  interface Props {
    rpc: RPCClient;
    onNavigate?: (view: View) => void;
    onOpenAnime?: (id: string) => void;
  }

  let { rpc, onNavigate, onOpenAnime }: Props = $props();

  let data = $state<DashboardData | null>(null);
  let isLoading = $state(true);

  onMount(async () => {
    try {
      data = (await rpc.request("getDashboardData", {})) as DashboardData;
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      isLoading = false;
    }
  });

  function progressPercent(watched: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((watched / total) * 100);
  }
</script>

<div class="flex-1 overflow-auto">
  {#if isLoading}
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-3">
        <LoaderCircle class="size-8 animate-spin text-primary-500-400 mx-auto" />
        <p class="text-surface-600-400 text-sm">Loading dashboard...</p>
      </div>
    </div>
  {:else if !data || (data.currentlyWatching.length === 0 && data.libraryStats.totalAnime === 0)}
    <div class="flex flex-col items-center justify-center h-full gap-4">
      <LayoutDashboard class="size-16 text-surface-600-400" />
      <p class="text-surface-600-400 text-sm">No anime in progress — connect a tracker or scan files to get started.</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium"
          onclick={() => onNavigate?.("scan")}
        >
          <Search class="size-4" />
          Scan Folder
        </button>
        <button
          type="button"
          class="btn preset-tonal-surface rounded-lg font-medium"
          onclick={() => onNavigate?.("settings")}
        >
          <Settings class="size-4" />
          Connect Tracker
        </button>
      </div>
    </div>
  {:else}
    <div class="p-4 space-y-6 max-w-5xl">
      <!-- Currently Watching -->
      <section>
        <h2 class="text-lg font-semibold text-surface-950-50 mb-3">Currently Watching</h2>
        {#if data.currentlyWatching.length === 0}
          <div class="card preset-tonal-surface p-4 text-center text-surface-600-400 text-sm">
            No anime in progress — connect a tracker or scan files to get started.
          </div>
        {:else}
          <div class="flex gap-3 overflow-x-auto pb-2">
            {#each data.currentlyWatching as item (item.id)}
              <button
                type="button"
                class="card card-hover preset-tonal-surface cursor-pointer transition-all text-left overflow-hidden shrink-0 w-48"
                onclick={() => onOpenAnime?.(item.id)}
              >
                <div class="aspect-2/3 bg-surface-300-700 relative overflow-hidden">
                  {#if item.coverArt}
                    <img src={item.coverArt} alt={item.title} class="w-full h-full object-cover" />
                  {:else}
                    <div class="absolute inset-0 flex items-center justify-center">
                      <Folder class="size-12 text-surface-600-400" />
                    </div>
                  {/if}
                </div>
                <div class="p-3 space-y-2">
                  <h3 class="text-sm font-medium text-surface-950-50 truncate">{item.title}</h3>
                  <p class="text-xs text-surface-600-400">{item.groupName}</p>
                  <div class="space-y-1">
                    <div class="w-full bg-surface-300-700 rounded-full h-1.5">
                      <div
                        class="bg-primary-500 h-1.5 rounded-full transition-all"
                        style="width: {progressPercent(item.watchedEpisodes, item.totalEpisodes)}%"
                      ></div>
                    </div>
                    <p class="text-xs text-surface-600-400 text-right">
                      {item.watchedEpisodes}/{item.totalEpisodes} watched
                    </p>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Library Stats -->
      {#if data.libraryStats.totalAnime > 0}
        <section>
          <h2 class="text-lg font-semibold text-surface-950-50 mb-3">Library Stats</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="card preset-tonal-surface p-4 text-center">
              <p class="text-2xl font-bold text-surface-950-50">{data.libraryStats.totalAnime}</p>
              <p class="text-xs text-surface-600-400 mt-1">Total Anime</p>
            </div>
            <div class="card preset-tonal-surface p-4 text-center">
              <p class="text-2xl font-bold text-surface-950-50">{data.libraryStats.totalEpisodes}</p>
              <p class="text-xs text-surface-600-400 mt-1">Total Episodes</p>
            </div>
            <div class="card preset-tonal-surface p-4 text-center">
              <p class="text-2xl font-bold text-primary-500">{data.libraryStats.onDisk}</p>
              <p class="text-xs text-surface-600-400 mt-1">On Disk</p>
            </div>
            <div class="card preset-tonal-surface p-4 text-center">
              <p class="text-2xl font-bold text-warning-500">{data.libraryStats.partiallyOnDisk}</p>
              <p class="text-xs text-surface-600-400 mt-1">Partial</p>
            </div>
          </div>
        </section>
      {/if}

      <!-- Continue Watching -->
      {#if data.continueWatching.length > 0}
        <section>
          <h2 class="text-lg font-semibold text-surface-950-50 mb-3">Continue Watching</h2>
          <div class="space-y-2">
            {#each data.continueWatching as item (item.id)}
              <button
                type="button"
                class="card card-hover preset-tonal-surface cursor-pointer transition-all text-left w-full flex items-center gap-3 p-3"
                onclick={() => onOpenAnime?.(item.animeId)}
              >
                <div class="w-12 h-16 bg-surface-300-700 rounded overflow-hidden shrink-0">
                  {#if item.coverArt}
                    <img src={item.coverArt} alt={item.title} class="w-full h-full object-cover" />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center">
                      <Folder class="size-6 text-surface-600-400" />
                    </div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="text-sm font-medium text-surface-950-50 truncate">{item.title}</h3>
                  <p class="text-xs text-surface-600-400">{item.groupName}</p>
                  <p class="text-xs text-surface-600-400 truncate">Next: {item.nextEpisode}</p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-xs text-surface-600-400">
                    {item.watchedEpisodes}/{item.totalEpisodes}
                  </p>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Quick Actions -->
      <section>
        <h2 class="text-lg font-semibold text-surface-950-50 mb-3">Quick Actions</h2>
        <div class="flex gap-3">
          <button
            type="button"
            class="btn preset-filled-primary-500 rounded-lg font-medium"
            onclick={() => onNavigate?.("scan")}
          >
            <Search class="size-4" />
            Scan Folder
          </button>
          <button
            type="button"
            class="btn preset-tonal-surface rounded-lg font-medium"
            onclick={() => onNavigate?.("settings")}
          >
            <Settings class="size-4" />
            Connect Tracker
          </button>
        </div>
      </section>
    </div>
  {/if}
</div>
