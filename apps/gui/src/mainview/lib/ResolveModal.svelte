<script lang="ts">
  import { X, LoaderCircle } from '@lucide/svelte';
  import { Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
  import type { ResolveCandidate } from "../state/resolve-state";

  interface Props {
    open: boolean;
    fileId: string;
    sourcePath: string;
    candidates: ResolveCandidate[];
    loading: boolean;
    onClose: () => void;
    onResolve: (fileId: string, animeId: string, episodeId: string) => void;
  }

  let { open, fileId, sourcePath, candidates, loading, onClose, onResolve }: Props = $props();

  function handleResolve(candidate: ResolveCandidate) {
    onResolve(fileId, candidate.animeId, candidate.episodeId);
  }
</script>

<Dialog open={open} onOpenChange={(details) => { if (!details.open) onClose(); }}>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-950/60 backdrop-blur-sm" />
    <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Dialog.Content class="card bg-surface-100-900 w-full max-w-lg max-h-[80vh] flex flex-col p-0 shadow-xl">
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
            <div class="text-center text-surface-600-400 py-8">
              No candidates found.
            </div>
          {:else}
            {#each candidates as candidate (candidate.animeId + candidate.episodeId)}
              <button
                type="button"
                class="w-full text-left p-3 rounded-container border border-surface-200-800 hover:preset-tonal transition-all group"
                onclick={() => handleResolve(candidate)}
              >
                <div class="flex items-center justify-between mb-1">
                    <span class="font-medium text-surface-950-50 text-sm group-hover:text-primary-400 transition-colors">
                      {candidate.animeTitle}
                    </span>
                  <span class="badge preset-tonal-surface text-xs">
                    {candidate.entryType}
                  </span>
                </div>
                <div class="text-sm text-surface-700-300">
                  S{candidate.season}E{String(candidate.episodeNumber).padStart(2, "0")}
                  <span class="ml-2 text-surface-600-400">
                    score: {(candidate.score * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            {/each}
          {/if}
        </div>

        <div class="p-4 border-t border-surface-300-700">
          <Dialog.CloseTrigger class="w-full preset-tonal-surface rounded-lg font-medium">
            Cancel
          </Dialog.CloseTrigger>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
