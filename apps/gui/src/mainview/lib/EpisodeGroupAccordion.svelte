<script lang="ts">
  import { ChevronDown, ChevronRight } from '@lucide/svelte';
  import Checkbox from "./Checkbox.svelte";
  import type { EpisodeGroupRow } from "../state/detail-state";
  import { groupLabel } from "../state/detail-state";
  import { computeWatchProgress } from "../state/watch-state";
  import { debouncePush } from "./debounce";
  import { watchStatusColorClass, watchStatusBadgeClass, entryTypeBadgeClass } from "../shared";

  interface Props {
    group: EpisodeGroupRow;
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    defaultOpen?: boolean;
  }

  let { group, rpc, defaultOpen = false }: Props = $props();

  let expanded = $state(false);
  let watchStatus = $state("");
  let localEpisodes = $state<typeof group.episodes>([]);

  $effect(() => {
    expanded = defaultOpen;
    watchStatus = group.watchStatus;
    localEpisodes = group.episodes;
  });

  const WATCH_STATUS_OPTIONS = [
    { value: "watching", label: "Watching" },
    { value: "completed", label: "Completed" },
    { value: "plan_to_watch", label: "Plan to Watch" },
    { value: "on_hold", label: "On Hold" },
    { value: "dropped", label: "Dropped" },
  ];

  const progress = $derived(computeWatchProgress(localEpisodes.map((ep) => ({
    id: ep.id,
    season: group.seasonNumber ?? 1,
    episode: ep.episodeNumber,
    titleEn: ep.titleEn,
    filePath: ep.filePath,
    missing: false,
    watched: ep.watched,
  }))));

  function schedulePush() {
    debouncePush(group.id, () =>
      rpc.request("pushAnime", { groupId: group.id }).catch(() => {}),
    );
  }

  async function handleStatusChange(newStatus: string) {
    watchStatus = newStatus;
    try {
      await rpc.request("updateGroupStatus", { groupId: group.id, status: newStatus });
      schedulePush();
    } catch (err) {
      console.error("Failed to update group status:", err);
      watchStatus = group.watchStatus;
    }
  }

  async function toggleEpisodeWatched(episodeId: string) {
    const ep = localEpisodes.find((e) => e.id === episodeId);
    if (!ep) return;

    const newWatched = !ep.watched;
    localEpisodes = localEpisodes.map((e) =>
      e.id === episodeId ? { ...e, watched: newWatched } : e
    );

    try {
      await rpc.request("toggleEpisodeWatched", { episodeId, watched: newWatched });
      schedulePush();
    } catch (err) {
      console.error("Failed to toggle episode watched:", err);
      localEpisodes = group.episodes;
    }
  }

  async function updateEpisodeNotes(episodeId: string, notes: string) {
    localEpisodes = localEpisodes.map((e) =>
      e.id === episodeId ? { ...e, notes } : e
    );

    try {
      await rpc.request("updateEpisodeNotes", { episodeId, notes });
      schedulePush();
    } catch (err) {
      console.error("Failed to update episode notes:", err);
      localEpisodes = group.episodes;
    }
  }
</script>

<div class="card preset-outlined-surface-300-700 rounded-xl overflow-hidden">
  <button
    type="button"
    class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-100-900/50 transition-colors"
    onclick={() => expanded = !expanded}
  >
    {#if expanded}
      <ChevronDown class="size-4 text-surface-600-400 shrink-0" />
    {:else}
      <ChevronRight class="size-4 text-surface-600-400 shrink-0" />
    {/if}

    <span class="font-medium text-surface-950-50">{groupLabel(group)}</span>

    <span class={entryTypeBadgeClass(group.entryType)}>
      {group.entryType.toUpperCase()}
    </span>

    <span class={watchStatusBadgeClass(watchStatus)}>
      {watchStatus.replace(/_/g, ' ')}
    </span>

    <div class="flex-1"></div>

    {#if group.episodes.length > 0}
      <span class="text-sm text-primary-600-400">
        {group.onDiskCount}/{group.episodes.length} on disk
      </span>
    {/if}

    {#if progress.total > 0}
      <span class="text-sm text-surface-700-300">
        {progress.watched}/{progress.total}
      </span>
      <progress class="progress w-20" value={progress.percent} max="100"></progress>
      <span class="text-sm text-surface-600-400">{progress.percent}%</span>
    {/if}
  </button>

  {#if expanded}
    <div class="border-t border-surface-300-700">
      <div class="p-4 space-y-4">
        <div class="flex items-center gap-4">
          {#if group.coverArt}
            <div class="w-20 shrink-0 aspect-2/3 rounded-lg overflow-hidden">
              <img src={group.coverArt} alt={groupLabel(group)} class="w-full h-full object-cover" />
            </div>
          {/if}

          <div class="flex-1 space-y-3">
            <div class="flex items-center gap-3">
              <label for={`status-${group.id}`} class="text-sm text-surface-700-300">Status:</label>
              <select
                id={`status-${group.id}`}
                class="select preset-outlined-surface-300-700 rounded-lg text-sm py-1 px-2"
                value={watchStatus}
                onchange={(e) => handleStatusChange((e.target as HTMLSelectElement).value)}
              >
                {#each WATCH_STATUS_OPTIONS as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
              <span class={watchStatusColorClass(watchStatus)}>
                {progress.percent}% watched
              </span>
            </div>

            {#if group.synopsis}
              <div class="text-sm text-surface-700-300 line-clamp-3">
                {group.synopsis}
              </div>
            {/if}

            {#if group.rating !== undefined}
              <div class="flex items-center gap-2">
                <span class="text-sm text-surface-700-300">Rating:</span>
                <span class="text-sm font-medium text-surface-950-50">{group.rating.toFixed(1)}</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th class="font-medium w-16">Episode</th>
                <th class="font-medium">Title</th>
                <th class="font-medium">File Path</th>
                <th class="font-medium text-center w-16">Watched</th>
                <th class="font-medium">Notes</th>
              </tr>
            </thead>
            <tbody class="[&>tr]:hover:preset-tonal-primary">
              {#each localEpisodes as ep (ep.id)}
                <tr class="{ep.filePath ? '' : 'text-surface-600-400 opacity-60'}">
                  <td class="text-sm font-medium whitespace-nowrap">
                    E{String(ep.episodeNumber).padStart(2, "0")}
                    {#if !ep.filePath}
                      <span class="badge preset-tonal-warning ml-2 text-xs">Missing</span>
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
                    <Checkbox
                      checked={ep.watched}
                      onchange={() => toggleEpisodeWatched(ep.id)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      class="input text-sm w-full"
                      placeholder="Add a note..."
                      value={ep.notes ?? ''}
                      onblur={(e) => updateEpisodeNotes(ep.id, (e.target as HTMLInputElement).value)}
                      onkeydown={(e) => {
                        if (e.key === 'Enter') {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  {/if}
</div>
