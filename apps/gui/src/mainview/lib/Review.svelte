<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { Search, Tv, ArrowRight } from '@lucide/svelte';
  import { filterReviewGroups, deriveReviewStats, findSwapPairForFile, getEmptyCardMessage, type StatusFilter } from "../state/review-state";
  import { statusBadgeClass, entryTypeLabel } from "../shared";
  import { onMount } from "svelte";
  import type { ResolveCandidate } from "../../shared/types";
  import ResolveModal from "./ResolveModal.svelte";
  import SelectField from "./SelectField.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    sessionId: string;
    plan: ReviewPlan;
    onComplete: () => void;
  }

  let { rpc, sessionId, plan, onComplete }: Props = $props();

  let searchQuery = $state("");
  let statusFilter = $state<StatusFilter>("all");
  let draggedFileId = $state<string | null>(null);
  let dragOverFileId = $state<string | null>(null);

  const STATUS_OPTIONS = [
    { value: "all", label: "All Status" },
    { value: "matched", label: "Matched" },
    { value: "ambiguous", label: "Ambiguous" },
    { value: "needs-attention", label: "Needs Attention" },
  ];

  let resolveModalOpen = $state(false);
  let resolveFileId = $state("");
  let resolveSourcePath = $state("");
  let swapPickerFor = $state<string | null>(null);

  onMount(() => {
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  });
  let resolveCandidates = $state<ResolveCandidate[]>([]);
  let resolveLoading = $state(false);

  const filtered = $derived(
    filterReviewGroups({ plan, searchQuery, statusFilter }),
  );

  const stats = $derived(deriveReviewStats(plan));

  async function approveAll() {
    try {
      for (const group of plan.groups) {
        if (!group.rejected) {
          await rpc.request("approveGroup", { sessionId, animeId: group.animeId });
        }
      }
      await rpc.request("approvePlan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to approve plan:", err);
    }
  }

  async function rejectAll() {
    try {
      await rpc.request("rejectPlan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to reject plan:", err);
    }
  }

  async function handleApproveGroup(animeId: string) {
    try {
      await rpc.request("approveGroup", { sessionId, animeId });
    } catch (err) {
      console.error("Failed to approve group:", err);
    }
  }

  async function handleRejectGroup(animeId: string) {
    try {
      await rpc.request("rejectGroup", { sessionId, animeId });
    } catch (err) {
      console.error("Failed to reject group:", err);
    }
  }

  async function cancel() {
    try {
      await rpc.request("cancelScan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to cancel scan:", err);
    }
  }

  function handleDragStart(e: DragEvent, fileId: string) {
    draggedFileId = fileId;
    e.dataTransfer?.setData("text/plain", fileId);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  async function handleDrop(e: DragEvent, targetFileId: string) {
    e.preventDefault();

    if (draggedFileId && draggedFileId !== targetFileId) {
      try {
        await rpc.request("swapFiles", {
          sessionId,
          fileAId: draggedFileId,
          fileBId: targetFileId,
        });
      } catch (err) {
        console.error("Failed to swap files:", err);
      }
    }
    draggedFileId = null;
  }

  async function openResolveModal(fileId: string, sourcePath: string) {
    resolveFileId = fileId;
    resolveSourcePath = sourcePath;
    resolveModalOpen = true;
    resolveLoading = true;
    resolveCandidates = [];

    try {
      const result = (await rpc.request("getResolveCandidates", {
        sessionId,
        fileId,
      })) as { candidates: ResolveCandidate[] };
      resolveCandidates = result.candidates;
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    } finally {
      resolveLoading = false;
    }
  }

  function closeResolveModal() {
    resolveModalOpen = false;
    resolveFileId = "";
    resolveSourcePath = "";
    resolveCandidates = [];
  }

  async function handleResolve(fileId: string, animeId: string, episodeId: string) {
    try {
      await rpc.request("resolveMatch", {
        sessionId,
        fileId,
        animeId,
        episodeId,
      });
      closeResolveModal();
    } catch (err) {
      console.error("Failed to resolve match:", err);
    }
  }

  async function swapWith(fileAId: string, fileBId: string) {
    try {
      await rpc.request("swapFiles", {
        sessionId,
        fileAId,
        fileBId,
      });
    } catch (err) {
      console.error("Failed to swap files:", err);
    }
    swapPickerFor = null;
  }

  function handleWindowClick(e: MouseEvent) {
    if (swapPickerFor === null) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("[data-swap-picker]")) return;
    swapPickerFor = null;
  }

  function destBorderColor(status: string): string {
    switch (status) {
      case "matched": return "border-l-success-500-400";
      case "cached": return "border-l-primary-500-400";
      case "ambiguous": return "border-l-warning-500-400";
      case "failed": return "border-l-error-500-400";
      default: return "border-l-surface-400-600";
    }
  }
