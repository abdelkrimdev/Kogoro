<script lang="ts">
  import { FolderSearch, LoaderCircle, ScanSearch, X } from '@lucide/svelte';
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveBreakdown,
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";
  import type { ReviewPlan } from "@kogoro/core";
  import {
    deriveBatchProgress,
    deriveScanFolders,
    deriveScanSummaries,
    deriveScanToolbar,
    mergeReviewPlans,
    toggleAll,
    toggleFolder,
    type BatchScanProgress,
    type EnrichedFolder,
    type ScanSummaryEntry,
  } from "../state/scan-state";

  interface TrackedFolder {
    path: string;
    addedAt: string;
    lastScannedAt?: string;
    exists: boolean;
  }

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => () => void;
    scanProgressState: ScanProgressState | null;
    onScanStarted: () => void;
    reviewReady: boolean;
    onViewResults: () => void;
    onBatchReviewResults: (plan: ReviewPlan) => void;
  }

  let { rpc, onMessage, scanProgressState, onScanStarted, reviewReady = false, onViewResults, onBatchReviewResults }: Props = $props();

  let listContainer: HTMLDivElement | undefined = $state();
  let enrichedFolders: EnrichedFolder[] = $state([]);
  let removing: string | null = $state(null);
  let dragOver = $state(false);
  let batchScanning = $state(false);
  let batchProgress: BatchScanProgress | null = $state(null);
  let showSummary = $state(false);
  let perFolderPlans = $state<Map<string, ReviewPlan>>(new Map());
  let scanSummaries = $state<ScanSummaryEntry[]>([]);

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
    showSummary = false;
  }

  function handleToggleAll() {
    enrichedFolders = toggleAll(enrichedFolders);
    showSummary = false;
  }

  async function scanSelected() {
    const selected = enrichedFolders.filter((f) => f.selected && f.exists);
    if (selected.length === 0) return;
    try {
      batchScanning = true;
      showSummary = false;
      perFolderPlans = new Map();

      enrichedFolders = enrichedFolders.map((f) =>
        f.selected && f.exists ? { ...f, batchStatus: "pending" as const } : f,
      );

      for (const folder of selected) {
        batchProgress = deriveBatchProgress(enrichedFolders, folder.path);

        enrichedFolders = enrichedFolders.map((f) =>
          f.path === folder.path ? { ...f, batchStatus: "scanning" as const } : f,
        );

        onScanStarted();

        const result = (await rpc.request("scanStart", { path: folder.path })) as {
          sessionId: string;
        } | null;
        if (!result) { continue; }

        await new Promise<void>((resolve) => {
          const unsub = onMessage((message, data) => {
            if (message === "scanReviewReady") {
              const event = data as { sessionId: string; plan: ReviewPlan };
              if (event.sessionId === result.sessionId) {
                perFolderPlans.set(folder.path, event.plan);
                unsub();
                resolve();
              }
            }
          });
        });

        const now = new Date().toISOString();
        enrichedFolders = enrichedFolders.map((f) =>
          f.path === folder.path
            ? {
                ...f,
                batchStatus: "completed" as const,
                lastScannedAt: now,
                status: "indexed" as const,
              }
            : f,
        );

        await rpc.request("markWatchedFolderScanned", { path: folder.path }).catch(() => {});
      }

      scanSummaries = deriveScanSummaries(perFolderPlans, enrichedFolders);
      batchScanning = false;
      batchProgress = null;
      showSummary = true;
    } catch (err) {
      console.error("Batch scan failed:", err);
      batchScanning = false;
      batchProgress = null;
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
  const scanSelectedDisabled = $derived(scanning || batchScanning || toolbar.noneSelected);
</script>

{#snippet statusBadge(folder: EnrichedFolder)}
  {#if folder.status === "missing"}
    <span class="badge preset-tonal-warning text-xs mt-1">Missing</span>
  {:else if folder.status === "indexed"}
    <span class="badge preset-tonal-success text-xs mt-1">Indexed</span>
  {:else}
    <span class="badge preset-tonal-surface text-xs mt-1">New</span>
  {/if}
{/snippet}

{#if batchScanning}
  <div class="flex flex-col h-full p-4 gap-3">
    {#if batchProgress}
      <div class="space-y-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-surface-700-300">
            Scanning {batchProgress.current}/{batchProgress.total} — {batchProgress.folderBasename}
          </span>
          <span class="text-xs text-surface-600-400">
            {batchProgress.current}/{batchProgress.total}
          </span>
        </div>
        <progress class="progress" value={batchProgress.total > 0 ? ((batchProgress.current - 1) / batchProgress.total) * 100 : 0} max="100"></progress>
      </div>
    {/if}
    <div class="space-y-1 flex-1 overflow-y-auto">
      {#each enrichedFolders as folder (folder.path)}
        <div class="card preset-outlined-surface-300-700 flex items-center gap-2 p-3">
          <input
            type="checkbox"
            class="checkbox shrink-0"
            checked={folder.selected}
            disabled={true}
            aria-label="Select {folder.basename}"
          />
          <div class="flex-1 min-w-0">
            <span class="text-sm text-surface-950-50 truncate block">{folder.path}</span>
            {#if folder.batchStatus === "scanning"}
              <div class="flex items-center gap-1 mt-1">
                <LoaderCircle class="size-3 animate-spin text-primary-500-400" />
                <span class="text-xs text-surface-600-400">Scanning...</span>
              </div>
            {:else if folder.batchStatus === "completed"}
              <span class="badge preset-tonal-success text-xs mt-1">Indexed</span>
            {:else if folder.batchStatus === "pending"}
              <span class="badge preset-tonal-surface text-xs mt-1">Pending</span>
            {:else}
              {@render statusBadge(folder)}
            {/if}
          </div>
          <button
            type="button"
            class="btn-icon preset-tonal-surface rounded-lg shrink-0"
            onclick={() => handleRemove(folder.path)}
            disabled={true}
            aria-label="Remove tracked folder"
          >
            <X class="size-4" />
          </button>
        </div>
      {/each}
    </div>
  </div>
{:else if scanning && scanProgressState && !showSummary}
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
    {#if showSummary}
      <div class="card preset-filled-success-100-900 p-4 space-y-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-surface-950-50">Batch scan complete</span>
        </div>
        <div class="space-y-1">
          {#each scanSummaries as summary}
            <div class="flex items-center justify-between text-xs">
              <span class="text-surface-700-300 truncate">{summary.basename}</span>
              <span class="text-surface-600-400 shrink-0">{summary.matchCount}/{summary.fileCount} matched</span>
            </div>
          {/each}
        </div>
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium w-full"
          onclick={() => onBatchReviewResults(mergeReviewPlans([...perFolderPlans.values()]))}
        >
          Review Results
        </button>
      </div>
    {/if}
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
                {@render statusBadge(folder)}
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
