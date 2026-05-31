<script lang="ts">
  import { filterAndSort, type LibraryItem } from "../state/library-state";
  import { ENTRY_LABELS, typeBadgeClass, entryTypeLabel } from "../shared";

  interface Props {
    rpc: { request: (method: string, params: unknown) => Promise<unknown> };
    onOpenAnime?: (id: string) => void;
  }

  let { rpc, onOpenAnime }: Props = $props();

  let items = $state<LibraryItem[]>([]);
  let search = $state("");
  let typeFilter = $state<string[]>([]);
  let viewMode = $state<"grid" | "list">("grid");
  let sortField = $state<"titleEn" | "entryType" | "episodeCount">("titleEn");
  let sortAsc = $state(true);

  const ENTRY_TYPES = ["tv", "movie", "ova", "special"];

  const filtered = $derived(
    filterAndSort({ items, search, typeFilter, viewMode, sortField, sortAsc }),
  );

  const hasLibrary = $derived(items.length > 0);

  async function loadLibrary() {
    const result = await rpc.request("getLibrary", {});
    items = result as LibraryItem[];
  }

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

  function sortIcon(field: string) {
    if (sortField !== field) return "";
    return sortAsc
      ? '<svg class="w-3 h-3 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>'
      : '<svg class="w-3 h-3 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>';
  }

  $effect(() => {
    loadLibrary();
  });
</script>

{#if !hasLibrary}
  <div class="flex flex-col items-center justify-center h-full gap-4">
    <svg class="w-16 h-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
    <p class="text-surface-500 text-lg">No library yet — scan a folder to get started.</p>
    <button
      class="mt-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
      onclick={() => document.querySelector<HTMLElement>("[data-nav='scan']")?.click()}
    >
      Go to Scan
    </button>
  </div>
{:else}
  <!-- Toolbar -->
  <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-800/50 flex-shrink-0">
    <div class="relative flex-1 max-w-xs">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        placeholder="Search anime..."
        value={search}
        oninput={(e) => (search = (e.target as HTMLInputElement).value)}
        class="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
      />
    </div>
    <div class="flex items-center gap-2">
      {#each ENTRY_TYPES as type}
        {@const active = typeFilter.length === 0 || typeFilter.includes(type)}
        <button
          class="px-3 py-1 rounded-full text-xs font-medium border transition-colors {active
            ? 'bg-primary-500/20 text-primary-400 border-primary-500/40'
            : 'bg-surface-700 text-surface-400 border-surface-600'}"
          onclick={() => toggleType(type)}
        >
          {entryTypeLabel(type)}
        </button>
      {/each}
    </div>
    <div class="flex items-center bg-surface-700 rounded-lg border border-surface-600 p-0.5">
      <button
        class="px-2 py-1 rounded text-xs font-medium transition-colors {viewMode === 'grid'
          ? 'bg-primary-500/20 text-primary-400'
          : 'text-surface-400 hover:text-surface-200'}"
        onclick={() => (viewMode = 'grid')}
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button
        class="px-2 py-1 rounded text-xs font-medium transition-colors {viewMode === 'list'
          ? 'bg-primary-500/20 text-primary-400'
          : 'text-surface-400 hover:text-surface-200'}"
        onclick={() => (viewMode = 'list')}
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Content -->
  {#if filtered.length === 0}
    <div class="flex flex-col items-center justify-center h-full gap-3 py-16">
      <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-surface-500">No anime matches your search.</p>
    </div>
  {:else if viewMode === 'grid'}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">
      {#each filtered as item (item.id)}
        <button
          class="group bg-surface-800 rounded-xl border border-surface-700 overflow-hidden cursor-pointer hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all text-left"
          onclick={() => onOpenAnime?.(item.id)}
        >
          <div class="aspect-[2/3] bg-surface-700 relative overflow-hidden">
            {#if item.coverArt}
              <img src={item.coverArt} alt={item.titleEn} class="w-full h-full object-cover" />
            {:else}
              <div class="absolute inset-0 flex items-center justify-center">
                <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            {/if}
          </div>
          <div class="p-3 space-y-1.5">
            <h3 class="text-sm font-medium text-surface-100 truncate group-hover:text-primary-400 transition-colors">
              {item.titleEn}
            </h3>
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium {typeBadgeClass(item.entryType)}">
                {entryTypeLabel(item.entryType)}
              </span>
              <span class="text-xs text-surface-500">{item.episodeCount} ep</span>
            </div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <table class="w-full">
      <thead>
        <tr class="border-b border-surface-700 text-left text-xs text-surface-400 uppercase tracking-wider">
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors" onclick={() => setSort('titleEn')}>
            Title {@html sortIcon('titleEn')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors" onclick={() => setSort('entryType')}>
            Type {@html sortIcon('entryType')}
          </th>
          <th class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors text-right" onclick={() => setSort('episodeCount')}>
            Episodes {@html sortIcon('episodeCount')}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as item (item.id)}
          <tr
            class="border-t border-surface-700 hover:bg-surface-700/50 cursor-pointer transition-colors"
            onclick={() => onOpenAnime?.(item.id)}
          >
            <td class="px-4 py-2.5 text-sm text-surface-50 font-medium">{item.titleEn}</td>
            <td class="px-4 py-2.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium {typeBadgeClass(item.entryType)}">
                {entryTypeLabel(item.entryType)}
              </span>
            </td>
            <td class="px-4 py-2.5 text-sm text-surface-400 text-right">{item.episodeCount}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
{/if}
