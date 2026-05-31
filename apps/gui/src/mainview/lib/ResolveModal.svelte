<script lang="ts">
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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick={onClose}></div>

    <div class="relative bg-surface-800 rounded-xl border border-surface-700 shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
      <div class="p-4 border-b border-surface-700">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-lg font-semibold text-surface-100">Resolve Ambiguous Match</h3>
          <button
            class="p-1 text-surface-400 hover:text-surface-200 transition-colors"
            onclick={onClose}
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p class="text-sm text-surface-400 truncate" title={sourcePath}>
          {sourcePath.split("/").pop()}
        </p>
      </div>

      <div class="flex-1 overflow-auto p-4 space-y-2">
        {#if loading}
          <div class="flex items-center justify-center py-8 text-surface-400">
            <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            Loading candidates...
          </div>
        {:else if candidates.length === 0}
          <div class="text-center text-surface-500 py-8">
            No candidates found.
          </div>
        {:else}
          {#each candidates as candidate (candidate.animeId + candidate.episodeId)}
            <button
              class="w-full text-left p-3 rounded-lg border border-surface-600 hover:border-primary-500 hover:bg-surface-700/50 transition-all group"
              onclick={() => handleResolve(candidate)}
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-medium text-surface-200 group-hover:text-primary-400 transition-colors">
                  {candidate.animeTitle}
                </span>
                <span class="px-2 py-0.5 rounded text-xs font-medium bg-surface-600 text-surface-300">
                  {candidate.entryType}
                </span>
              </div>
              <div class="text-sm text-surface-400">
                S{candidate.season}E{String(candidate.episodeNumber).padStart(2, "0")}
                <span class="ml-2 text-surface-500">
                  score: {(candidate.score * 100).toFixed(0)}%
                </span>
              </div>
            </button>
          {/each}
        {/if}
      </div>

      <div class="p-4 border-t border-surface-700">
        <button
          class="w-full px-4 py-2 bg-surface-600 hover:bg-surface-500 text-surface-300 rounded-lg text-sm transition-colors"
          onclick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
