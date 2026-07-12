<script lang="ts">
  import {
    LoaderCircle,
    Check,
    CheckCircle2,
  } from "@lucide/svelte";
  import { Tabs } from "@skeletonlabs/skeleton-svelte";
  import type { ImportPreviewEntry, ImportResult } from "@kogoro/core";
  import type { RPCClient } from "../shared";
  import { entryTypeLabel } from "../shared";
  import {
    createImportPreviewState,
    type ImportSnapshot,
    type PreviewSummary,
    type TabId,
    type ImportPhase,
    type BulkMode,
  } from "../state/import-preview-state";

  interface Props {
    rpc: RPCClient;
    trackerName: string;
    trackerDisplayName: string;
    onComplete: () => void;
    onCancel: () => void;
  }

  let { rpc, trackerName, trackerDisplayName, onComplete, onCancel }: Props = $props();

  const importState = createImportPreviewState(() => rpc);

  let loading = $state(true);
  let error = $state<string | null>(null);
  let preview = $state<PreviewSummary | null>(null);
  let matched = $state<ImportPreviewEntry[]>([]);
  let unmatched = $state<ImportPreviewEntry[]>([]);
  let conflicts = $state<ImportPreviewEntry[]>([]);
  let activeTab = $state<TabId>("matched");
  let importPhase = $state<ImportPhase>("preview");
  let conflictSelections = $state<Map<string, "keepLocal" | "acceptTracker">>(new Map());
  let bulkMode = $state<BulkMode>(null);
  let result = $state<ImportResult | null>(null);

  const resolvedCount = $derived(
    conflicts.filter((entry) => conflictSelections.has(entry.trackerId)).length,
  );
  const isImportEnabled = $derived(
    conflicts.length === 0 || resolvedCount === conflicts.length,
  );
  const importButtonText = $derived.by(() => {
    if (importPhase === "importing") return "Importing...";
    if (importPhase === "success") return "Done";
    if (resolvedCount < conflicts.length) {
      const remaining = conflicts.length - resolvedCount;
      return remaining === 1
        ? "Resolve 1 conflict to continue"
        : `Resolve ${remaining} conflicts to continue`;
    }
    return "Import";
  });

  function applySnapshot(s: ImportSnapshot) {
    loading = s.loading;
    error = s.error;
    preview = s.preview;
    matched = s.matched;
    unmatched = s.unmatched;
    conflicts = s.conflicts;
    activeTab = s.activeTab;
    importPhase = s.importPhase;
    conflictSelections = s.conflictSelections;
    bulkMode = s.bulkMode;
    result = s.result;
  }

  applySnapshot(importState.snapshot());

  $effect(() => {
    const unsub = importState.onChange(applySnapshot);
    importState.loadPreview(trackerName);
    return unsub;
  });

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

  function statusPreset(status: string): string {
    switch (status) {
      case "watching": return "primary";
      case "completed": return "success";
      case "plan-to-watch":
      case "plan_to_watch": return "warning";
      case "on-hold":
      case "on_hold": return "tertiary";
      case "dropped": return "error";
      default: return "surface";
    }
  }

  const DONUT_CIRCUMFERENCE = 2 * Math.PI * 15;
  const donutOffset = $derived(DONUT_CIRCUMFERENCE - (DONUT_CIRCUMFERENCE * resolvedCount / conflicts.length));

  function conflictOptionClass(
    selection: "keepLocal" | "acceptTracker" | undefined,
    activeResolution: "keepLocal" | "acceptTracker",
  ): string {
    if (selection === activeResolution) {
      return activeResolution === "keepLocal"
        ? "bg-surface-100-900"
        : "bg-primary-500-400/10";
    }
    if (selection !== undefined) {
      return "bg-surface-50-950 opacity-40 hover:opacity-60";
    }
    return "bg-surface-50-950 hover:bg-surface-100-900";
  }
</script>

{#snippet entryCard(entry: ImportPreviewEntry)}
  <div class="card preset-outlined-surface-300-700 px-4 py-3">
    <div class="flex items-center gap-2 mb-1.5">
      <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
      <div class="flex-1"></div>
      <span class="text-xs text-surface-600-400 shrink-0">{entry.episodesWatched}/{entry.totalEpisodes} ep</span>
    </div>
    <div class="flex items-center gap-1.5">
      <span class="badge preset-tonal-{statusPreset(entry.watchStatus)} text-xs">{watchStatusLabel(entry.watchStatus)}</span>
      <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(entry.entryType)}</span>
    </div>
  </div>
{/snippet}

