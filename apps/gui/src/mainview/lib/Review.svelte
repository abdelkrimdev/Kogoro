<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { Search, Tv } from '@lucide/svelte';
  import { filterReviewGroups, deriveReviewStats, findSwapPairForFile, type StatusFilter } from "../state/review-state";
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
  let resolveCandidates = $state<ResolveCandidate[]>([]);
  let resolveLoading = $state(false);

  const filtered = $derived(
    filterReviewGroups({ plan, searchQuery, statusFilter }),
  );

  const stats = $derived(deriveReviewStats(plan));

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "matched":
        return "badge preset-tonal-success";
      case "ambiguous":
        return "badge preset-tonal-warning";
      case "failed":
        return "badge preset-tonal-error";
      case "cached":
        return "badge preset-tonal-primary";
      default:
        return "badge preset-tonal-surface";
    }
  }

  async function approveAll() {
    try {
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
</script>

<div class="h-full flex flex-col">
  <div class="p-4 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-surface-950-50">Review Rename Plan</h2>
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

    <div class="flex items-center gap-4 text-sm text-surface-700-300 mb-4">
      <span>{stats.totalFiles} files</span>
      <span>{stats.totalGroups} anime</span>
      <span>{stats.ambiguousCount} ambiguous</span>
      {#if stats.swapsCount > 0}
        <span class="text-warning-500-400">{stats.swapsCount} swapped</span>
      {/if}
    </div>

    <div class="flex gap-4">
      <div class="input-group grid-cols-[auto_1fr] flex-1">
        <div class="ig-cell preset-tonal">
          <Search class="size-4" />
        </div>
        <input
          type="text"
          placeholder="Search files or anime..."
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

  <div class="flex-1 overflow-auto p-4 space-y-4">
    {#if filtered.length === 0}
      <div class="text-center text-surface-600-400 py-8">
        No files match your search or filter.
      </div>
    {:else}
      {#each filtered as group (group.animeId)}
        <div class="card preset-outlined-surface-300-700 overflow-hidden">
          <div class="p-4 border-b border-surface-300-700 bg-surface-200-800/80">
            <div class="flex items-center gap-3">
              {#if group.image}
                <img src={group.image} alt={group.animeTitle} class="w-12 h-12 rounded object-cover" />
              {:else}
                <div class="w-12 h-12 rounded bg-surface-300-700 flex items-center justify-center">
                  <Tv class="size-6 text-surface-600-400" />
                </div>
              {/if}
              <div class="flex-1">
                <h3 class="font-medium text-surface-950-50 text-sm">{group.animeTitle}</h3>
                <p class="text-sm text-surface-700-300">{group.files.length} files &bull; {group.entryType}</p>
              </div>
            </div>
          </div>

          <div class="divide-y divide-surface-300-700">
            {#each group.files as file (file.fileId)}
              {@const swapPartner = findSwapPairForFile(group, file.fileId)}
              <div
                role="listitem"
                class="p-3 hover:bg-surface-300-700/50 transition-colors cursor-move {swapPartner ? 'border-l-2 border-warning-500-500' : ''} {dragOverFileId === file.fileId ? 'bg-surface-300-700/50' : ''}"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, file.fileId)}
                ondragover={(e) => { handleDragOver(e); dragOverFileId = file.fileId; }}
                ondragleave={() => { dragOverFileId = null; }}
                ondrop={(e) => { handleDrop(e, file.fileId); dragOverFileId = null; }}
              >
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-medium text-surface-950-50 truncate">
                        {file.sourcePath.split("/").pop()}
                      </span>
                      <span class="{getStatusBadgeClass(file.status)} text-xs">
                        {file.status}
                      </span>
                      {#if swapPartner}
                        <span class="badge preset-tonal-warning text-xs">
                          Swapped
                        </span>
                      {/if}
                    </div>
                    <div class="text-xs text-surface-600-400 truncate">{file.sourcePath}</div>
                    {#if file.proposedPath}
                      <div class="text-xs text-success-500-400 truncate mt-1">&rarr; {file.proposedPath}</div>
                    {/if}
                  </div>
                  {#if file.status === "ambiguous"}
                    <button
                      type="button"
                      class="btn btn-sm preset-filled-warning-500 rounded-lg font-medium"
                      onclick={() => openResolveModal(file.fileId, file.sourcePath)}
                    >
                      Resolve
                    </button>
                  {/if}
                </div>
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
