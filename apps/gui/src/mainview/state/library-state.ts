export type LibraryStateFilter = "all" | "on_disk" | "partially_on_disk" | "not_on_disk";

export type WatchStatusFilter =
  | "all"
  | "watching"
  | "completed"
  | "plan_to_watch"
  | "on_hold"
  | "dropped";

export type GroupInfo = {
  entryType: string;
  watchStatus: string;
};

export interface LibraryItem {
  id: string;
  titleEn: string;
  episodeCount: number;
  filesOnDisk: number;
  coverArt?: string;
  libraryState: LibraryStateFilter;
  groups: GroupInfo[];
  groupCount: number;
}

export interface LibraryState {
  items: LibraryItem[];
  search: string;
  viewMode: "grid" | "list";
  sortField: "titleEn" | "episodeCount" | "filesOnDisk" | "groupCount";
  sortAsc: boolean;
  libraryStateFilter: LibraryStateFilter;
  watchStatusFilter: WatchStatusFilter;
}

export function filterAndSort(state: LibraryState): LibraryItem[] {
  let result = state.items;

  if (state.search) {
    const q = state.search.toLowerCase();
    result = result.filter((item) => item.titleEn.toLowerCase().includes(q));
  }

  if (state.libraryStateFilter && state.libraryStateFilter !== "all") {
    result = result.filter((item) => item.libraryState === state.libraryStateFilter);
  }

  if (state.watchStatusFilter && state.watchStatusFilter !== "all") {
    result = result.filter((item) =>
      item.groups.some((g) => g.watchStatus === state.watchStatusFilter),
    );
  }

  result = [...result].sort((a, b) => {
    let cmp = 0;
    if (state.sortField === "titleEn") {
      cmp = a.titleEn.localeCompare(b.titleEn);
    } else if (state.sortField === "episodeCount") {
      cmp = a.episodeCount - b.episodeCount;
    } else if (state.sortField === "filesOnDisk") {
      cmp = a.filesOnDisk - b.filesOnDisk;
    } else if (state.sortField === "groupCount") {
      cmp = a.groupCount - b.groupCount;
    }
    return state.sortAsc ? cmp : -cmp;
  });

  return result;
}
