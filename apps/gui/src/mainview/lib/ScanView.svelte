<script lang="ts">
  import { FolderSearch, X } from '@lucide/svelte';
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveBreakdown,
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";

  interface TrackedFolder {
    path: string;
    addedAt: string;
    lastScannedAt?: string;
    exists: boolean;
  }

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    scanProgressState: ScanProgressState | null;
    onScanStarted: () => void;
    reviewReady: boolean;
    onViewResults: () => void;
  }

  let { rpc, scanProgressState, onScanStarted, reviewReady = false, onViewResults }: Props = $props();

  let listContainer: HTMLDivElement | undefined = $state();
  let requesting = $state(false);
  let trackedFolders: TrackedFolder[] = $state([]);
  let removing: string | null = $state(null);

  $effect(() => {
    if (scanProgressState && listContainer) {
      listContainer.scrollTop = listContainer.scrollHeight;
    }
  });

  $effect(() => {
    loadTrackedFolders();
  });

  async function loadTrackedFolders() {
    try {
      trackedFolders = (await rpc.request("getWatchedFolders", {})) as TrackedFolder[];
    } catch {}
  }

  async function startScan() {
    try {
      requesting = true;
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;

      await rpc.request("addWatchedFolder", { path: result.path });
      await loadTrackedFolders();

      onScanStarted();
      await rpc.request("scanStart", { path: result.path });
    } catch (err) {
      console.error("Failed to start scan:", err);
    } finally {
      requesting = false;
    }
  }

  async function handleRemove(path: string) {
    try {
      removing = path;
      await rpc.request("removeWatchedFolder", { path });
      trackedFolders = trackedFolders.filter((f) => f.path !== path);
    } catch (err) {
      console.error("Failed to remove watched folder:", err);
    } finally {
      removing = null;
    }
  }

  const scanning = $derived(scanProgressState !== null);
  const progressPercent = $derived(scanProgressState ? deriveProgressPercent(scanProgressState) : 0);
  const indeterminate = $derived(scanProgressState ? isIndeterminate(scanProgressState) : false);
  const breakdown = $derived(scanProgressState ? deriveBreakdown(scanProgressState) : null);
  const hasTrackedFolders = $derived(trackedFolders.length > 0);
</script>

{#if scanning && scanProgressState}
  <div class="flex flex-col h-full p-4 gap-3">
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-surface-700-300">Scanning</span>
        <span class="text-xs text-surface-600-400">
          {indeterminate ? "Walking directory..." : `${scanProgressState.completed} / ${scanProgressState.total} files`}
        </span>
      </div>
      {#if indeterminate}
        <progress class="progress"></progress>
      {:else}
        <progress class="progress" value={progressPercent} max="100"></progress>
      {/if}
    </div>
    {#if reviewReady && breakdown}
      <div class="flex items-center justify-center gap-4 py-2">
        <span class="badge preset-tonal-success text-xs">{breakdown.matchedCount} matched</span>
        <span class="badge preset-tonal-warning text-xs">{breakdown.ambiguousCount} ambiguous</span>
        <span class="badge preset-tonal-error text-xs">{breakdown.failedCount} failed</span>
      </div>
      <button
        type="button"
        class="btn preset-filled-primary-500 rounded-lg font-medium w-full"
        onclick={onViewResults}
      >
        View Results
      </button>
    {/if}
    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      <div class="text-xs font-medium text-surface-600-400 mb-1 shrink-0">Files</div>
      <div
        bind:this={listContainer}
        class="flex-1 overflow-y-auto space-y-1 min-h-0"
      >
        {#each scanProgressState.entries as entry}
          <div class="flex items-center justify-between gap-2 text-xs py-0.5">
            <span class="truncate text-surface-700-300">{entry.file}</span>
            <span class="badge shrink-0 {getStatusColor(entry.status)}">{entry.status}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <div class="flex flex-col h-full p-4 gap-4">
    {#if hasTrackedFolders}
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-medium text-surface-600-400">Tracked Folders</span>
        </div>
        <div class="space-y-1">
          {#each trackedFolders as folder (folder.path)}
            <div class="card preset-outlined-surface-300-700 flex items-center justify-between p-3">
              <div class="flex-1 min-w-0">
                <span class="text-sm text-surface-950-50 truncate block">{folder.path}</span>
                {#if !folder.exists}
                  <span class="badge preset-tonal-warning text-xs mt-1">Missing</span>
                {:else if folder.lastScannedAt}
                  <span class="badge preset-tonal-success text-xs mt-1">Indexed</span>
                {:else}
                  <span class="badge preset-tonal-surface text-xs mt-1">New</span>
                {/if}
              </div>
              <button
                type="button"
                class="btn-icon preset-tonal-surface rounded-lg ml-2 shrink-0"
                onclick={() => handleRemove(folder.path)}
                disabled={removing === folder.path}
                aria-label="Remove tracked folder"
              >
                <X class="size-4" />
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    <div class="flex items-center justify-center">
      <div class="text-center space-y-4">
        <FolderSearch class="size-16 text-surface-600-400 mx-auto" />
        <p class="text-surface-600-400 text-sm">Select a folder to scan for anime files.</p>
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium"
          onclick={startScan}
          disabled={requesting}
        >
          Start Scan
        </button>
      </div>
    </div>
  </div>
{/if}
