<script lang="ts">
  import { FolderSearch, X, FolderOpen } from '@lucide/svelte';
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveBreakdown,
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";
  import { deriveScanFolders, type EnrichedFolder, type FolderStatus } from "../state/scan-state";
  import type { WatchedFolder } from "../../shared/types";

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
  let folders: EnrichedFolder[] = $state([]);
  let foldersLoaded = $state(false);

  async function loadFolders() {
    try {
      const raw = (await rpc.request("getWatchedFolders", {})) as WatchedFolder[];
      folders = deriveScanFolders(raw);
    } catch {
      folders = [];
    } finally {
      foldersLoaded = true;
    }
  }

  $effect(() => {
    loadFolders();
  });

  async function removeFolder(path: string) {
    try {
      await rpc.request("removeWatchedFolder", { path });
      folders = folders.filter((f) => f.path !== path);
    } catch (err) {
      console.error("Failed to remove folder:", err);
    }
  }

  $effect(() => {
    if (scanProgressState && listContainer) {
      listContainer.scrollTop = listContainer.scrollHeight;
    }
  });

  async function startScan() {
    try {
      requesting = true;
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;
      onScanStarted();
      await rpc.request("scanStart", { path: result.path });
    } catch (err) {
      console.error("Failed to start scan:", err);
    } finally {
      requesting = false;
    }
  }

  const scanning = $derived(scanProgressState !== null);
  const progressPercent = $derived(scanProgressState ? deriveProgressPercent(scanProgressState) : 0);
  const indeterminate = $derived(scanProgressState ? isIndeterminate(scanProgressState) : false);
  const breakdown = $derived(scanProgressState ? deriveBreakdown(scanProgressState) : null);
  const hasFolders = $derived(foldersLoaded && folders.length > 0);

  function folderStatusBadge(status: FolderStatus): string {
    switch (status) {
      case "new":
        return "badge preset-tonal-primary";
      case "indexed":
        return "badge preset-tonal-success";
      case "missing":
        return "badge preset-tonal-error";
    }
  }
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
    {#if hasFolders}
      <div class="text-sm font-medium text-surface-700-300">
        Tracked Folders ({folders.length})
      </div>
      <div class="flex flex-col gap-1">
        {#each folders as folder}
          <div class="flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-surface-200-800">
            <div class="flex items-center gap-2 min-w-0">
              <FolderOpen class="size-4 text-surface-500-500 shrink-0" />
              <span class="text-sm text-surface-700-300 truncate">{folder.basename}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class={folderStatusBadge(folder.status)}>{folder.status}</span>
              {#if folder.relativeTimestamp}
                <span class="text-xs text-surface-600-400">{folder.relativeTimestamp}</span>
              {/if}
              <button
                type="button"
                class="btn-icon preset-tonal-surface size-6"
                onclick={() => removeFolder(folder.path)}
                aria-label="Remove folder"
              >
                <X class="size-3" />
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
    <div class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        {#if !hasFolders}
          <FolderSearch class="size-16 text-surface-600-400 mx-auto" />
          <p class="text-surface-600-400 text-sm">Select a folder to scan for anime files.</p>
        {/if}
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
