<script lang="ts">
  import type { ReviewPlan } from "@kogoro/core";
  import { Search, Tv, ArrowRight, ChevronRight, ArrowLeftRight } from '@lucide/svelte';
  import { filterReviewGroups, deriveReviewStats, findSwapPairForFile, getEmptyCardMessage, type StatusFilter } from "../state/review-state";

  import { statusBadgeClass, entryTypeLabel } from "../shared";
  import type { ResolveCandidate } from "../../shared/types";
  import ResolveModal from "./ResolveModal.svelte";
  import SelectField from "./SelectField.svelte";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    sessionId: string;
    plan: ReviewPlan;
    onComplete: () => void;
  }

  let { rpc, sessionId, plan: initialPlan, onComplete }: Props = $props();

  let plan = $state($state.snapshot(initialPlan));

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
  let expandedGroups = $state<Set<string>>(new Set(plan.groups.map(g => g.animeId)));
  let resolveCandidates = $state<ResolveCandidate[]>([]);
  let resolveLoading = $state(false);

  const filtered = $derived(
    filterReviewGroups({ plan, searchQuery, statusFilter }),
  );

  const stats = $derived(deriveReviewStats(plan));

  $effect(() => {
    const groupIds = new Set(plan.groups.map(g => g.animeId));
    let changed = false;
    for (const id of expandedGroups) {
      if (!groupIds.has(id)) {
        expandedGroups.delete(id);
        changed = true;
      }
    }
    for (const id of groupIds) {
      if (!expandedGroups.has(id)) {
        expandedGroups.add(id);
        changed = true;
      }
    }
    if (changed) expandedGroups = expandedGroups;
  });

  function toggleGroup(animeId: string) {
    const next = new Set(expandedGroups);
    if (next.has(animeId)) {
      next.delete(animeId);
    } else {
      next.add(animeId);
    }
    expandedGroups = next;
  }

  function groupStatusSummary(group: { files: { status: string }[]; rejected?: boolean }): string {
    if (group.rejected) return "rejected";
    let matched = 0;
    let ambiguous = 0;
    let failed = 0;
    for (const file of group.files) {
      if (file.status === "matched" || file.status === "cached") matched++;
      else if (file.status === "ambiguous") ambiguous++;
      else if (file.status === "failed") failed++;
    }
    const parts: string[] = [];
    if (matched > 0) parts.push(`${matched} matched`);
    if (ambiguous > 0) parts.push(`${ambiguous} ambiguous`);
    if (failed > 0) parts.push(`${failed} failed`);
    return parts.join(", ") || "all matched";
  }

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

  async function cancel() {
    try {
      await rpc.request("cancelScan", { sessionId });
      onComplete();
    } catch (err) {
      console.error("Failed to cancel scan:", err);
    }
  }

  async function handleApproveGroup(animeId: string) {
    try {
      await rpc.request("approveGroup", { sessionId, animeId });
      plan = { ...plan, groups: plan.groups.map(g => g.animeId === animeId ? { ...g, rejected: false } : g) };
    } catch (err) {
      console.error("Failed to approve group:", err);
    }
  }

  async function handleRejectGroup(animeId: string) {
    try {
      await rpc.request("rejectGroup", { sessionId, animeId });
      plan = { ...plan, groups: plan.groups.map(g => g.animeId === animeId ? { ...g, rejected: true } : g) };
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
  }

  async function handleDrop(e: DragEvent, targetFileId: string) {
    e.preventDefault();

    if (draggedFileId && draggedFileId !== targetFileId) {
      try {
        const result = (await rpc.request("swapFiles", {
          sessionId,
          fileAId: draggedFileId,
          fileBId: targetFileId,
        })) as { plan: ReviewPlan };
        plan = result.plan;
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

  function destBorderColor(status: string): string {
    switch (status) {
      case "matched": return "border-l-success-500-400";
      case "cached": return "border-l-primary-500-400";
      case "ambiguous": return "border-l-warning-500-400";
      case "failed": return "border-l-error-500-400";
      default: return "border-l-surface-400-600";
    }
  }

  function basename(path: string): string {
    return path.split("/").pop() ?? path;
  }
</script>

<div class="h-full flex flex-col">
  <div class="px-4 pt-4 pb-3 border-b border-surface-300-700 bg-surface-200-800/50">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-surface-950-50">Rename Plan</h2>
      <div class="flex gap-2">
        <button type="button" class="btn preset-filled-success-500 rounded-lg font-medium" onclick={approveAll}>
          Execute
        </button>
        <button type="button" class="btn preset-tonal-surface rounded-lg font-medium" onclick={cancel}>
          Cancel
        </button>
      </div>
    </div>
  </div>

  <div class="px-4 py-2 border-b border-surface-300-700 bg-surface-200-800/30">
    <div class="flex items-center gap-4 text-sm text-surface-700-300">
      <span>{stats.totalFiles} files</span>
      <span>{stats.totalGroups} anime</span>
      <span class="text-surface-600-400">{stats.matchedCount} matched</span>
      {#if stats.ambiguousCount > 0}
        <span class="badge preset-tonal-warning text-xs">{stats.ambiguousCount} ambiguous</span>
      {/if}
      {#if stats.failedCount > 0}
        <span class="badge preset-tonal-error text-xs">{stats.failedCount} failed</span>
      {/if}
      {#if stats.resolvedCount > 0}
        <span class="badge preset-tonal-primary text-xs">{stats.resolvedCount} resolved</span>
      {/if}
      {#if stats.rejectedCount > 0}
        <span class="badge preset-tonal-error text-xs">{stats.rejectedCount} rejected</span>
      {/if}
    </div>
  </div>

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

  <div class="flex-1 overflow-auto p-4 space-y-4">
    {#if filtered.length === 0}
      <div class="text-center text-surface-600-400 py-8">
        {#if plan.groups.length === 0}
          No files to review.
        {:else}
          No files match your search or filter.
        {/if}
      </div>
    {:else}
      {#each filtered as group (group.animeId)}
        {@const isExpanded = expandedGroups.has(group.animeId)}
        <div class="card preset-outlined-surface-300-700 overflow-hidden {group.rejected ? 'opacity-50' : ''}">
          <div class="px-4 py-2.5 border-b border-surface-300-700 bg-surface-200-800/80 flex items-center gap-3">
            <button
              type="button"
              class="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
              onclick={() => toggleGroup(group.animeId)}
            >
              <ChevronRight class="size-4 text-surface-600-400 transition-transform {isExpanded ? 'rotate-90' : ''}" />
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
              {#if !isExpanded}
                <span class="text-xs text-surface-600-400">{groupStatusSummary(group)}</span>
              {/if}
            </button>
            {#if isExpanded}
              <div class="flex gap-1 ml-2">
                <button
                  type="button"
                  class="btn btn-sm rounded-lg font-medium preset-tonal-surface"
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
            {/if}
          </div>

          {#if isExpanded}
            <div class="divide-y divide-surface-300-700">
              {#each group.files as file (file.fileId)}
                {@const emptyMessage = getEmptyCardMessage(file)}
                {@const isSwapped = !!findSwapPairForFile(group, file.fileId)}
                <div class="flex items-stretch gap-0 py-3 px-4 min-w-160 {dragOverFileId === file.fileId ? 'bg-surface-300-700/30' : ''}">
                  <div class="flex-1 min-w-0 rounded-l-lg border border-r-0 border-surface-300-700 bg-surface-100-900 p-3">
                    <div class="font-mono text-sm text-surface-950-50 truncate" title={file.sourcePath}>
                      {basename(file.sourcePath)}
                    </div>
                  </div>

                  <div class="flex items-center px-2 text-surface-500-500">
                    <ArrowRight class="size-4" />
                  </div>

                  <div
                    class="flex-[1.2] min-w-0 rounded-r-lg border border-l-2 border-surface-300-700 {destBorderColor(file.status)} p-3 relative
                      {isSwapped ? 'border-l-warning-500-400 border-l-4 bg-warning-500-500/5' : ''}
                      {emptyMessage ? 'opacity-70' : ''}"
                    role="listitem"
                    draggable="true"
                    ondragstart={(e) => handleDragStart(e, file.fileId)}
                    ondragover={(e) => { handleDragOver(e); dragOverFileId = file.fileId; }}
                    ondragleave={() => { dragOverFileId = null; }}
                    ondrop={(e) => { handleDrop(e, file.fileId); dragOverFileId = null; }}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        {#if file.proposedPath}
                          <div class="text-sm font-bold text-surface-950-50 truncate" title={file.proposedPath}>
                            {basename(file.proposedPath)}
                          </div>
                          <div class="font-mono text-xs text-surface-600-400 truncate mt-1" title={file.proposedPath}>
                            {file.proposedPath}
                          </div>
                        {:else if emptyMessage}
                          <div class="text-sm italic text-surface-700-300">{emptyMessage}</div>
                        {/if}
                      </div>
                      <span class="{statusBadgeClass(file.status)} text-xs shrink-0">
                        {file.status}
                      </span>
                    </div>

                    {#if file.status === "ambiguous" && file.topCandidates && file.topCandidates.length > 0}
                      <div class="text-xs text-surface-700-300 space-y-0.5 mt-2">
                        {#each file.topCandidates.slice(0, 3) as candidate}
                          <div class="truncate">Episode {candidate.episodeNumber} &middot; {candidate.title}</div>
                        {/each}
                      </div>
                    {/if}

                    {#if isSwapped || file.status === "ambiguous"}
                      <div class="flex items-center justify-between mt-2">
                        {#if isSwapped}
                          <span class="badge preset-tonal-warning text-xs gap-1">
                            <ArrowLeftRight class="size-3" />
                            Swapped
                          </span>
                        {/if}
                        {#if file.status === "ambiguous"}
                          <button
                            type="button"
                            class="btn btn-sm preset-tonal-surface rounded-lg text-xs"
                            onclick={() => openResolveModal(file.fileId, file.sourcePath)}
                          >
                            Resolve
                          </button>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
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
