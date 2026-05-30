import { ENTRY_LABELS, escapeHtml, typeBadgeClass } from "./shared";

type LibraryItem = {
  id: string;
  titleEn: string;
  entryType: string;
  episodeCount: number;
  coverArt?: string;
};

interface LibraryState {
  items: LibraryItem[];
  search: string;
  typeFilter: string[];
  viewMode: "grid" | "list";
  sortField: "titleEn" | "entryType" | "episodeCount";
  sortAsc: boolean;
}

const ENTRY_TYPES = ["tv", "movie", "ova", "special"];

function renderNoResults(): string {
  return `
    <div class="flex flex-col items-center justify-center h-full gap-3 py-16">
      <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p class="text-surface-500">No anime matches your search.</p>
    </div>
  `;
}

export function renderLibrary(
  container: HTMLElement,
  rpc: { request: (method: string, params: unknown) => Promise<unknown> },
  statusText: HTMLElement | null,
  onOpenAnime?: (id: string) => void,
): void {
  const state: LibraryState = {
    items: [],
    search: "",
    typeFilter: [],
    viewMode: "grid",
    sortField: "titleEn",
    sortAsc: true,
  };

  async function loadLibrary() {
    const result = await rpc.request("getLibrary", {});
    state.items = result as LibraryItem[];
    update();
  }

  function filterItems(): LibraryItem[] {
    let result = state.items;

    if (state.search) {
      const q = state.search.toLowerCase();
      result = result.filter((item) => item.titleEn.toLowerCase().includes(q));
    }

    if (state.typeFilter.length > 0) {
      result = result.filter((item) => state.typeFilter.includes(item.entryType));
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (state.sortField === "titleEn") {
        cmp = a.titleEn.localeCompare(b.titleEn);
      } else if (state.sortField === "entryType") {
        cmp = a.entryType.localeCompare(b.entryType);
      } else if (state.sortField === "episodeCount") {
        cmp = a.episodeCount - b.episodeCount;
      }
      return state.sortAsc ? cmp : -cmp;
    });

    return result;
  }

  function renderEmptyState(): string {
    return `
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <svg class="w-16 h-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p class="text-surface-500 text-lg">No library yet — scan a folder to get started.</p>
        <button data-action="go-scan" class="mt-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors">
          Go to Scan
        </button>
      </div>
    `;
  }

  function renderToolbar(): string {
    const chips = ENTRY_TYPES.map((t) => {
      const active = state.typeFilter.length === 0 || state.typeFilter.includes(t);
      const cls = active
        ? "bg-primary-500/20 text-primary-400 border-primary-500/40"
        : "bg-surface-700 text-surface-400 border-surface-600";
      return `<button data-action="toggle-type" data-type="${t}" class="px-3 py-1 rounded-full text-xs font-medium border transition-colors ${cls}">${ENTRY_LABELS[t] ?? t}</button>`;
    }).join("");

    return `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-800/50 flex-shrink-0">
        <div class="relative flex-1 max-w-xs">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input data-action="search" type="text" placeholder="Search anime..." value="${escapeHtml(state.search)}" class="w-full pl-9 pr-3 py-1.5 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-50 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50" />
        </div>
        <div class="flex items-center gap-2">
          ${chips}
        </div>
        <div class="flex items-center bg-surface-700 rounded-lg border border-surface-600 p-0.5">
          <button data-action="set-view" data-view="grid" class="px-2 py-1 rounded text-xs font-medium transition-colors ${state.viewMode === "grid" ? "bg-primary-500/20 text-primary-400" : "text-surface-400 hover:text-surface-200"}">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button data-action="set-view" data-view="list" class="px-2 py-1 rounded text-xs font-medium transition-colors ${state.viewMode === "list" ? "bg-primary-500/20 text-primary-400" : "text-surface-400 hover:text-surface-200"}">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  function renderGrid(items: LibraryItem[]): string {
    if (items.length === 0) {
      return renderNoResults();
    }

    const cards = items
      .map(
        (item) => `
        <div data-action="open-anime" data-id="${item.id}" class="group bg-surface-800 rounded-xl border border-surface-700 overflow-hidden cursor-pointer hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all">
          <div class="aspect-[2/3] bg-surface-700 relative overflow-hidden">
            ${
              item.coverArt
                ? `<img src="${escapeHtml(item.coverArt)}" alt="${escapeHtml(item.titleEn)}" class="w-full h-full object-cover" onerror="this.style.display='none'" />`
                : ""
            }
            <div class="absolute inset-0 flex items-center justify-center ${item.coverArt ? "hidden" : ""}">
              <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          </div>
          <div class="p-3 space-y-1.5">
            <h3 class="text-sm font-medium text-surface-100 truncate group-hover:text-primary-400 transition-colors">${escapeHtml(item.titleEn)}</h3>
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium ${typeBadgeClass(item.entryType)}">${ENTRY_LABELS[item.entryType] ?? item.entryType}</span>
              <span class="text-xs text-surface-500">${item.episodeCount} ep</span>
            </div>
          </div>
        </div>
      `,
      )
      .join("");

    return `<div class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-4">${cards}</div>`;
  }

  function renderList(items: LibraryItem[]): string {
    if (items.length === 0) {
      return renderNoResults();
    }

    const sortIcon = (field: string) => {
      if (state.sortField !== field) return "";
      return state.sortAsc
        ? '<svg class="w-3 h-3 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>'
        : '<svg class="w-3 h-3 ml-1 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>';
    };

    const rows = items
      .map(
        (item) => `
        <tr data-action="open-anime" data-id="${item.id}" class="border-t border-surface-700 hover:bg-surface-700/50 cursor-pointer transition-colors">
          <td class="px-4 py-2.5 text-sm text-surface-50 font-medium">${escapeHtml(item.titleEn)}</td>
          <td class="px-4 py-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-medium ${typeBadgeClass(item.entryType)}">${ENTRY_LABELS[item.entryType] ?? item.entryType}</span></td>
          <td class="px-4 py-2.5 text-sm text-surface-400 text-right">${item.episodeCount}</td>
        </tr>
      `,
      )
      .join("");

    return `
      <table class="w-full">
        <thead>
          <tr class="border-b border-surface-700 text-left text-xs text-surface-400 uppercase tracking-wider">
            <th data-action="sort" data-field="titleEn" class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors">Title${sortIcon("titleEn")}</th>
            <th data-action="sort" data-field="entryType" class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors">Type${sortIcon("entryType")}</th>
            <th data-action="sort" data-field="episodeCount" class="px-4 py-2.5 font-medium cursor-pointer hover:text-surface-200 transition-colors text-right">Episodes${sortIcon("episodeCount")}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function update(): void {
    const filtered = filterItems();
    const hasLibrary = state.items.length > 0;

    if (!hasLibrary) {
      container.innerHTML = renderEmptyState();
    } else {
      const body = state.viewMode === "grid" ? renderGrid(filtered) : renderList(filtered);
      container.innerHTML = renderToolbar() + body;
    }

    if (statusText) {
      statusText.textContent = hasLibrary ? `${filtered.length} anime` : "No library";
    }

    attachListeners();
  }

  function attachListeners(): void {
    container.querySelectorAll("[data-action='go-scan']").forEach((el) => {
      el.addEventListener("click", () => {
        document.querySelector<HTMLElement>("[data-nav='scan']")?.click();
      });
    });

    container.querySelectorAll("[data-action='search']").forEach((el) => {
      el.addEventListener("input", (e) => {
        state.search = (e.target as HTMLInputElement).value;
        update();
      });
    });

    container.querySelectorAll("[data-action='toggle-type']").forEach((el) => {
      el.addEventListener("click", () => {
        const type = el.getAttribute("data-type");
        if (!type) return;
        const idx = state.typeFilter.indexOf(type);
        if (idx >= 0) {
          state.typeFilter.splice(idx, 1);
        } else {
          state.typeFilter.push(type);
        }
        update();
      });
    });

    container.querySelectorAll("[data-action='set-view']").forEach((el) => {
      el.addEventListener("click", () => {
        state.viewMode = el.getAttribute("data-view") as "grid" | "list";
        update();
      });
    });

    container.querySelectorAll("[data-action='sort']").forEach((el) => {
      el.addEventListener("click", () => {
        const field = el.getAttribute("data-field") as LibraryState["sortField"];
        if (state.sortField === field) {
          state.sortAsc = !state.sortAsc;
        } else {
          state.sortField = field;
          state.sortAsc = true;
        }
        update();
      });
    });

    container.querySelectorAll("[data-action='open-anime']").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        if (id && onOpenAnime) {
          onOpenAnime(id);
        } else {
          console.log("Navigate to anime detail:", id);
        }
      });
    });
  }

  loadLibrary();
}
