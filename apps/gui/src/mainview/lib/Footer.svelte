<script lang="ts">
  import { CircleCheck, LoaderCircle } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { statusKindFor } from "../state/footer";

  type LibraryStats = { animeCount: number; episodeCount: number };

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    statusText: string;
    isExecuting: boolean;
    onCancel: () => void;
  }

  let { rpc, statusText, isExecuting, onCancel }: Props = $props();

  let stats: LibraryStats | null = $state(null);

  onMount(async () => {
    try {
      stats = (await rpc.request("getLibraryStats", {})) as LibraryStats;
    } catch {}
  });

  const statusKind = $derived(statusKindFor(statusText));
</script>

<footer
  class="h-8 flex items-center px-4 border-t border-surface-300-700 bg-surface-100-900 shrink-0 gap-4"
>
  <span class="flex items-center gap-1.5 text-xs text-surface-600-400">
    {#if statusKind === "active"}
      <LoaderCircle class="size-3 animate-spin" />
    {:else}
      <CircleCheck class="size-3" />
    {/if}
    {statusText}
  </span>
  {#if isExecuting}
    <button
      type="button"
      class="btn btn-sm preset-filled-error-500 rounded-lg text-xs ml-auto"
      onclick={onCancel}
    >
      Cancel
    </button>
  {:else if stats}
    <span class="ml-auto flex items-center gap-2">
      <span
        class="px-2 py-0.5 text-xs rounded-md bg-surface-200-800 text-surface-700-300"
      >
        {stats.animeCount} anime
      </span>
      <span
        class="px-2 py-0.5 text-xs rounded-md bg-surface-200-800 text-surface-700-300"
      >
        {stats.episodeCount} episodes
      </span>
    </span>
  {/if}
</footer>
