<script lang="ts">
  import {
    LoaderCircle,
    Check,
    AlertTriangle,
    CheckCircle2,
  } from "@lucide/svelte";
  import type { ImportPreviewEntry, ImportResult } from "@kogoro/core";
  import type { RPCClient } from "../shared";
  import { entryTypeLabel } from "../shared";
  import {
    createImportPreviewState,
    type ImportSnapshot,
    type PreviewSummary,
    type TabId,
    type ImportPhase,
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

  function tabClass(tab: TabId): string {
    return `btn btn-sm rounded-lg font-medium ${activeTab === tab ? "preset-tonal-primary" : "preset-tonal-surface"}`;
  }

  function conflictButtonClass(resolution: "keepLocal" | "acceptTracker", entryId: string): string {
    const isSelected = conflictSelections.get(entryId) === resolution;
    return `btn btn-sm rounded-lg text-xs ${isSelected ? "preset-filled-primary-500" : "preset-tonal-surface"}`;
  }
</script>

<div class="h-full flex flex-col">
  <div class="px-4 pt-4 pb-3 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-surface-950-50">Import from {trackerDisplayName}</h2>
      <div class="flex gap-2">
        {#if importPhase !== "success"}
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

  <div class="px-4 py-2 border-b border-surface-300-700">
    <div class="flex gap-1">
      <button
        type="button"
        class={tabClass("matched")}
        onclick={() => importState.setActiveTab("matched")}
      >
        Matched
      </button>
      <button
        type="button"
        class={tabClass("new")}
        onclick={() => importState.setActiveTab("new")}
      >
        New ({preview?.unmatchedCount ?? 0})
      </button>
      <button
        type="button"
        class={tabClass("conflicts")}
        onclick={() => importState.setActiveTab("conflicts")}
      >
        Conflicts ({preview?.conflictCount ?? 0})
      </button>
    </div>
  </div>

  <div class="flex-1 overflow-auto p-4 space-y-4">
    {#if loading}
      <div class="flex items-center justify-center h-full">
        <div class="text-center space-y-3">
          <LoaderCircle class="size-8 animate-spin text-primary-500-400 mx-auto" />
          <p class="text-surface-600-400 text-sm">Loading preview...</p>
        </div>
      </div>
    {:else if error}
      <div class="card preset-tonal-error p-4 text-center">
        <p class="text-sm text-error-500-400">{error}</p>
        <button type="button" class="btn preset-tonal-surface mt-3 rounded-lg text-sm" onclick={onCancel}>
          Go Back
        </button>
      </div>
    {:else if importPhase === "success" && result}
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
    {:else if preview}
      {#if activeTab === "matched"}
        {#if matched.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No matched entries
          </div>
        {:else}
          <div class="divide-y divide-surface-300-700">
            {#each matched as entry (entry.trackerId)}
              <div class="flex items-center gap-3 px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <span class="font-medium text-sm text-surface-950-50 truncate block">{entry.title}</span>
                  <p class="text-xs text-surface-600-400 mt-0.5">
                    {entry.episodesWatched}/{entry.totalEpisodes} episodes · {watchStatusLabel(entry.watchStatus)}
                  </p>
                </div>
                <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(entry.entryType)}</span>
                <Check class="size-4 text-success-500-400 shrink-0" />
              </div>
            {/each}
          </div>
        {/if}

      {:else if activeTab === "new"}
        {#if unmatched.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No new entries to import
          </div>
        {:else}
          <div class="divide-y divide-surface-300-700">
            {#each unmatched as entry (entry.trackerId)}
              <div class="flex items-center gap-3 px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <span class="text-sm text-surface-950-50 truncate block">{entry.title}</span>
                  <p class="text-xs text-surface-600-400 mt-0.5">
                    {entry.episodesWatched}/{entry.totalEpisodes} episodes · {watchStatusLabel(entry.watchStatus)}
                  </p>
                </div>
                <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(entry.entryType)}</span>
              </div>
            {/each}
          </div>
        {/if}

      {:else if activeTab === "conflicts"}
        {#if conflicts.length === 0}
          <div class="text-center text-surface-600-400 py-8">
            No conflicts
          </div>
        {:else}
          <div class="flex items-center justify-between mb-4">
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-sm preset-tonal-surface rounded-lg font-medium"
                onclick={() => importState.bulkResolveConflicts("acceptTracker")}
              >
                Accept All Tracker
              </button>
              <button
                type="button"
                class="btn btn-sm preset-tonal-surface rounded-lg font-medium"
                onclick={() => importState.bulkResolveConflicts("keepLocal")}
              >
                Keep All Local
              </button>
            </div>
            <span class="text-sm text-surface-600-400">
              {resolvedCount} of {conflicts.length} resolved
            </span>
          </div>

          <div class="space-y-2">
            {#each conflicts as entry (entry.trackerId)}
              {@const isResolved = conflictSelections.has(entry.trackerId)}
              <div class="card preset-outlined-surface-300-700 p-3 space-y-2 {isResolved ? 'opacity-50' : ''}">
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
                      {#if isResolved}
                        <Check class="size-4 text-success-500-400 shrink-0" />
                      {/if}
                    </div>
                    <p class="text-xs text-surface-600-400 mt-1">
                      {entry.episodesWatched}/{entry.totalEpisodes} episodes
                    </p>
                  </div>
                  {#if !isResolved}
                    <AlertTriangle class="size-4 text-error-500-400 shrink-0" />
                  {/if}
                </div>

                <div class="flex items-center gap-4 text-xs">
                  <div class="flex items-center gap-2">
                    <span class="text-surface-600-400">Local:</span>
                    <span class="badge preset-tonal-surface">{watchStatusLabel(entry.localWatchStatus ?? "")}</span>
                  </div>
                  <div class="text-surface-600-400">vs</div>
                  <div class="flex items-center gap-2">
                    <span class="text-surface-600-400">Tracker:</span>
                    <span class="badge preset-tonal-primary">{watchStatusLabel(entry.watchStatus)}</span>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    type="button"
                    class={conflictButtonClass("keepLocal", entry.trackerId)}
                    onclick={() => importState.resolveConflict(entry.trackerId, "keepLocal")}
                  >
                    Keep Local
                  </button>
                  <button
                    type="button"
                    class={conflictButtonClass("acceptTracker", entry.trackerId)}
                    onclick={() => importState.resolveConflict(entry.trackerId, "acceptTracker")}
                  >
                    Accept Tracker
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}
  </div>
</div>
