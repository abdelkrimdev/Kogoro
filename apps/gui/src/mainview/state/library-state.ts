export interface LibraryItem {
  id: string;
  titleEn: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
}

export interface LibraryState {
  items: LibraryItem[];
  search: string;
  viewMode: "grid" | "list";
  sortField: "titleEn" | "episodeCount" | "filesOnDisk";
  sortAsc: boolean;
}

export function filterAndSort(state: LibraryState): LibraryItem[] {
  let result = state.items;

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter((item) => item.titleEn.toLowerCase().includes(q));
  }

  result = [...result].sort((a, b) => {
    let cmp = 0;
    if (state.sortField === "titleEn") {
      cmp = a.titleEn.localeCompare(b.titleEn);
    } else if (state.sortField === "episodeCount") {
      cmp = a.episodeCount - b.episodeCount;
    } else if (state.sortField === "filesOnDisk") {
      cmp = a.filesOnDisk - b.filesOnDisk;
    }
    return state.sortAsc ? cmp : -cmp;
  });

  return result;
}
