<script lang="ts">
  import { ArrowLeft, LoaderCircle, Check, AlertTriangle } from "@lucide/svelte";
  import type { SyncConflictInfo } from "../../shared/types";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    conflicts: SyncConflictInfo[];
    onComplete: () => void;
    onCancel: () => void;
  }

  let { rpc, conflicts: initialConflicts, onComplete, onCancel }: Props = $props();

  let remaining = $state<SyncConflictInfo[]>([]);
  let totalCount = $state(0);
  let resolving = $state<string | null>(null);
  let error = $state<string | null>(null);

  $effect(() => {
    remaining = [...initialConflicts];
    totalCount = initialConflicts.length;
  });

  const allResolved = $derived(remaining.length === 0);
  const resolvedCount = $derived(totalCount - remaining.length);

  function watchStatusLabel(status: string): string {
    switch (status) {
      case "watching": return "Watching";
      case "completed": return "Completed";
      case "plan-to-watch": return "Plan to Watch";
      case "plan_to_watch": return "Plan to Watch";
      case "on-hold": return "On Hold";
      case "on_hold": return "On Hold";
      case "dropped": return "Dropped";
      default: return status;
    }
  }

  function eventStatusLabel(eventType: string, newValue: string): string {
    if (eventType === "status_change") return watchStatusLabel(newValue);
    return newValue;
  }

  function conflictKey(c: SyncConflictInfo): string {
    return `${c.groupId}:${c.tracker}`;
  }

  async function resolve(conflict: SyncConflictInfo, resolution: "keepLocal" | "acceptRemote") {
    resolving = conflictKey(conflict);
    error = null;
    try {
      const result = (await rpc.request("resolveSyncConflict", { conflict, resolution })) as { success: boolean };
      if (result.success) {
        remaining = remaining.filter((c) => conflictKey(c) !== conflictKey(conflict));
      } else {
        error = "Failed to resolve conflict";
      }
    } catch {
      error = "Failed to resolve conflict";
    } finally {
      resolving = null;
    }
  }
</script>

<div class="flex flex-col h-full">
  <header class="h-12 flex items-center border-b border-surface-300-700 shrink-0 px-4 gap-3">
    <button type="button" class="btn-icon preset-tonal-surface" onclick={onCancel}>
      <ArrowLeft class="size-4" />
    </button>
    <span class="text-sm font-medium text-surface-950-50">Sync Conflicts</span>
    {#if totalCount > 0}
      <span class="badge preset-tonal-warning text-xs">{remaining.length} remaining</span>
    {/if}
  </header>

  <div class="flex-1 min-h-0 overflow-auto p-4 space-y-4">
    {#if allResolved}
      <div class="card preset-tonal-surface p-8 text-center">
        <Check class="size-8 text-success-500-400 mx-auto mb-2" />
        <p class="text-surface-950-50 font-medium">All conflicts resolved</p>
        <p class="text-surface-600-400 text-sm mt-1">
          {resolvedCount} conflict{resolvedCount === 1 ? "" : "s"} resolved
        </p>
      </div>
    {:else}
      <div class="card preset-outlined-surface-300-700 p-4">
        <div class="grid grid-cols-2 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-surface-950-50">{totalCount}</p>
            <p class="text-xs text-surface-600-400">Total Conflicts</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-success-500-400">{resolvedCount}</p>
            <p class="text-xs text-surface-600-400">Resolved</p>
          </div>
        </div>
      </div>

      {#if error}
        <div class="card preset-tonal-error p-3 text-center">
          <p class="text-sm text-error-500-400">{error}</p>
        </div>
      {/if}

      <div class="space-y-2">
        {#each remaining as conflict (conflictKey(conflict))}
          <div class="card preset-outlined-error-500 p-3 space-y-2">
            <div class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-surface-950-50 truncate">{conflict.animeTitle}</span>
                  <span class="badge preset-tonal-surface text-xs">{conflict.tracker}</span>
                </div>
                <p class="text-xs text-surface-600-400 mt-1">
                  {eventStatusLabel(conflict.localChange.eventType, conflict.localChange.newValue)}
                  {#if conflict.remoteChange.episodesWatched > 0}
                    &middot; {conflict.remoteChange.episodesWatched} episodes
                  {/if}
                </p>
              </div>
              <AlertTriangle class="size-4 text-error-500-400 shrink-0" />
            </div>

            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-2">
                <span class="text-surface-600-400">Local:</span>
                <span class="badge preset-tonal-surface">{eventStatusLabel(conflict.localChange.eventType, conflict.localChange.newValue)}</span>
              </div>
              <div class="text-surface-600-400">vs</div>
              <div class="flex items-center gap-2">
                <span class="text-surface-600-400">Remote:</span>
                <span class="badge preset-tonal-primary">{watchStatusLabel(conflict.remoteChange.watchStatus)}</span>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-sm preset-tonal-surface rounded-lg text-xs"
                onclick={() => resolve(conflict, "keepLocal")}
                disabled={resolving === conflictKey(conflict)}
              >
                {#if resolving === conflictKey(conflict)}
                  <LoaderCircle class="size-3 animate-spin" />
                {/if}
                Keep Local
              </button>
              <button
                type="button"
                class="btn btn-sm preset-tonal-primary rounded-lg text-xs"
                onclick={() => resolve(conflict, "acceptRemote")}
                disabled={resolving === conflictKey(conflict)}
              >
                {#if resolving === conflictKey(conflict)}
                  <LoaderCircle class="size-3 animate-spin" />
                {/if}
                Accept Remote
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <footer class="border-t border-surface-300-700 p-4 flex items-center justify-end gap-3 shrink-0">
    <button
      type="button"
      class="btn preset-tonal-surface rounded-lg font-medium"
      onclick={onCancel}
    >
      Cancel
    </button>
    <button
      type="button"
      class="btn preset-filled-primary-500 rounded-lg font-medium"
      onclick={onComplete}
      disabled={!allResolved}
    >
      Done
    </button>
  </footer>
</div>
