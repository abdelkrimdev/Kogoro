<script lang="ts">
  import { type LibraryItem, filterAndSort } from "../state/library-state";
  import { typeBadgeClass, entryTypeLabel } from "../shared";
  import { Search, LayoutGrid, List, Folder, ChevronUp, ChevronDown } from '@lucide/svelte';

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onOpenAnime?: (id: string) => void;
    onStartScan?: () => void;
  }

  let { rpc, onOpenAnime, onStartScan }: Props = $props();

  let items = $state<LibraryItem[]>([]);
  let search = $state("");
  let typeFilter = $state<string[]>([]);
  let viewMode = $state<"grid" | "list">("grid");
  let sortField = $state<"titleEn" | "entryType" | "episodeCount" | "filesOnDisk">("titleEn");
  let sortAsc = $state(true);

  const ENTRY_TYPES = ["tv", "movie", "ova", "special"];

  const filtered = $derived(
    filterAndSort({ items, search, typeFilter, viewMode, sortField, sortAsc }),
  );

  const hasLibrary = $derived(items.length > 0);

  function toggleType(type: string) {
    const idx = typeFilter.indexOf(type);
    if (idx >= 0) {
      typeFilter = typeFilter.filter((t) => t !== type);
    } else {
      typeFilter = [...typeFilter, type];
    }
  }

  function setSort(field: typeof sortField) {
    if (sortField === field) {
      sortAsc = !sortAsc;
    } else {
      sortField = field;
      sortAsc = true;
    }
  }

  let effectVersion = 0;

  $effect(() => {
    const version = ++effectVersion;
    (async () => {
      try {
        const result = await rpc.request("getLibrary", {});
        if (version === effectVersion) {
          items = result as LibraryItem[];
        }
      } catch (err) {
        console.error("Failed to load library:", err);
      }
    })();
  });
</script>

{#if !hasLibrary}
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <Folder class="size-16 text-surface-600-400" />
    <p class="text-surface-600-400 text-sm">No library yet — scan a folder to get started.</p>
    <button
      type="button"
      class="btn preset-filled-primary-500 rounded-lg font-medium"
      onclick={() => onStartScan?.()}
    >
      Go to Scan
    </button>
  </div>
{:else}
  <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-300-700 bg-surface-200-800/50 shrink-0">
    <div class="input-group grid-cols-[auto_1fr] flex-1 max-w-xs">
      <div class="ig-cell preset-tonal">
        <Search class="size-4" />
      </div>
      <input
        type="text"
        placeholder="Search anime..."
        bind:value={search}
        class="ig-input"
      />
    </div>
    <div class="flex items-center gap-2">
      {#each ENTRY_TYPES as type}
        {@const active = typeFilter.length === 0 || typeFilter.includes(type)}
        <button
          type="button"
          class="{active
            ? 'badge preset-tonal-primary'
            : 'badge preset-tonal-surface'}"
          onclick={() => toggleType(type)}
        >
          {entryTypeLabel(type)}
        </button>
      {/each}
    </div>
    <div class="flex items-center bg-surface-300-700 rounded-lg border border-surface-300-700 p-0.5">
      <button
        type="button"
        class="btn-icon btn-icon-sm {viewMode === 'grid' ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
        aria-label="Grid view"
        onclick={() => (viewMode = 'grid')}
      >
        <LayoutGrid class="size-4" />
      </button>
      <button
        type="button"
        class="btn-icon btn-icon-sm {viewMode === 'list' ? 'preset-filled-primary-500' : 'hover:preset-tonal'}"
        aria-label="List view"
        onclick={() => (viewMode = 'list')}
      >
        <List class="size-4" />
      </button>
    </div>
  </div>

  {#if filtered.length === 0}
    <div class="flex flex-col items-center justify-center h-full gap-3 py-16">
      <Search class="size-12 text-surface-600-400" />
      <p class="text-surface-600-400">No anime matches your search.</p>
    </div>
  {:else if viewMode === 'grid'}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
      {#each filtered as item (item.id)}
        <button
          type="button"
          class="group card card-hover preset-tonal-surface cursor-pointer transition-all text-left overflow-hidden"
          onclick={() => onOpenAnime?.(item.id)}
        >
          <div class="aspect-2/3 bg-surface-300-700 relative overflow-hidden">
            {#if item.coverArt}
              <img src={item.coverArt} alt={item.titleEn} class="w-full h-full object-cover" />
            {:else}
              <div class="absolute inset-0 flex items-center justify-center">
                <Folder class="size-12 text-surface-600-400" />
              </div>
            {/if}
          </div>
          <div class="p-3 space-y-1.5">
            <h3 class="text-sm font-medium text-surface-950-50 truncate group-hover:text-primary-400 transition-colors">
              {item.titleEn}
            </h3>
            <div class="flex items-center justify-between">
              <span class="{typeBadgeClass(item.entryType)} text-xs">
                {entryTypeLabel(item.entryType)}
              </span>
              <span class="text-xs text-surface-600-400">{item.episodeCount} ep</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <div class="table-wrap rounded-xl border border-surface-300-700/50 overflow-hidden">
      <table class="table">
        <thead>
            <tr>
              <th class="font-medium cursor-pointer hover:text-primary-400 transition-colors" onclick={() => setSort('titleEn')}>
                <span class="inline-flex items-center gap-1">Title
                  {#if sortField === 'titleEn'}
                    {#if sortAsc}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
                  {/if}
                </span>
              </th>
              <th class="font-medium cursor-pointer hover:text-primary-400 transition-colors" onclick={() => setSort('entryType')}>
                <span class="inline-flex items-center gap-1">Type
                  {#if sortField === 'entryType'}
                    {#if sortAsc}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
                  {/if}
                </span>
              </th>
              <th class="font-medium cursor-pointer hover:text-primary-400 transition-colors text-right" onclick={() => setSort('episodeCount')}>
                <span class="inline-flex items-center gap-1">Episodes
                  {#if sortField === 'episodeCount'}
                    {#if sortAsc}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
                  {/if}
                </span>
              </th>
              <th class="font-medium cursor-pointer hover:text-primary-400 transition-colors text-right" onclick={() => setSort('filesOnDisk')}>
                <span class="inline-flex items-center gap-1">Files
                  {#if sortField === 'filesOnDisk'}
                    {#if sortAsc}<ChevronUp class="size-3" />{:else}<ChevronDown class="size-3" />{/if}
                  {/if}
                </span>
              </th>
            </tr>
        </thead>
        <tbody class="[&>tr]:hover:preset-tonal-primary">
          {#each filtered as item (item.id)}
            <tr class="cursor-pointer" onclick={() => onOpenAnime?.(item.id)}>
              <td class="text-sm text-surface-950-50 font-medium">{item.titleEn}</td>
              <td>
                <span class="{typeBadgeClass(item.entryType)} text-xs">
                  {entryTypeLabel(item.entryType)}
                </span>
              </td>
              <td class="text-sm text-surface-700-300 text-right">{item.episodeCount}</td>
              <td class="text-sm text-surface-700-300 text-right">{item.filesOnDisk}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
{/if}
