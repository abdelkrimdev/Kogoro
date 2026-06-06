<script lang="ts">
  import { FolderSearch, ScanSearch, X } from '@lucide/svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import Checkbox from "./Checkbox.svelte";
  import type { ScanProgressState } from "../state/scan-progress-state";
  import {
    deriveProgressPercent,
    getStatusColor,
    isIndeterminate,
  } from "../state/scan-progress-state";
  import type { ReviewPlan, ScanFileStatus } from "@kogoro/core";
  import type { ScanProgressEntry } from "../state/scan-progress-state";
  import type { WatchedFolder } from "../../shared/types";
  import {
    deriveScanFolders,
    deriveScanToolbar,
    toggleAll,
    toggleFolder,
    type EnrichedFolder,
    type ScanSummaryEntry,
  } from "../state/scan-state";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onMessage: (handler: (message: string, data: unknown) => void) => () => void;
    scanProgressState: ScanProgressState | null;
    reviewReady: boolean;
    onViewResults: () => void;
    onDismiss: () => void;
    isBatchScanning: boolean;
    currentScanFolder: string | null;
    batchFolderProgress: { current: number; total: number } | null;
    showSummary: boolean;
    scanSummaries: ScanSummaryEntry[];
    onBatchScanStarted: (folderCount: number) => void;
    onBatchFolderStarted: (folderPath: string, folderBasename: string) => void;
    onBatchFolderComplete: (folderPath: string, plan: ReviewPlan) => void;
    onBatchScanComplete: (folders: { path: string; basename: string }[]) => void;
  }

  let {
    rpc,
    onMessage,
    scanProgressState,
    reviewReady = false,
    onViewResults,
    onDismiss,
    isBatchScanning,
    currentScanFolder,
    batchFolderProgress,
    showSummary,
    scanSummaries,
    onBatchScanStarted,
    onBatchFolderStarted,
    onBatchFolderComplete,
    onBatchScanComplete,
  }: Props = $props();

  let listContainer: HTMLDivElement | undefined = $state();
  let enrichedFolders: EnrichedFolder[] = $state([]);
  let removing: string | null = $state(null);
  let dragOver = $state(false);
  let forceRescan = $state(false);

  $effect(() => {
    if (scanProgressState && listContainer) {
      listContainer.scrollTop = listContainer.scrollHeight;
    }
  });

  $effect(() => {
    loadWatchedFolders();
  });

  async function loadWatchedFolders() {
    try {
      const raw = (await rpc.request("getWatchedFolders", {})) as WatchedFolder[];
      enrichedFolders = deriveScanFolders(raw);
    } catch {}
  }

  async function startScan() {
    try {
      const result = (await rpc.request("openDirectoryPicker", {})) as { path: string } | null;
      if (!result) return;

      await rpc.request("addWatchedFolder", { path: result.path });
      await loadWatchedFolders();
    } catch (err) {
      console.error("Failed to add folder:", err);
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
      await loadWatchedFolders();
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
      onBatchScanStarted(selected.length);

      for (const folder of selected) {
        onBatchFolderStarted(folder.path, folder.basename);

        const result = (await rpc.request("scanStart", { path: folder.path, force: forceRescan })) as {
          sessionId: string;
        } | null;
        if (!result) { continue; }

        await new Promise<void>((resolve) => {
          const unsub = onMessage((message, data) => {
            if (message === "scanReviewReady") {
              const event = data as { sessionId: string; plan: ReviewPlan };
              if (event.sessionId === result.sessionId) {
                onBatchFolderComplete(folder.path, event.plan);
                unsub();
                resolve();
              }
            }
          });
        });

        await rpc.request("markWatchedFolderScanned", { path: folder.path }).catch(() => {});
      }

      onBatchScanComplete(selected.map((f) => ({ path: f.path, basename: f.basename })));
    } catch (err) {
      console.error("Batch scan failed:", err);
    }
  }

  const scanning = $derived(scanProgressState !== null || isBatchScanning);
  const progressPercent = $derived(scanProgressState ? deriveProgressPercent(scanProgressState) : 0);
  const indeterminate = $derived(scanProgressState ? isIndeterminate(scanProgressState) : false);
  const hasWatchedFolders = $derived(enrichedFolders.length > 0);
  const dropZoneHighlight = $derived(dragOver ? 'border-primary-500 bg-primary-500/10' : '');
  const toolbar = $derived(deriveScanToolbar(enrichedFolders));
  const scanSelectedDisabled = $derived(scanning || toolbar.noneSelected);

  const totalBreakdown = $derived({
    matched: scanSummaries.reduce((sum, s) => sum + s.matchCount, 0),
    ambiguous: scanSummaries.reduce((sum, s) => sum + s.ambiguousCount, 0),
    failed: scanSummaries.reduce((sum, s) => sum + s.failedCount, 0),
  });
  const allOrganized = $derived(
    showSummary && totalBreakdown.matched + totalBreakdown.ambiguous + totalBreakdown.failed === 0
  );

  function fileName(filePath: string): string {
    const sep = filePath.includes("\\") ? "\\" : "/";
    return filePath.split(sep).pop() ?? filePath;
  }

  function fileBorderColor(status: ScanFileStatus): string {
    switch (status) {
      case "matched": return "border-l-success-500-400";
      case "cached": return "border-l-primary-500-400";
      case "ambiguous": return "border-l-warning-500-400";
      case "failed": return "border-l-error-500-400";
      default: return "border-l-surface-400-600";
    }
  }