</script>

<div class="h-full flex flex-col">
  <!-- Row 1: Title + actions -->
  <div class="px-4 pt-4 pb-3 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-surface-950-50">Review</h2>
      <div class="flex gap-2">
        <button type="button" class="btn preset-filled-success-500 rounded-lg font-medium" onclick={approveAll}>
          Approve All
        </button>
        <button type="button" class="btn preset-tonal-surface rounded-lg font-medium" onclick={rejectAll}>
          Reject All
        </button>
        <button type="button" class="btn preset-filled-error-500 rounded-lg font-medium" onclick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  </div>

  <!-- Row 2: Stats strip -->
  <div class="px-4 py-2 border-b border-surface-300-700 bg-surface-200-800/30">
    <div class="flex items-center gap-4 text-sm text-surface-700-300">
      <span>{stats.totalFiles} files</span>
      <span>{stats.totalGroups} anime</span>
      <span class="badge preset-tonal-success text-xs">{stats.matchedCount} matched</span>
      <span class="badge preset-tonal-warning text-xs">{stats.ambiguousCount} ambiguous</span>
      {#if stats.resolvedCount > 0}
        <span class="badge preset-tonal-primary text-xs">{stats.resolvedCount} resolved</span>
      {/if}
      {#if stats.failedCount > 0}
        <span class="badge preset-tonal-error text-xs">{stats.failedCount} failed</span>
      {/if}
      {#if stats.swapsCount > 0}
        <span class="badge preset-tonal-warning text-xs">{stats.swapsCount} swapped</span>
      {/if}
    </div>
  </div>

  <!-- Row 3: Search + filter -->
  <div class="px-4 py-3 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex gap-4">
      <div class="input-group grid-cols-[auto_1fr] flex-1">
        <div class="ig-cell preset-tonal">
          <Search class="size-4" />
        </div>
        <input
          type="text"
          placeholder="Search files, anime, episode name..."
          bind:value={searchQuery}
          class="input flex-1"
        />
      </div>
      <SelectField
        value={statusFilter}
        options={STATUS_OPTIONS}
        label=""
        placeholder="Filter..."
        onValueChange={(v) => { statusFilter = (v || "all") as StatusFilter; }}
      />
    </div>
  </div>

  <!-- File list -->
  <div class="flex-1 overflow-auto p-4 space-y-4">
    {#if filtered.length === 0}
      <div class="text-center text-surface-600-400 py-8">
        No files match your search or filter.
      </div>
    {:else}
      {#each filtered as group (group.animeId)}
        <div class="card preset-outlined-surface-300-700 overflow-hidden {group.rejected ? 'opacity-50' : ''}">
          <!-- Group header: slim single row -->
          <div class="px-4 py-2.5 border-b border-surface-300-700 bg-surface-200-800/80 flex items-center gap-3">
            {#if group.image}
              <img src={group.image} alt={group.animeTitle} class="w-8 h-8 rounded object-cover" />
            {:else}
              <div class="w-8 h-8 rounded bg-surface-300-700 flex items-center justify-center">
                <Tv class="size-4 text-surface-600-400" />
              </div>
            {/if}
            <h3 class="flex-1 font-medium text-surface-950-50 text-sm truncate {group.rejected ? 'line-through' : ''}">
              {group.animeTitle}
            </h3>
            <span class="badge preset-tonal-surface text-xs">{entryTypeLabel(group.entryType)}</span>
            <span class="text-xs text-surface-700-300">{group.files.length} files</span>
            {#if group.mergeMode}
              <span class="badge preset-tonal-primary text-xs">Merge</span>
            {/if}
            <div class="flex gap-1 ml-2">
              <button
                type="button"
                class="btn btn-sm rounded-lg font-medium {group.rejected === false ? 'preset-filled-success-500' : 'preset-tonal-surface'}"
                onclick={() => handleApproveGroup(group.animeId)}
              >
                Approve
              </button>
              <button
                type="button"
                class="btn btn-sm rounded-lg font-medium {group.rejected ? 'preset-filled-error-500' : 'preset-tonal-surface'}"
                onclick={() => handleRejectGroup(group.animeId)}
              >
                Reject
              </button>
            </div>
          </div>

          <!-- File rows: two-card layout -->
          <div class="divide-y divide-surface-300-700">
            {#each group.files as file (file.fileId)}
              {@const swapPartner = findSwapPairForFile(group, file.fileId)}
              {@const emptyMessage = getEmptyCardMessage(file)}
              <div class="flex items-stretch gap-0 py-3 px-4 min-w-[40rem] {dragOverFileId === file.fileId ? 'bg-surface-300-700/30' : ''}">
                <!-- Source card -->
                <div class="flex-1 min-w-0 rounded-l-lg border border-r-0 border-surface-300-700 bg-surface-100-900 p-3">
                  <div class="font-mono text-sm text-surface-950-50 truncate" title={file.sourcePath}>
                    {file.sourcePath.split("/").pop()}
                  </div>
                  <div class="font-mono text-xs text-surface-600-400 truncate mt-1" title={file.sourcePath}>
                    {file.sourcePath}
                  </div>
                </div>

                <!-- Arrow gap -->
                <div class="flex items-center px-2 text-surface-500-500">
                  <ArrowRight class="size-4" />
                </div>

                <!-- Destination card -->
                <div
                  class="flex-[1.2] min-w-0 rounded-r-lg border border-l-2 border-surface-300-700 {destBorderColor(file.status)} p-3 relative
                    {swapPartner ? 'border-warning-500-500 border-l-4 border-l-warning-500-500' : ''}
                    {emptyMessage ? 'opacity-70' : ''}"
                  role="listitem"
                  draggable="true"
                  ondragstart={(e) => handleDragStart(e, file.fileId)}
                  ondragover={(e) => { handleDragOver(e); dragOverFileId = file.fileId; }}
                  ondragleave={() => { dragOverFileId = null; }}
                  ondrop={(e) => { handleDrop(e, file.fileId); dragOverFileId = null; }}
                >
                  {#if file.episode !== null && file.episodeName}
                    <div class="text-sm font-bold text-surface-950-50">
                      Episode {file.episode} &middot; {file.episodeName}
                    </div>
                  {:else if emptyMessage}
                    <div class="text-sm italic text-surface-700-300">{emptyMessage}</div>
                  {/if}

                  {#if file.status === "ambiguous" && file.topCandidates && file.topCandidates.length > 0}
                    <div class="text-xs text-surface-700-300 space-y-0.5 mt-2">
                      {#each file.topCandidates.slice(0, 3) as candidate}
                        <div class="truncate">Episode {candidate.episodeNumber} &middot; {candidate.title}</div>
                      {/each}
                    </div>
                  {/if}

                  {#if file.proposedPath}
                    <div class="font-mono text-xs text-success-500-400 truncate mt-2" title={file.proposedPath}>
                      {file.proposedPath}
                    </div>
                  {/if}

                  <!-- Status chips + Swapped marker + Swap button -->
                  <div class="flex items-center gap-2 mt-2">
                    <span class="{statusBadgeClass(file.status)} text-xs">
                      {file.status}
                    </span>
                    {#if swapPartner}
                      <span class="badge preset-tonal-warning text-xs">Swapped</span>
                    {/if}
                    <div class="flex-1"></div>
                    <button
                      type="button"
                      class="btn btn-sm preset-tonal-surface rounded-lg text-xs"
                      aria-haspopup="listbox"
                      aria-expanded={swapPickerFor === file.fileId}
                      onclick={() => swapPickerFor = swapPickerFor === file.fileId ? null : file.fileId}
                    >
                      Swap with…
                    </button>
                  </div>

                  <!-- Swap picker (inline list) -->
                  {#if swapPickerFor === file.fileId}
                    <ul data-swap-picker class="mt-2 max-h-40 overflow-auto border border-surface-300-700 rounded-md bg-surface-100-900" role="listbox">
                      {#each group.files.filter((f) => f.fileId !== file.fileId) as partner (partner.fileId)}
                        <li>
                          <button
                            type="button"
                            class="w-full text-left px-2 py-1 text-xs font-mono text-surface-700-300 hover:bg-surface-300-700 truncate"
                            role="option"
                            aria-selected="false"
                            onclick={() => swapWith(file.fileId, partner.fileId)}
                            title={partner.proposedPath ?? partner.sourcePath}
                          >
                            {partner.proposedPath?.split("/").pop() ?? partner.sourcePath.split("/").pop()}
                          </button>
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>

                <!-- Resolve button column (right of destination card) -->
                {#if file.status === "ambiguous"}
                  <div class="flex items-center pl-2">
                    <button
                      type="button"
                      class="btn btn-sm preset-filled-warning-500 rounded-lg font-medium"
                      onclick={() => openResolveModal(file.fileId, file.sourcePath)}
                    >
                      Resolve
                    </button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<ResolveModal
  open={resolveModalOpen}
  fileId={resolveFileId}
  sourcePath={resolveSourcePath}
  candidates={resolveCandidates}
  loading={resolveLoading}
  onClose={closeResolveModal}
  onResolve={handleResolve}
/>
