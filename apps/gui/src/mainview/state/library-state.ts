export interface LibraryItem {
  id: string;
  titleEn: string;
  entryType: string;
  episodeCount: number;
  coverArt?: string;
}

export interface LibraryState {
  items: LibraryItem[];
  search: string;
  typeFilter: string[];
  viewMode: "grid" | "list";
  sortField: "titleEn" | "entryType" | "episodeCount";
  sortAsc: boolean;
}

export function filterAndSort(state: LibraryState): LibraryItem[] {
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