</script>

{#snippet statusBadge(folder: EnrichedFolder)}
  {#if folder.status === "missing"}
    <span class="badge preset-tonal-warning text-xs">Missing</span>
  {:else if folder.status === "indexed"}
    <span class="badge preset-tonal-success text-xs">Indexed</span>
  {:else}
    <span class="badge preset-tonal-surface text-xs">New</span>
  {/if}
{/snippet}

{#snippet fileEntry(entry: ScanProgressEntry)}
  <div class="flex items-center justify-between gap-2 text-xs py-0.5 pl-2 border-l-2 {fileBorderColor(entry.status)}">
    <span class="truncate text-surface-700-300">{fileName(entry.file)}</span>
    <span class="badge shrink-0 {getStatusColor(entry.status)}">{entry.status}</span>
  </div>
{/snippet}

{#snippet folderList()}
  {#if hasWatchedFolders}
    <div class="flex items-center gap-3 px-4 pt-4 pb-2">
      <button
        type="button"
        class="flex items-center gap-2 text-xs text-surface-700-300 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-pressed={toolbar.allSelected}
        aria-label="Select All"
        onclick={handleToggleAll}
      >
        <Checkbox
          checked={toolbar.allSelected ? true : toolbar.someSelected ? null : false}
          onchange={handleToggleAll}
        />
        Select All
      </button>
      <span class="text-xs text-surface-600-400 flex-1">
        {toolbar.selectableCount} folder{toolbar.selectableCount !== 1 ? "s" : ""}
      </span>
      <Switch checked={forceRescan} onCheckedChange={(d) => forceRescan = d.checked}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label class="text-xs text-surface-600-400 cursor-pointer select-none">Force</Switch.Label>
        <Switch.HiddenInput />
      </Switch>
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

    <div class="flex-1 overflow-y-auto min-h-0 px-4 space-y-1">
      {#each enrichedFolders as folder (folder.path)}
        <label
          class="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-100-900 transition-colors group w-full cursor-pointer"
        >
          <Checkbox
            checked={folder.selected}
            disabled={!folder.exists}
            onchange={() => folder.exists && handleToggleFolder(folder.path)}
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-surface-950-50 truncate">{folder.basename}</span>
              {@render statusBadge(folder)}
            </div>
            <div class="flex items-center gap-1.5 text-xs text-surface-600-400 mt-0.5">
              <span class="truncate">{folder.path}</span>
              {#if folder.status === "indexed" && folder.relativeTimestamp}
                <span class="shrink-0">&middot;</span>
                <span class="shrink-0">{folder.relativeTimestamp}</span>
              {/if}
            </div>
          </div>
          <button
            type="button"
            class="btn-icon preset-tonal-surface rounded-lg shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onclick={() => handleRemove(folder.path)}
            disabled={removing === folder.path}
            aria-label="Remove tracked folder"
          >
            <X class="size-4" />
          </button>
        </label>
      {/each}
    </div>

    <button
      type="button"
      class="border-t border-surface-300-700 text-center cursor-pointer transition-colors shrink-0 py-4 w-full {dropZoneHighlight} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t-none"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={startScan}
    >
      <FolderSearch class="text-surface-600-400 mx-auto size-6" />
      <p class="text-surface-600-400 text-xs mt-1">
        Drop a folder here or click to browse
      </p>
    </button>
  {:else}
    <button
      type="button"
      class="flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-400-500 rounded-lg m-4 text-center cursor-pointer transition-colors {dropZoneHighlight} focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      ondrop={handleDrop}
      onclick={startScan}
    >
      <FolderSearch class="text-surface-600-400 mx-auto size-16" />
      <p class="text-surface-600-400 text-sm mt-3">
        Drop a folder here or click to browse
      </p>
      <p class="text-surface-500-500 text-xs mt-1">
        Kogoro will scan and match your anime episodes
      </p>
    </button>
  {/if}
{/snippet}

{#if scanning && scanProgressState && !showSummary}
  <div class="flex flex-col h-full p-4 gap-3">
    <div class="space-y-1">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-surface-700-300">
          {#if reviewReady}
            Scan Complete
          {:else if currentScanFolder}
            Scanning {currentScanFolder}
            {#if batchFolderProgress}
              <span class="text-xs text-surface-600-400 font-normal">({batchFolderProgress.current}/{batchFolderProgress.total} folders)</span>
            {/if}
          {:else if indeterminate}
            Preparing...
          {:else}
            Scanning...
          {/if}
        </span>
        <span class="text-xs text-surface-600-400">
          {#if reviewReady}
            {scanProgressState.total} files scanned
          {:else if indeterminate}
            Walking directories...
          {:else}
            {scanProgressState.completed} / {scanProgressState.total} files
          {/if}
        </span>
      </div>
      {#if !reviewReady}
        {#if indeterminate}
          <progress class="progress"></progress>
        {:else}
          <progress class="progress" value={progressPercent} max="100"></progress>
        {/if}
      {/if}
    </div>
    <div class="flex-1 overflow-hidden flex flex-col min-h-0">
      <div
        bind:this={listContainer}
        class="flex-1 overflow-y-auto space-y-1 min-h-0"
      >
        {#each scanProgressState.entries as entry}
          {@render fileEntry(entry)}
        {/each}
      </div>
    </div>
  </div>
{:else if showSummary}
  <div class="flex flex-col h-full">
    <div class="card preset-tonal-primary p-4 space-y-3 mx-4 mt-4">
      {#if allOrganized}
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-surface-950-50">Already organized</span>
          <button type="button" class="btn-icon preset-tonal btn-icon-sm" onclick={onDismiss}>
            <X class="size-4" />
          </button>
        </div>
        <p class="text-xs text-surface-600-400">All files are already at their target locations.</p>
      {:else}
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-surface-950-50">Scan complete</span>
        </div>
        <div class="space-y-1">
          {#each scanSummaries as summary}
            <div class="flex items-center justify-between text-xs">
              <span class="text-surface-700-300 truncate">{summary.basename}</span>
              <span class="text-surface-600-400 shrink-0">{summary.matchCount}/{summary.fileCount} matched</span>
            </div>
          {/each}
        </div>
        <div class="flex items-center justify-center gap-4 py-1">
          <span class="badge preset-tonal-success text-xs">{totalBreakdown.matched} matched</span>
          <span class="badge preset-tonal-warning text-xs">{totalBreakdown.ambiguous} ambiguous</span>
          <span class="badge preset-tonal-error text-xs">{totalBreakdown.failed} failed</span>
        </div>
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium w-full"
          onclick={onViewResults}
        >
          Review Results
        </button>
      {/if}
    </div>

    {@render folderList()}
  </div>
{:else}
  <div class="flex flex-col h-full">
    {@render folderList()}
  </div>
{/if}
