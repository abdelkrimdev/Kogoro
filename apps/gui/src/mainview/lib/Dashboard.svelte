<script lang="ts">
  import {
    LayoutDashboard,
    Folder,
    Search,
    Settings,
    Tv,
    Film,
    HardDrive,
    AlertCircle,
    Play,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import type { DashboardData, TrackerConnectionInfo } from "../../shared/types";
  import type { RPCClient } from "../shared";
  import type { View } from "../state/nav";
  import LoadingSpinner from "./LoadingSpinner.svelte";

  interface Props {
    rpc: RPCClient;
    onNavigate?: (view: View) => void;
    onOpenAnime?: (id: string) => void;
  }

  let { rpc, onNavigate, onOpenAnime }: Props = $props();

  let data = $state<DashboardData | null>(null);
  let trackerStatus = $state<TrackerConnectionInfo[]>([]);
  let isLoading = $state(true);
  let scrollContainer = $state<HTMLDivElement | null>(null);
  let showLeftFade = $state(false);
  let showRightFade = $state(false);

  const SCROLL_AMOUNT = 240;
  const SCROLL_THRESHOLD = 8;

  const hasConnectedTrackers = $derived(trackerStatus.some((t) => t.connected));

  onMount(async () => {
    try {
      const [dashboardData, trackers] = await Promise.all([
        rpc.request("getDashboardData", {}) as Promise<DashboardData>,
        rpc.request("getTrackerStatus", {}) as Promise<TrackerConnectionInfo[]>,
      ]);
      data = dashboardData;
      trackerStatus = trackers;
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      isLoading = false;
    }
  });

  $effect(() => {
    const el = scrollContainer;
    if (!el) return;

    function checkScroll() {
      showLeftFade = el!.scrollLeft > SCROLL_THRESHOLD;
      showRightFade = el!.scrollLeft < el!.scrollWidth - el!.clientWidth - SCROLL_THRESHOLD;
    }

    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  });

  function progressPercent(watched: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((watched / total) * 100);
  }

  function scrollCarousel(direction: "left" | "right") {
    if (!scrollContainer) return;
    scrollContainer.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  }
</script>

<div class="flex-1 overflow-auto scroll-smooth">
  {#if isLoading}
    <div class="flex items-center justify-center h-full">
      <div class="text-center space-y-3">
        <LoadingSpinner size="lg" class="text-primary-500-400 mx-auto" />
        <p class="text-surface-600-400 text-sm">Loading dashboard...</p>
      </div>
    </div>
  {:else if !data || (data.currentlyWatching.length === 0 && data.libraryStats.totalAnime === 0)}
    <div class="flex flex-col items-center justify-center h-full gap-4">
      <LayoutDashboard class="size-16 text-surface-600-400" />
      <div class="text-center space-y-1">
        <p class="text-surface-950-50 font-medium">No anime in progress</p>
        <p class="text-surface-600-400 text-sm">Connect a tracker or scan files to get started.</p>
      </div>
      <div class="flex gap-3">
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium gap-2"
          onclick={() => onNavigate?.("scan")}
        >
          <Search class="size-4" />
          Scan Folder
        </button>
        <button
          type="button"
          class="btn preset-tonal-surface rounded-lg font-medium gap-2"
          onclick={() => onNavigate?.("settings")}
        >
          <Settings class="size-4" />
          Connect Tracker
        </button>
      </div>
    </div>
  {:else}
    <div class="p-6 space-y-10 max-w-5xl">
      <!-- Currently Watching -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-xl font-bold text-surface-950-50">Currently Watching</h2>
          {#if data.currentlyWatching.length > 3}
            <div class="flex gap-1.5">
              <button
                type="button"
                class="btn-icon preset-tonal-surface"
                onclick={() => scrollCarousel("left")}
                aria-label="Scroll left"
              >
                <ChevronLeft class="size-4" />
              </button>
              <button
                type="button"
                class="btn-icon preset-tonal-surface"
                onclick={() => scrollCarousel("right")}
                aria-label="Scroll right"
              >
                <ChevronRight class="size-4" />
              </button>
            </div>
          {/if}
        </div>

        {#if data.currentlyWatching.length === 0}
          <div class="card preset-tonal-surface p-4 text-center text-surface-600-400 text-sm">
            No anime in progress — connect a tracker or scan files to get started.
          </div>
        {:else}
          <div class="relative">
            {#if showLeftFade}
              <div class="absolute left-0 top-0 bottom-2 w-12 bg-gradient-to-r from-surface-50-950 to-transparent z-10 pointer-events-none"></div>
            {/if}
            {#if showRightFade}
              <div class="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-surface-50-950 to-transparent z-10 pointer-events-none"></div>
            {/if}
            <div
              bind:this={scrollContainer}
              class="flex gap-4 overflow-x-auto pb-2 scrollbar-none"
            >
              {#each data.currentlyWatching as item (item.id)}
                <button
                  type="button"
                  class="group card card-hover cursor-pointer transition-all duration-200 text-left overflow-hidden shrink-0 w-56 hover:scale-[1.02] hover:shadow-lg"
                  onclick={() => onOpenAnime?.(item.id)}
                >
                  <div class="aspect-[2/3] bg-surface-300-700 relative overflow-hidden">
                    {#if item.coverArt}
                      <img src={item.coverArt} alt={item.title} class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    {:else}
                      <div class="absolute inset-0 flex items-center justify-center">
                        <Folder class="size-14 text-surface-600-400" />
                      </div>
                    {/if}
                    <div class="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-surface-950/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-4 space-y-2">
                      <h3 class="text-sm font-semibold text-surface-50 truncate drop-shadow-sm">{item.title}</h3>
                      <p class="text-xs text-surface-50/70">{item.groupName}</p>
                      <div class="space-y-1.5">
                        <div class="h-1.5 bg-surface-50/20 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-gradient-to-r from-primary-400 to-primary-500 rounded-full transition-all duration-500"
                            style="width: {progressPercent(item.watchedEpisodes, item.totalEpisodes)}%"
                          ></div>
                        </div>
                        <p class="text-[11px] text-surface-50/60 text-right font-medium">
                          {item.watchedEpisodes}/{item.totalEpisodes}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </section>

      <!-- Library Stats -->
      {#if data.libraryStats.totalAnime > 0}
        <section>
          <h2 class="text-xl font-bold text-surface-950-50 mb-4">Library Stats</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="card preset-tonal-surface p-4 flex items-center gap-3">
              <div class="size-10 rounded-lg bg-surface-300-700 flex items-center justify-center shrink-0">
                <Tv class="size-5 text-surface-700-300" />
              </div>
              <div>
                <p class="text-xl font-bold text-surface-950-50 leading-none">{data.libraryStats.totalAnime}</p>
                <p class="text-xs text-surface-600-400 mt-1">Total Anime</p>
              </div>
            </div>
            <div class="card preset-tonal-surface p-4 flex items-center gap-3">
              <div class="size-10 rounded-lg bg-surface-300-700 flex items-center justify-center shrink-0">
                <Film class="size-5 text-surface-700-300" />
              </div>
              <div>
                <p class="text-xl font-bold text-surface-950-50 leading-none">{data.libraryStats.totalEpisodes}</p>
                <p class="text-xs text-surface-600-400 mt-1">Total Episodes</p>
              </div>
            </div>
            <div class="card preset-tonal-surface p-4 flex items-center gap-3">
              <div class="size-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                <HardDrive class="size-5 text-primary-500" />
              </div>
              <div>
                <p class="text-xl font-bold text-primary-500 leading-none">{data.libraryStats.onDisk}</p>
                <p class="text-xs text-surface-600-400 mt-1">On Disk</p>
              </div>
            </div>
            <div class="card preset-tonal-surface p-4 flex items-center gap-3">
              <div class="size-10 rounded-lg bg-warning-500/10 flex items-center justify-center shrink-0">
                <AlertCircle class="size-5 text-warning-500" />
              </div>
              <div>
                <p class="text-xl font-bold text-warning-500 leading-none">{data.libraryStats.partiallyOnDisk}</p>
                <p class="text-xs text-surface-600-400 mt-1">Partial</p>
              </div>
            </div>
          </div>
        </section>
      {/if}

      <!-- Continue Watching -->
      {#if data.continueWatching.length > 0}
        <section>
          <h2 class="text-xl font-bold text-surface-950-50 mb-4">Continue Watching</h2>
          <div class="space-y-2">
            {#each data.continueWatching as item (item.id)}
              <button
                type="button"
                class="group card card-hover cursor-pointer transition-all duration-200 text-left w-full flex items-center gap-4 p-3 hover:bg-surface-200-800"
                onclick={() => onOpenAnime?.(item.animeId)}
              >
                <div class="w-14 h-[72px] bg-surface-300-700 rounded-lg overflow-hidden shrink-0 relative">
                  {#if item.coverArt}
                    <img src={item.coverArt} alt={item.title} class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center">
                      <Folder class="size-6 text-surface-600-400" />
                    </div>
                  {/if}
                  <div class="absolute inset-0 flex items-center justify-center bg-surface-950/0 group-hover:bg-surface-950/20 transition-colors duration-200">
                    <Play class="size-5 text-surface-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-sm" />
                  </div>
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                  <h3 class="text-sm font-medium text-surface-950-50 truncate group-hover:text-primary-400 transition-colors">{item.title}</h3>
                  <p class="text-xs text-surface-600-400">{item.groupName}</p>
                  <p class="text-xs text-surface-600-400 truncate">Next: {item.nextEpisode}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <span class="badge preset-tonal-surface text-xs">
                    {item.watchedEpisodes}/{item.totalEpisodes}
                  </span>
                  <div class="w-16 h-1.5 bg-surface-300-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary-500 rounded-full transition-all duration-500"
                      style="width: {progressPercent(item.watchedEpisodes, item.totalEpisodes)}%"
                    ></div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Quick Actions -->
      <section>
        <h2 class="text-xl font-bold text-surface-950-50 mb-4">Quick Actions</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            class="group card card-hover preset-tonal-surface cursor-pointer transition-all duration-200 text-left p-5 flex items-start gap-4 hover:bg-surface-200-800"
            onclick={() => onNavigate?.("scan")}
          >
            <div class="size-11 rounded-xl bg-primary-500/10 flex items-center justify-center shrink-0 group-hover:bg-primary-500/20 transition-colors">
              <Search class="size-5 text-primary-500" />
            </div>
            <div class="space-y-0.5">
              <h3 class="text-sm font-semibold text-surface-950-50 group-hover:text-primary-400 transition-colors">Scan Folder</h3>
              <p class="text-xs text-surface-600-400">Add anime files to your library</p>
            </div>
          </button>
          <button
            type="button"
            class="group card card-hover preset-tonal-surface cursor-pointer transition-all duration-200 text-left p-5 flex items-start gap-4 hover:bg-surface-200-800"
            onclick={() => onNavigate?.("settings")}
          >
            {#if hasConnectedTrackers}
              <div class="size-11 rounded-xl bg-success-500/10 flex items-center justify-center shrink-0 group-hover:bg-success-500/20 transition-colors">
                <RefreshCw class="size-5 text-success-500" />
              </div>
              <div class="space-y-0.5">
                <h3 class="text-sm font-semibold text-surface-950-50 group-hover:text-primary-400 transition-colors">Sync Trackers</h3>
                <p class="text-xs text-surface-600-400">Update watch status from connected trackers</p>
              </div>
            {:else}
              <div class="size-11 rounded-xl bg-surface-300-700 flex items-center justify-center shrink-0 group-hover:bg-surface-300-600 transition-colors">
                <Settings class="size-5 text-surface-700-300" />
              </div>
              <div class="space-y-0.5">
                <h3 class="text-sm font-semibold text-surface-950-50 group-hover:text-primary-400 transition-colors">Connect Tracker</h3>
                <p class="text-xs text-surface-600-400">Sync watch status with MAL, AniList, or Kitsu</p>
              </div>
            {/if}
          </button>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .scrollbar-none {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
</style>
