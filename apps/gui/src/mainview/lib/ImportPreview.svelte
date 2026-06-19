<script lang="ts">
  import { ArrowLeft, LoaderCircle, Check, Link, AlertTriangle, Search } from "@lucide/svelte";
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";
  import type { ImportPreview, ImportResult } from "@kogoro/core/tracker-import";
  import type { RPCClient } from "../shared";
  import { entryTypeLabel } from "../shared";

  interface Props {
    rpc: RPCClient;
    trackerName: string;
    trackerDisplayName: string;
    onComplete: () => void;
    onCancel: () => void;
  }

  let { rpc, trackerName, trackerDisplayName, onComplete, onCancel }: Props = $props();

  let loading = $state(true);
  let error = $state<string | null>(null);
  let preview = $state<ImportPreview | null>(null);
  let importing = $state(false);
  let result = $state<ImportResult | null>(null);
  let linkSelections = $state<Record<string, number>>({});
  let conflictSelections = $state<Record<string, "keepLocal" | "acceptTracker">>({});

  let showLinkModal = $state(false);
  let linkTarget = $state<{ trackerId: string; title: string } | null>(null);
  let librarySearch = $state("");
  let libraryAnime = $state<Array<{ id: number; title: string; groups: Array<{ id: number; entryType: string; seasonNumber?: number; watchStatus: string }> }>>([]);

  const matchedCount = $derived(preview?.matched.length ?? 0);
  const unmatchedCount = $derived(preview?.unmatched.length ?? 0);
  const conflictCount = $derived(preview?.conflicts.length ?? 0);

  $effect(() => {
    loadPreview();
  });

  async function loadPreview() {
    loading = true;
    error = null;
    result = null;
    try {
      const response = (await rpc.request("getImportPreview", {
        trackerName,
      })) as { preview: ImportPreview | null; error?: string };

      if (response.error) {
        error = response.error;
        return;
      }
      if (!response.preview) {
        error = "No preview data received";
        return;
      }
      preview = response.preview;
      linkSelections = {};
      conflictSelections = {};
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

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

  function matchBadgeClass(status: string): string {
    switch (status) {
      case "matched": return "preset-tonal-success";
      case "unmatched": return "preset-tonal-warning";
      case "conflict": return "preset-tonal-error";
      default: return "preset-tonal-surface";
    }
  }

  function matchStatusLabel(status: string): string {
    switch (status) {
      case "matched": return "Matched";
      case "unmatched": return "Unmatched";
      case "conflict": return "Conflict";
      default: return status;
    }
  }

  async function openLinkModal(entry: { trackerId: string; title: string }) {
    linkTarget = entry;
    showLinkModal = true;
    librarySearch = "";
    try {
      const result = (await rpc.request("getLibrary", {})) as {
        items: Array<{ id: string; titleEn: string; groups: Array<{ id: string; entryType: string; seasonNumber?: number; watchStatus: string }> }>;
      };
      libraryAnime = result.items.map((item) => ({
        id: Number(item.id),
        title: item.titleEn,
        groups: item.groups.map((g) => ({
          id: Number(g.id),
          entryType: g.entryType,
          seasonNumber: g.seasonNumber,
          watchStatus: g.watchStatus,
        })),
      }));
    } catch {
      libraryAnime = [];
    }
  }

  function closeLinkModal() {
    showLinkModal = false;
    linkTarget = null;
    librarySearch = "";
  }

  function selectLinkGroup(_animeId: number, groupId: number) {
    if (linkTarget) {
      linkSelections = { ...linkSelections, [linkTarget.trackerId]: groupId };
    }
    closeLinkModal();
  }

  const filteredLibraryAnime = $derived(
    librarySearch
      ? libraryAnime.filter((a) => a.title.toLowerCase().includes(librarySearch.toLowerCase()))
      : libraryAnime,
  );

  async function handleImport() {
    importing = true;
    error = null;
    try {
      const selections = buildSelections();
      const response = (await rpc.request("confirmImport", {
        trackerName,
        selections: selections.length > 0 ? selections : undefined,
      })) as { result: ImportResult | null; error?: string };

      if (response.error) {
        error = response.error;
        return;
      }
      result = response.result;
      if (!error) {
        onComplete();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      importing = false;
    }
  }

  function buildSelections() {
    const selections: Array<{ trackerId: string; groupId?: number; resolution?: "keepLocal" | "acceptTracker" }> = [];
    const allIds = new Set([...Object.keys(linkSelections), ...Object.keys(conflictSelections)]);
    for (const trackerId of allIds) {
      const selection: { trackerId: string; groupId?: number; resolution?: "keepLocal" | "acceptTracker" } = { trackerId };
      const groupId = linkSelections[trackerId];
      if (groupId !== undefined) {
        selection.groupId = groupId;
      }
      const resolution = conflictSelections[trackerId];
      if (resolution) {
        selection.resolution = resolution;
      }
      selections.push(selection);
    }
    return selections;
  }
</script>

<div class="flex flex-col h-full">
  <header class="h-12 flex items-center border-b border-surface-300-700 shrink-0 px-4 gap-3">
    <button type="button" class="btn-icon preset-tonal-surface" onclick={onCancel}>
      <ArrowLeft class="size-4" />
    </button>
    <span class="text-sm font-medium text-surface-950-50">Import from {trackerDisplayName}</span>
  </header>

  <div class="flex-1 min-h-0 overflow-auto p-4 space-y-4">
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
    {:else if preview}
      <div class="card preset-outlined-surface-300-700 p-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p class="text-2xl font-bold text-surface-950-50">{preview.totalEntries}</p>
            <p class="text-xs text-surface-600-400">Total Entries</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-success-500-400">{matchedCount}</p>
            <p class="text-xs text-surface-600-400">Matched</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-warning-500-400">{unmatchedCount}</p>
            <p class="text-xs text-surface-600-400">New</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-error-500-400">{conflictCount}</p>
            <p class="text-xs text-surface-600-400">Conflicts</p>
          </div>
        </div>

        {#if preview.totalEntries > 0}
          <div class="flex gap-2 mt-3 justify-center flex-wrap">
            {#each Object.entries(preview.statusCounts) as [status, count]}
              {#if count > 0}
                <span class="badge preset-tonal-surface text-xs">
                  {watchStatusLabel(status)}: {count}
                </span>
              {/if}
            {/each}
          </div>
        {/if}
      </div>

      {#if preview.totalEntries === 0}
        <div class="card preset-tonal-surface p-8 text-center">
          <Search class="size-8 text-surface-600-400 mx-auto mb-2" />
          <p class="text-surface-600-400 text-sm">No entries found on this tracker.</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each preview.matched as entry (entry.trackerId)}
            <div class="card preset-outlined-surface-300-700 p-3 flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
                  <span class="badge text-xs {matchBadgeClass(entry.matchStatus)}">
                    {matchStatusLabel(entry.matchStatus)}
                  </span>
                  <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(entry.entryType)}</span>
                </div>
                <p class="text-xs text-surface-600-400 mt-1">
                  {entry.episodesWatched}/{entry.totalEpisodes} episodes &middot; {watchStatusLabel(entry.watchStatus)}
                </p>
              </div>
              <Check class="size-4 text-success-500-400 shrink-0" />
            </div>
          {/each}

          {#each preview.unmatched as entry (entry.trackerId)}
            <button
              type="button"
              class="card preset-outlined-surface-300-700 p-3 flex items-center gap-3 w-full text-left cursor-pointer hover:preset-tonal-surface transition-colors"
              onclick={() => openLinkModal(entry)}
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
                  <span class="badge text-xs {matchBadgeClass(entry.matchStatus)}">
                    {matchStatusLabel(entry.matchStatus)}
                  </span>
                  <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(entry.entryType)}</span>
                </div>
                <p class="text-xs text-surface-600-400 mt-1">
                  {entry.episodesWatched}/{entry.totalEpisodes} episodes &middot; {watchStatusLabel(entry.watchStatus)}
                </p>
                {#if linkSelections[entry.trackerId] !== undefined}
                  <p class="text-xs text-primary-500-400 mt-1">
                    <Link class="size-3 inline" /> Linked to group
                  </p>
                {/if}
              </div>
              <Link class="size-4 text-surface-600-400 shrink-0" />
            </button>
          {/each}

          {#each preview.conflicts as entry (entry.trackerId)}
            <div class="card preset-outlined-error-500 p-3 space-y-2">
              <div class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-sm text-surface-950-50 truncate">{entry.title}</span>
                    <span class="badge text-xs {matchBadgeClass(entry.matchStatus)}">
                      {matchStatusLabel(entry.matchStatus)}
                    </span>
                  </div>
                  <p class="text-xs text-surface-600-400 mt-1">
                    {entry.episodesWatched}/{entry.totalEpisodes} episodes
                  </p>
                </div>
                <AlertTriangle class="size-4 text-error-500-400 shrink-0" />
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
                  class="btn btn-sm rounded-lg text-xs {conflictSelections[entry.trackerId] === 'keepLocal' ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
                  onclick={() => { conflictSelections = { ...conflictSelections, [entry.trackerId]: "keepLocal" }; }}
                >
                  Keep Local
                </button>
                <button
                  type="button"
                  class="btn btn-sm rounded-lg text-xs {conflictSelections[entry.trackerId] === 'acceptTracker' ? 'preset-filled-primary-500' : 'preset-tonal-surface'}"
                  onclick={() => { conflictSelections = { ...conflictSelections, [entry.trackerId]: "acceptTracker" }; }}
                >
                  Accept Tracker
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if preview && preview.totalEntries > 0 && !result}
    <footer class="border-t border-surface-300-700 p-4 flex items-center justify-between gap-3 shrink-0">
      <button
        type="button"
        class="btn preset-tonal-surface rounded-lg font-medium"
        onclick={onCancel}
        disabled={importing}
      >
        Cancel
      </button>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn preset-filled-primary-500 rounded-lg font-medium"
          onclick={handleImport}
          disabled={importing}
        >
          {#if importing}
            <LoaderCircle class="size-4 animate-spin" />
          {/if}
          Import All
        </button>
        {#if conflictCount > 0 || unmatchedCount > 0}
          <button
            type="button"
            class="btn preset-tonal-primary rounded-lg font-medium"
            onclick={handleImport}
            disabled={importing}
          >
            {#if importing}
              <LoaderCircle class="size-4 animate-spin" />
            {/if}
            Confirm Import
          </button>
        {/if}
      </div>
    </footer>
  {/if}
</div>

<Dialog open={showLinkModal} onOpenChange={(details) => { if (!details.open) closeLinkModal(); }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card preset-outlined-surface-300-700 w-full max-w-md max-h-[70vh] flex flex-col p-0 shadow-xl">
        <div class="p-4 border-b border-surface-300-700">
          <Dialog.Title class="text-lg font-semibold text-surface-950-50">
            Link "{linkTarget?.title}"
          </Dialog.Title>
          <Dialog.Description class="text-sm text-surface-600-400 mt-1">
            Select an existing anime group to link this tracker entry to.
          </Dialog.Description>
          <input
            type="text"
            placeholder="Search library..."
            bind:value={librarySearch}
            class="input mt-3"
          />
        </div>
        <div class="flex-1 min-h-0 overflow-auto p-2">
          {#if filteredLibraryAnime.length === 0}
            <p class="text-center text-surface-600-400 text-sm p-4">No matching anime found.</p>
          {:else}
            <div class="space-y-1">
              {#each filteredLibraryAnime as anime (anime.id)}
                <div class="rounded-lg p-2 hover:bg-surface-200-800 transition-colors">
                  <p class="font-medium text-sm text-surface-950-50">{anime.title}</p>
                  <div class="flex gap-1 mt-1 flex-wrap">
                    {#each anime.groups as group (group.id)}
                      <button
                        type="button"
                        class="btn btn-sm preset-tonal-surface rounded-lg text-xs"
                        onclick={() => selectLinkGroup(anime.id, group.id)}
                      >
                        {entryTypeLabel(group.entryType)}
                        {#if group.seasonNumber}
                          S{group.seasonNumber}
                        {/if}
                        ({watchStatusLabel(group.watchStatus)})
                      </button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        <div class="p-4 border-t border-surface-300-700 flex justify-end">
          <Dialog.CloseTrigger class="btn preset-tonal-surface rounded-lg font-medium">
            Cancel
          </Dialog.CloseTrigger>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
