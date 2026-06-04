<script lang="ts">
  import { FolderSearch, LoaderCircle, ScanSearch, X } from '@lucide/svelte';
  import type { ReviewPlan } from "@kogoro/core";
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveBreakdown,
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";
  import {
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
    scanProgressState: ScanProgressState | null;
    onScanStarted: () => void;
    reviewReady: boolean;
    onViewResults: () => void;
    onMessage: (handler: (message: string, data: unknown) => void) => () => void;
    onBatchReviewResults: (plan: ReviewPlan) => void;
  }

  let {
    rpc,
    scanProgressState,
    onScanStarted,
    reviewReady = false,
    onViewResults,
    onMessage,
    onBatchReviewResults,
  }: Props = $props();

  let listContainer: HTMLDivElement | undefined = $state();
  let requesting = $state(false);
  let enrichedFolders: EnrichedFolder[] = $state([]);
  let removing: string | null = $state(null);
  let dragOver = $state(false);
  let batchScanProgress: BatchScanProgress | null = $state(null);
  let scanningFolderPath: string | null = $state(null);
  let perFolderPlans: Map<string, ReviewPlan> = new Map();
  let scanSummaries: ScanSummaryEntry[] = $state([]);
  let showBatchSummary = $state(false);
  let pendingScanResolve: ((plan: ReviewPlan | null) => void) | null = null;

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
      perFolderPlans.delete(path);
      scanSummaries = deriveScanSummaries(perFolderPlans, enrichedFolders);
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

    perFolderPlans = new Map();
    showBatchSummary = false;
    scanSummaries = [];
    const total = selected.length;
    const first = selected[0]!;

    const unregister = onMessage((msg, data) => {
      if (msg === "scanReviewReady" && pendingScanResolve) {
        const event = data as { sessionId: string; plan: ReviewPlan };
        pendingScanResolve(event.plan);
        pendingScanResolve = null;
      }
    });

    batchScanProgress = {
      currentIndex: 0,
      total,
      currentPath: first.path,
      currentBasename: first.basename,
      isComplete: false,
    };

    for (let i = 0; i < selected.length; i++) {
      const folder = selected[i]!;
      scanningFolderPath = folder.path;
      batchScanProgress = {
        currentIndex: i,
        total,
        currentPath: folder.path,
        currentBasename: folder.basename,
        isComplete: false,
      };

      onScanStarted();

      const plan = await new Promise<ReviewPlan | null>((resolve) => {
        pendingScanResolve = resolve;
        rpc.request("scanStart", { path: folder.path }).catch(() => {
          pendingScanResolve = null;
          resolve(null);
        });
      });

      if (plan) {
        perFolderPlans.set(folder.path, plan);
        enrichedFolders = enrichedFolders.map((f) =>
          f.path === folder.path
            ? {
                ...f,
                status: "indexed" as const,
                lastScannedAt: new Date().toISOString(),
                relativeTimestamp: "just now",
              }
            : f,
        );
      }
    }

    unregister();
    scanningFolderPath = null;
    batchScanProgress = { ...batchScanProgress, isComplete: true };
    scanSummaries = deriveScanSummaries(perFolderPlans, enrichedFolders);
    showBatchSummary = true;
  }

  async function handleReviewBatchResults() {
    const plans = Array.from(perFolderPlans.values());
    const merged = mergeReviewPlans(plans);
    onBatchReviewResults(merged);
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
  const isBatchScanning = $derived(batchScanProgress !== null && !(batchScanProgress as BatchScanProgress).isComplete);
  const scanSelectedDisabled = $derived(requesting || scanning || isBatchScanning || toolbar.noneSelected);
</script>

<div class="flex flex-col h-full p-4 gap-4">
  {#if isBatchScanning && batchScanProgress}
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-surface-700-300">
          Scanning {batchScanProgress.currentIndex + 1}/{batchScanProgress.total} — {batchScanProgress.currentBasename}
        </span>
      </div>
      <progress class="progress"></progress>
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
            disabled={isBatchScanning}
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
              disabled={!folder.exists || isBatchScanning}
              aria-label="Select {folder.basename}"
              onchange={() => handleToggleFolder(folder.path)}
            />
            <div class="flex-1 min-w-0">
              <span class="text-sm text-surface-950-50 truncate block">{folder.path}</span>
              {#if scanningFolderPath === folder.path || (isBatchScanning && scanningFolderPath === null)}
                <span class="badge preset-tonal-primary text-xs mt-1">
                  <LoaderCircle class="size-3 animate-spin inline mr-1" />
                  Scanning...
                </span>
              {:else if folder.status === "missing"}
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
              disabled={removing === folder.path || isBatchScanning}
              aria-label="Remove tracked folder"
            >
              <X class="size-4" />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if !isBatchScanning && scanning && scanProgressState}
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
  {:else if showBatchSummary && scanSummaries.length > 0}
    <div class="space-y-3">
      <div class="space-y-1">
        <span class="text-sm font-medium text-surface-700-300">Scan Complete</span>
        <div class="space-y-1">
          {#each scanSummaries as summary}
            <div class="card preset-outlined-surface-300-700 p-3">
              <span class="text-sm text-surface-950-50 block truncate">{summary.basename}</span>
              <span class="text-xs text-surface-600-400">{summary.fileCount} files, {summary.matchCount} matched</span>
            </div>
          {/each}
        </div>
      </div>
      <button
        type="button"
        class="btn preset-filled-primary-500 rounded-lg font-medium w-full"
        onclick={handleReviewBatchResults}
      >
        Review Results
      </button>
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