<div class="h-full flex flex-col">
  <div class="px-4 pt-4 pb-3 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-surface-950-50">Import from {trackerDisplayName}</h2>
      <div class="flex gap-2">
        {#if importPhase !== "success" && preview?.totalEntries !== 0}
          <button
            type="button"
            class="btn preset-filled-success-500 rounded-lg font-medium"
            onclick={() => importState.confirmImport(trackerName)}
            disabled={!isImportEnabled || importPhase === "importing"}
          >
            {#if importPhase === "importing"}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            {importButtonText}
          </button>
          <button
            type="button"
            class="btn preset-tonal-surface rounded-lg font-medium"
            onclick={onCancel}
            disabled={importPhase === "importing"}
          >
            Cancel
          </button>
        {/if}
      </div>
    </div>
  </div>

  {#if preview}
    <div class="card preset-outlined-surface-300-700 m-4 p-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div>
          <p class="text-2xl font-bold text-surface-950-50">{preview.totalEntries}</p>
          <p class="text-xs text-surface-600-400">Total Entries</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-success-500-400">{preview.matchedCount}</p>
          <p class="text-xs text-surface-600-400">Matched</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-warning-500-400">{preview.unmatchedCount}</p>
          <p class="text-xs text-surface-600-400">New</p>
        </div>
        <div>
          <p class="text-2xl font-bold text-error-500-400">{preview.conflictCount}</p>
          <p class="text-xs text-surface-600-400">Conflicts</p>
        </div>
      </div>

      {#if preview.totalEntries > 0}
        <div class="flex gap-2 mt-3 justify-center flex-wrap">
          {#each Object.entries(preview.statusCounts) as [status, count]}
            {#if count > 0}
              <span class="badge preset-tonal-{statusPreset(status)} text-sm font-medium px-3 py-1">
                {watchStatusLabel(status)}: {count}
              </span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="text-center space-y-3">
        <LoaderCircle class="size-8 animate-spin text-primary-500-400 mx-auto" />
        <p class="text-surface-600-400 text-sm">Loading preview...</p>
      </div>
    </div>
  {:else if error}
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="card preset-tonal-error p-4 text-center">
        <p class="text-sm text-error-500-400">{error}</p>
        <button type="button" class="btn preset-tonal-surface mt-3 rounded-lg text-sm" onclick={onCancel}>
          Go Back
        </button>
      </div>
    </div>
  {:else if importPhase === "success" && result}
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="card preset-outlined-surface-300-700 p-8 text-center">
        <CheckCircle2 class="size-12 text-success-500-400 mx-auto mb-4" />
        <h3 class="text-xl font-bold text-surface-950-50 mb-2">Import Complete</h3>
        <p class="text-surface-600-400 mb-4">
          Imported {result.imported} entries
          {#if result.skipped > 0}
            ({result.skipped} skipped)
          {/if}
        </p>
        <button type="button" class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={onComplete}>
          Go to Library
        </button>
      </div>
    </div>
  {:else if preview?.totalEntries === 0}
    <div class="flex-1 flex items-center justify-center p-4">
      <div class="card preset-outlined-surface-300-700 p-8 text-center">
        <CheckCircle2 class="size-12 text-success-500-400 mx-auto mb-4" />
        <h3 class="text-xl font-bold text-surface-950-50 mb-2">Nothing to import</h3>
        <p class="text-surface-600-400 mb-4">
          Your tracker is already up to date
        </p>
        <button type="button" class="btn preset-filled-primary-500 rounded-lg font-medium" onclick={onComplete}>
          Go to Library
        </button>
      </div>
    </div>
  {:else if preview}
    <Tabs value={activeTab} onValueChange={(d) => importState.setActiveTab(d.value as TabId)} class="flex flex-col flex-1 min-h-0">
      <Tabs.List class="px-4 pt-2 border-b border-surface-300-700">
        <Tabs.Trigger value="matched">Matched</Tabs.Trigger>
        <Tabs.Trigger value="new">New</Tabs.Trigger>
        <Tabs.Trigger value="conflicts">Conflicts</Tabs.Trigger>
        <Tabs.Indicator />
      </Tabs.List>

      <Tabs.Content value="matched" class="flex-1 overflow-auto p-4">
        {#if matched.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No matched entries
          </div>
        {:else}
          <div class="space-y-2">
            {#each matched as entry (entry.trackerId)}
              {@render entryCard(entry)}
            {/each}
          </div>
        {/if}
      </Tabs.Content>

      <Tabs.Content value="new" class="flex-1 overflow-auto p-4">
        {#if unmatched.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No new entries to import
          </div>
        {:else}
          <div class="space-y-2">
            {#each unmatched as entry (entry.trackerId)}
              {@render entryCard(entry)}
            {/each}
          </div>
        {/if}
      </Tabs.Content>

      <Tabs.Content value="conflicts" class="flex-1 overflow-auto p-4">
        {#if conflicts.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No conflicts
          </div>
        {:else}
          <div class="space-y-4">
            <div class="card preset-outlined-surface-300-700 p-3">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2.5 shrink-0">
                  <div class="relative w-8 h-8">
                    <svg class="size-8 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke-width="3" class="stroke-surface-300-700" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke-width="3" class="stroke-success-500-400" stroke-dasharray={DONUT_CIRCUMFERENCE} stroke-dashoffset={donutOffset} stroke-linecap="round" />
                    </svg>
                    <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-surface-950-50">{resolvedCount}</span>
                  </div>
                  <div class="text-xs text-surface-600-400 leading-tight">
                    <span class="font-semibold text-surface-950-50">{resolvedCount}/{conflicts.length}</span><br />resolved
                  </div>
                </div>
                <div class="flex-1 border-l border-surface-300-700 pl-3">
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5 text-[11px] text-surface-600-400">
                      <span class="inline-block w-2 h-2 rounded-full bg-surface-400-600"></span>
                      Local
                    </div>
                    <div class="flex items-center gap-1.5 text-[11px] text-surface-600-400">
                      Tracker
                      <span class="inline-block w-2 h-2 rounded-full bg-primary-400-600"></span>
                    </div>
                  </div>
                  <div class="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      class="btn btn-sm rounded-lg font-medium flex-1 {bulkMode === 'keepLocal' ? 'preset-filled-surface-700-300' : 'preset-outlined-surface-300-700'}"
                      onclick={() => importState.bulkResolveConflicts("keepLocal")}
                    >
                      Keep All Local
                    </button>
                    <button
                      type="button"
                      class="btn btn-sm rounded-lg font-medium flex-1 {bulkMode === 'acceptTracker' ? 'preset-filled-primary-500' : 'preset-outlined-primary-300-700'}"
                      onclick={() => importState.bulkResolveConflicts("acceptTracker")}
                    >
                      Accept All Tracker
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="space-y-2">
              {#each conflicts as entry (entry.trackerId)}
                {@const selection = conflictSelections.get(entry.trackerId)}
                {@const isResolved = selection !== undefined}
                <div class="card preset-outlined-surface-300-700 overflow-hidden">
                  <div class="px-4 py-3 flex items-center gap-2">
                    <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
                    <div class="flex-1"></div>
                    <span class="text-xs text-surface-600-400 shrink-0">{entry.episodesWatched}/{entry.totalEpisodes} ep</span>
                    {#if isResolved}
                      <Check class="size-4 text-success-500-400 shrink-0" />
                    {/if}
                  </div>
                  <div class="grid grid-cols-2 border-t border-surface-300-700">
                    <button
                      type="button"
                      class="flex items-center gap-2 px-4 py-3 transition-colors cursor-pointer {conflictOptionClass(selection, 'keepLocal')}"
                      onclick={() => importState.resolveConflict(entry.trackerId, "keepLocal")}
                    >
                      <span class="inline-block w-1.5 h-1.5 rounded-full bg-surface-400-600 shrink-0"></span>
                      <span class="text-xs text-surface-600-400 shrink-0">Local</span>
                      <span class="badge preset-tonal-{statusPreset(entry.localWatchStatus ?? '')} text-xs ml-auto">{watchStatusLabel(entry.localWatchStatus ?? "")}</span>
                    </button>
                    <button
                      type="button"
                      class="flex items-center gap-2 px-4 py-3 transition-colors cursor-pointer border-l border-surface-300-700 {conflictOptionClass(selection, 'acceptTracker')}"
                      onclick={() => importState.resolveConflict(entry.trackerId, "acceptTracker")}
                    >
                      <span class="text-xs text-surface-600-400 shrink-0">Tracker</span>
                      <span class="badge preset-tonal-{statusPreset(entry.watchStatus)} text-xs ml-auto">{watchStatusLabel(entry.watchStatus)}</span>
                      <span class="inline-block w-1.5 h-1.5 rounded-full bg-primary-400-600 shrink-0"></span>
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </Tabs.Content>
    </Tabs>
  {/if}
</div>
