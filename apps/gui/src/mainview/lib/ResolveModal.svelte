<script lang="ts">
  import { X, LoaderCircle, Tv } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { ResolveCandidate } from "../../shared/types";
  import { entryTypeLabel } from "../shared";

  interface Props {
    open: boolean;
    fileId: string;
    sourcePath: string;
    candidates: ResolveCandidate[];
    loading: boolean;
    onClose: () => void;
    onResolve: (fileId: string, animeId: string, episodeId: string) => void;
  }

  let {
    open,
    fileId,
    sourcePath,
    candidates,
    loading,
    onClose,
    onResolve,
  }: Props = $props();

  let selectedCandidate = $state<ResolveCandidate | null>(null);

  function scoreColor(score: number): string {
    if (score >= 0.8) return "text-success-500-400";
    if (score >= 0.5) return "text-warning-500-400";
    return "text-error-500-400";
  }

  function handleSelect(candidate: ResolveCandidate) {
    selectedCandidate = candidate;
  }

  function handleConfirm() {
    if (!selectedCandidate) return;
    onResolve(fileId, selectedCandidate.animeId, selectedCandidate.episodeId);
  }

  function candidateCardClass(isSelected: boolean, isTop: boolean): string {
    if (isSelected) return "preset-tonal-primary ring-2 ring-primary-500-400";
    if (isTop) return "preset-tonal-success card-hover";
    return "preset-tonal-surface card-hover";
  }

  function handleClose() {
    selectedCandidate = null;
    onClose();
  }
</script>

<Dialog open={open} onOpenChange={(details) => { if (!details.open) handleClose(); }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card preset-outlined-surface-300-700 w-full max-w-lg max-h-[80vh] flex flex-col p-0 shadow-xl">
        <div class="p-4 border-b border-surface-300-700">
          <div class="flex items-center justify-between mb-2">
            <Dialog.Title class="text-lg font-semibold text-surface-950-50">Resolve Ambiguous Match</Dialog.Title>
            <Dialog.CloseTrigger class="btn preset-tonal-surface btn-icon-sm rounded-lg">
              <X class="size-4" />
            </Dialog.CloseTrigger>
          </div>
          <Dialog.Description class="text-sm text-surface-700-300 truncate" title={sourcePath}>
            {sourcePath.split("/").pop()}
          </Dialog.Description>
        </div>

        <div class="flex-1 overflow-auto p-4 space-y-2">
          {#if loading}
            <div class="flex items-center justify-center gap-2 py-8 text-surface-700-300">
              <LoaderCircle class="size-5 animate-spin" />
              Loading candidates...
            </div>
          {:else if candidates.length === 0}
            <div class="text-center py-8 space-y-3">
              <Tv class="size-10 text-surface-600-400 mx-auto" />
              <p class="text-surface-700-300 text-sm">No candidates found.</p>
              <p class="text-surface-500-500 text-xs">No matches could be found for this file.</p>
            </div>
          {:else}
            {@const topScore = Math.max(...candidates.map((c) => c.score))}
            {#each candidates as candidate (candidate.animeId + ":" + candidate.episodeId)}
              {@const isTop = candidate.score === topScore}
              {@const isSelected = selectedCandidate !== null && candidate.animeId === selectedCandidate.animeId && candidate.episodeId === selectedCandidate.episodeId}
              <button
                type="button"
                class="w-full text-left card p-3 transition-all group {candidateCardClass(isSelected, isTop)}"
                onclick={() => handleSelect(candidate)}
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="font-medium text-surface-950-50 text-sm group-hover:text-primary-400 transition-colors">
                    {candidate.animeTitle}
                  </span>
                  <div class="flex items-center gap-1.5">
                    {#if isTop}
                      <span class="badge preset-tonal-success text-xs">Best match</span>
                    {/if}
                    <span class="badge preset-tonal-surface text-xs">
                      {entryTypeLabel(candidate.entryType)}
                    </span>
                  </div>
                </div>
                <div class="text-sm text-surface-700-300">
                  S{candidate.season}E{String(candidate.episodeNumber).padStart(2, "0")}
                  <span class="ml-2 {scoreColor(candidate.score)}">
                    {(candidate.score * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            {/each}
          {/if}
        </div>

        <div class="p-4 border-t border-surface-300-700">
          {#if selectedCandidate}
            <button
              type="button"
              class="w-full btn preset-filled-primary-500 rounded-lg font-medium"
              onclick={handleConfirm}
            >
              Confirm Match
            </button>
          {:else}
            <Dialog.CloseTrigger class="w-full btn preset-tonal-surface rounded-lg font-medium">
              Cancel
            </Dialog.CloseTrigger>
          {/if}
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
