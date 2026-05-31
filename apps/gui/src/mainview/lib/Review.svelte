<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { filterReviewGroups, deriveReviewStats, findSwapPairForFile, type StatusFilter } from "../state/review-state";
  import type { ResolveCandidate } from "../state/resolve-state";
  import ResolveModal from "./ResolveModal.svelte";

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
        return "bg-green-500/20 text-green-400";
      case "ambiguous":
        return "bg-yellow-500/20 text-yellow-400";
      case "failed":
        return "bg-red-500/20 text-red-400";
      case "cached":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-surface-500/20 text-surface-400";
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

  async function approveGroup() {
    try {
      await rpc.request("approvePlan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to approve group:", err);
    }
  }

  async function rejectGroup() {
    try {
      await rpc.request("rejectPlan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to reject group:", err);
    }
  }

  function handleDragStart(e: DragEvent, fileId: string) {
    draggedFileId = fileId;
    e.dataTransfer?.setData("text/plain", fileId);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.add("bg-surface-600/50");
  }

  function handleDragLeave(e: DragEvent) {
    (e.currentTarget as HTMLElement).classList.remove("bg-surface-600/50");
  }

  async function handleDrop(e: DragEvent, targetFileId: string) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove("bg-surface-600/50");

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
  <div class="p-4 border-b border-surface-700 bg-surface-800/50">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">Review Rename Plan</h2>
      <div class="flex gap-2">
        <button class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors" onclick={approveAll}>
          Approve All
        </button>
        <button class="px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors" onclick={rejectAll}>
          Reject All
        </button>
        <button class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors" onclick={cancel}>
          Cancel
        </button>
      </div>
    </div>

    <div class="flex items-center gap-4 text-sm text-surface-400 mb-4">
      <span>{stats.totalFiles} files</span>
      <span>{stats.totalGroups} anime</span>
      <span>{stats.ambiguousCount} ambiguous</span>
      {#if stats.swapsCount > 0}
        <span class="text-amber-400">{stats.swapsCount} swapped</span>
      {/if}
    </div>

    <div class="flex gap-4">
      <input
        type="text"
        placeholder="Search files or anime..."
        value={searchQuery}
        oninput={(e) => (searchQuery = (e.target as HTMLInputElement).value)}
        class="flex-1 px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      <select
        value={statusFilter}
        onchange={(e) => (statusFilter = (e.target as HTMLSelectElement).value as StatusFilter)}
        class="px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="all">All Status</option>
        <option value="matched">Matched</option>
        <option value="ambiguous">Ambiguous</option>
        <option value="needs-attention">Needs Attention</option>
      </select>
    </div>
  </div>

  <div class="flex-1 overflow-auto p-4 space-y-4">
    {#if filtered.length === 0}
      <div class="text-center text-surface-500 py-8">
        No files match your search or filter.
      </div>
    {:else}
      {#each filtered as group (group.animeId)}
        <div class="bg-surface-800 rounded-lg border border-surface-700 overflow-hidden">
          <div class="p-4 border-b border-surface-700 bg-surface-800/80">
            <div class="flex items-center gap-3">
              {#if group.image}
                <img src={group.image} alt={group.animeTitle} class="w-12 h-12 rounded object-cover" />
              {:else}
                <div class="w-12 h-12 rounded bg-surface-700 flex items-center justify-center">
                  <svg class="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              {/if}
              <div class="flex-1">
                <h3 class="font-semibold text-surface-200">{group.animeTitle}</h3>
                <p class="text-sm text-surface-400">{group.files.length} files • {group.entryType}</p>
              </div>
              <div class="flex gap-2">
                <button class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors" onclick={approveGroup}>
                  Approve
                </button>
                <button class="px-3 py-1 bg-surface-600 hover:bg-surface-500 text-white rounded text-sm transition-colors" onclick={rejectGroup}>
                  Reject
                </button>
              </div>
            </div>
          </div>

          <div class="divide-y divide-surface-700">
            {#each group.files as file (file.fileId)}
              {@const swapPartner = findSwapPairForFile(group, file.fileId)}
              <div
                class="p-3 hover:bg-surface-700/50 transition-colors cursor-move {swapPartner ? 'border-l-2 border-amber-500' : ''}"
                draggable="true"
                ondragstart={(e) => handleDragStart(e, file.fileId)}
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                ondrop={(e) => handleDrop(e, file.fileId)}
              >
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-sm font-medium text-surface-200 truncate">
                        {file.sourcePath.split("/").pop()}
                      </span>
                      <span class="px-2 py-0.5 rounded text-xs font-medium {getStatusBadgeClass(file.status)}">
                        {file.status}
                      </span>
                      {#if swapPartner}
                        <span class="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                          Swapped
                        </span>
                      {/if}
                    </div>
                    <div class="text-xs text-surface-500 truncate">{file.sourcePath}</div>
                    {#if file.proposedPath}
                      <div class="text-xs text-green-400 truncate mt-1">→ {file.proposedPath}</div>
                    {/if}
                  </div>
                  {#if file.status === "ambiguous"}
                    <button
                      class="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors"
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
