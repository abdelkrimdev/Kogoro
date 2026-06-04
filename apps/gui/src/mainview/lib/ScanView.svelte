<script lang="ts">
  import { FolderSearch, ScanSearch, X } from '@lucide/svelte';
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveBreakdown,
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";
  import {
    deriveScanFolders,
    deriveScanToolbar,
    toggleAll,
    toggleFolder,
    type EnrichedFolder,
  } from "../state/scan-state";

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
  let enrichedFolders: EnrichedFolder[] = $state([]);
  let removing: string | null = $state(null);
  let dragOver = $state(false);

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
      const raw = (await rpc.request("getWatchedFolders", {})) as TrackedFolder[];
      enrichedFolders = deriveScanFolders(raw);
    } catch {}
  }

  async function startScan() {
    try {
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;

      await rpc.request("addWatchedFolder", { path: result.path });
      await loadTrackedFolders();

      onScanStarted();
      await rpc.request("scanStart", { path: result.path });
    } catch (err) {
      console.error("Failed to start scan:", err);
    }
  }

  async function handleRemove(path: string) {
    try {
      removing = path;
      await rpc.request("removeWatchedFolder", { path });
      enrichedFolders = enrichedFolders.filter((f) => f.path !== path);
    } catch (err) {
      console.error("Failed to remove watched folder:", err);
    } finally {
      removing = null;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function extractFolderPath(filePath: string): string {
    const separator = filePath.includes("\\") ? "\\" : "/";
    const lastSep = filePath.lastIndexOf(separator);
    return lastSep > 0 ? filePath.substring(0, lastSep) : filePath;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // @ts-expect-error - Electrobun runtime adds `path` to File objects
    const filePath: string | undefined = files[0].path;
    if (!filePath) return;

    try {
      await rpc.request("addWatchedFolder", { path: extractFolderPath(filePath) });
      await loadTrackedFolders();
    } catch (err) {
      console.error("Failed to add watched folder via drop:", err);
    }
  }

  function handleToggleFolder(path: string) {
    enrichedFolders = toggleFolder(enrichedFolders, path);
  }

  function handleToggleAll() {
    enrichedFolders = toggleAll(enrichedFolders);
  }

  async function scanSelected() {
    const selected = enrichedFolders.filter((f) => f.selected && f.exists);
    if (selected.length === 0) return;
    try {
      requesting = true;
      onScanStarted();
      for (const folder of selected) {
        await rpc.request("scanStart", { path: folder.path });
      }
    } catch (err) {
      console.error("Failed to start selected scans:", err);
    } finally {
      requesting = false;
    }
  }

  const scanning = $derived(scanProgressState !== null);
  const progressPercent = $derived(scanProgressState ? deriveProgressPercent(scanProgressState) : 0);
  const indeterminate = $derived(scanProgressState ? isIndeterminate(scanProgressState) : false);
  const breakdown = $derived(scanProgressState ? deriveBreakdown(scanProgressState) : null);
  const hasTrackedFolders = $derived(enrichedFolders.length > 0);
  const dropZoneLayout = $derived(hasTrackedFolders ? 'p-3' : 'flex-1 flex flex-col items-center justify-center p-8');
  const dropZoneIconSize = $derived(hasTrackedFolders ? 'size-8' : 'size-16');
  const dropZoneTextStyle = $derived(hasTrackedFolders ? 'text-xs mt-1' : 'text-sm mt-3');
  const dropZoneHighlight = $derived(dragOver ? 'border-primary-500 bg-primary-500/10' : '');
  const toolbar = $derived(deriveScanToolbar(enrichedFolders));
  const scanSelectedDisabled = $derived(requesting || scanning || toolbar.noneSelected);
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
        <div class="card preset-outlined-surface-300-700 flex items-center gap-3 px-3 py-2">
          <label class="flex items-center gap-2 text-xs text-surface-700-300 cursor-pointer select-none">
            <input
              type="checkbox"
              class="checkbox"
              checked={toolbar.allSelected}
              bind:indeterminate={toolbar.someSelected}
              onchange={handleToggleAll}
            />
            Select All
          </label>
          <span class="text-xs text-surface-600-400 flex-1">
            {toolbar.selectableCount} folder{toolbar.selectableCount !== 1 ? "s" : ""}
          </span>
          <button
            type="button"
            class="btn preset-filled-primary-500 rounded-lg font-medium text-xs"
            onclick={scanSelected}
            disabled={scanSelectedDisabled}
          >
            <ScanSearch class="size-3.5" />
            Scan Selected
          </button>
        </div>
        <div class="space-y-1">
          {#each enrichedFolders as folder (folder.path)}
            <div class="card preset-outlined-surface-300-700 flex items-center gap-2 p-3">
              <input
                type="checkbox"
                class="checkbox shrink-0"
                checked={folder.selected}
                disabled={!folder.exists}
                aria-label="Select {folder.basename}"
                onchange={() => handleToggleFolder(folder.path)}
              />
              <div class="flex-1 min-w-0">
                <span class="text-sm text-surface-950-50 truncate block">{folder.path}</span>
                {#if folder.status === "missing"}
                  <span class="badge preset-tonal-warning text-xs mt-1">Missing</span>
                {:else if folder.status === "indexed"}
                  <span class="badge preset-tonal-success text-xs mt-1">Indexed</span>
                {:else}
                  <span class="badge preset-tonal-surface text-xs mt-1">New</span>
                {/if}
              </div>
              <button
                type="button"
                class="btn-icon preset-tonal-surface rounded-lg shrink-0"
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

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="border-2 border-dashed border-surface-400-500 rounded-lg text-center cursor-pointer transition-colors {dropZoneLayout} {dropZoneHighlight}"
      role="button"
      tabindex="0"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={startScan}
      onkeydown={(e) => e.key === 'Enter' || e.key === ' ' ? startScan() : null}
    >
      <FolderSearch class="text-surface-600-400 mx-auto {dropZoneIconSize}" />
      <p class="text-surface-600-400 {dropZoneTextStyle}">
        Drop a folder here or click to browse
      </p>
    </div>
  </div>
{/if}
