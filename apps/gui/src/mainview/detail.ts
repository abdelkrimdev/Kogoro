import { ENTRY_LABELS, escapeHtml, typeBadgeClass } from "./shared";

function sourceDbLabel(db: string): string {
  switch (db) {
    case "tvdb":
      return "TVDB";
    case "anidb":
      return "AniDB";
    default:
      return db;
  }
}

interface AnimeDetail {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    entryType: string;
    sourceDb: string;
    totalEpisodes: number;
    coverArt?: string;
  };
  episodes: Array<{
    id: string;
    season: number;
    episode: number;
    titleEn: string;
    filePath: string;
    missing: boolean;
  }>;
  filesOnDisk: number;
}

interface DetailState {
  detail: AnimeDetail | null;
  loading: boolean;
  error: string | null;
  artworkLoading: boolean;
  metadataLoading: boolean;
}

export function renderAnimeDetail(
  container: HTMLElement,
  rpc: {
    request: (method: string, params: unknown) => Promise<unknown>;
    on?: (event: string, handler: (data: unknown) => void) => void;
  },
  animeId: string,
  onBack: () => void,
  statusText: HTMLElement | null,
): void {
  const state: DetailState = {
    detail: null,
    loading: true,
    error: null,
    artworkLoading: false,
    metadataLoading: false,
  };

  async function loadDetail(): Promise<void> {
    state.loading = true;
    state.error = null;
    update();
    try {
      const result = (await rpc.request("getAnimeDetail", { id: animeId })) as AnimeDetail | null;
      state.detail = result;
      if (!result) {
        state.error = "Anime not found";
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "Failed to load anime details";
    }
    state.loading = false;
    update();
  }

  function update(): void {
    container.innerHTML = render();
    attachListeners();
  }

  function detectGaps(episodes: AnimeDetail["episodes"]): Set<number> {
    const gaps = new Set<number>();
    let prevEp = 0;
    for (const ep of episodes) {
      if (!ep.missing && prevEp > 0 && ep.episode > prevEp + 1) {
        for (let i = prevEp + 1; i < ep.episode; i++) {
          gaps.add(i);
        }
      }
      if (!ep.missing) {
        prevEp = ep.episode;
      }
    }
    return gaps;
  }

  function renderLoading(): string {
    return `
      <div class="flex items-center justify-center h-full">
        <div class="text-center space-y-3">
          <div class="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-surface-500 text-sm">Loading anime details...</p>
        </div>
      </div>
    `;
  }

  function renderError(error: string): string {
    return `
      <div class="flex flex-col items-center justify-center h-full gap-4">
        <svg class="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <p class="text-surface-400">${escapeHtml(error)}</p>
        <button data-action="back" class="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg text-sm transition-colors">
          Back to Library
        </button>
      </div>
    `;
  }

  function renderEpisodeTable(episodes: AnimeDetail["episodes"], gaps: Set<number>): string {
    if (episodes.length === 0) {
      return `
        <div class="text-center text-surface-500 py-8">
          No episodes found.
        </div>
      `;
    }

    function episodeRowClass(ep: AnimeDetail["episodes"][number]): string {
      if (ep.missing) return "text-surface-500 opacity-60";
      if (gaps.has(ep.episode)) return "text-amber-400";
      return "text-surface-100";
    }

    function episodeBadge(ep: AnimeDetail["episodes"][number]): string {
      if (ep.missing)
        return `<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Missing</span>`;
      if (gaps.has(ep.episode))
        return `<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Gap</span>`;
      return "";
    }

    const rows = episodes
      .map(
        (ep) => `
        <tr class="border-t border-surface-700/50 ${episodeRowClass(ep)}">
          <td class="px-4 py-2 text-sm font-medium whitespace-nowrap">
            ${ep.season}x${String(ep.episode).padStart(2, "0")}
            ${episodeBadge(ep)}
          </td>
          <td class="px-4 py-2 text-sm">${escapeHtml(ep.titleEn)}</td>
          <td class="px-4 py-2 text-sm text-surface-400 font-mono truncate max-w-xs">
            ${ep.filePath ? escapeHtml(ep.filePath) : '<span class="text-surface-600">—</span>'}
          </td>
        </tr>
      `,
      )
      .join("");

    return `
      <table class="w-full">
        <thead>
          <tr class="border-b border-surface-700 text-left text-xs text-surface-400 uppercase tracking-wider">
            <th class="px-4 py-2 font-medium">Episode</th>
            <th class="px-4 py-2 font-medium">Title</th>
            <th class="px-4 py-2 font-medium">File Path</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function render(): string {
    if (state.loading) return renderLoading();
    if (state.error || !state.detail) return renderError(state.error ?? "Unknown error");

    const d = state.detail;
    const typeLabel = ENTRY_LABELS[d.anime.entryType] ?? d.anime.entryType;
    const hasCover = Boolean(d.anime.coverArt);
    const gaps = detectGaps(d.episodes);
    const missingCount = d.episodes.filter((ep) => ep.missing).length;

    const artworkBtn = state.artworkLoading
      ? `<button disabled class="flex items-center gap-2 px-4 py-2 bg-surface-700 text-surface-500 rounded-lg text-sm cursor-not-allowed">
           <div class="w-4 h-4 border-2 border-surface-500 border-t-transparent rounded-full animate-spin"></div> Downloading...
         </button>`
      : `<button data-action="artwork" class="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
           </svg> Download Cover Art
         </button>`;

    const metadataBtn = state.metadataLoading
      ? `<button disabled class="flex items-center gap-2 px-4 py-2 bg-surface-700 text-surface-500 rounded-lg text-sm cursor-not-allowed">
           <div class="w-4 h-4 border-2 border-surface-500 border-t-transparent rounded-full animate-spin"></div> Generating...
         </button>`
      : `<button data-action="metadata" class="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
           <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
             <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg> Generate Metadata
         </button>`;

    return `
      <div class="flex flex-col h-full">
        <div class="flex items-center gap-3 px-4 py-3 border-b border-surface-700 bg-surface-800/50 flex-shrink-0">
          <button data-action="back" class="flex items-center gap-1 text-surface-400 hover:text-surface-200 transition-colors text-sm">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg> Library
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <div class="p-6">
            <div class="flex gap-6">
              <div class="w-48 flex-shrink-0">
                <div class="aspect-[2/3] bg-surface-700 rounded-xl overflow-hidden">
                  ${
                    hasCover
                      ? `<img src="${escapeHtml(d.anime.coverArt ?? "")}" alt="${escapeHtml(d.anime.titleEn)}" class="w-full h-full object-cover" />`
                      : `<div class="w-full h-full flex items-center justify-center">
                           <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                             <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                           </svg>
                         </div>`
                  }
                </div>
                <div class="flex flex-col gap-2 mt-4">
                  ${artworkBtn}
                  ${metadataBtn}
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <h1 class="text-xl font-bold text-surface-50">${escapeHtml(d.anime.titleEn)}</h1>
                ${d.anime.titleJa ? `<p class="text-surface-400 text-sm mt-1">${escapeHtml(d.anime.titleJa)}</p>` : ""}
                <div class="flex flex-wrap items-center gap-3 mt-3">
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${typeBadgeClass(d.anime.entryType)}">${typeLabel}</span>
                  <span class="text-sm text-surface-400">${sourceDbLabel(d.anime.sourceDb)}</span>
                  <span class="text-sm text-surface-500">·</span>
                  <span class="text-sm text-surface-300">${d.anime.totalEpisodes} episodes</span>
                  <span class="text-sm text-surface-500">·</span>
                  <span class="text-sm text-surface-300">${d.filesOnDisk} files on disk</span>
                  ${missingCount > 0 ? `<span class="text-sm text-surface-500">·</span><span class="text-sm text-amber-400">${missingCount} missing</span>` : ""}
                </div>

                <div class="mt-6">
                  <h2 class="text-sm font-medium text-surface-300 uppercase tracking-wider mb-2">Episodes</h2>
                  <div class="bg-surface-800/50 rounded-xl border border-surface-700/50 overflow-hidden">
                    ${renderEpisodeTable(d.episodes, gaps)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function attachListeners(): void {
    container.querySelectorAll("[data-action='back']").forEach((el) => {
      el.addEventListener("click", () => onBack());
    });

    container.querySelectorAll("[data-action='artwork']").forEach((el) => {
      el.addEventListener("click", async () => {
        state.artworkLoading = true;
        update();
        if (statusText) statusText.textContent = "Downloading cover art...";
        try {
          await rpc.request("enrichArtwork", { id: animeId });
        } catch (err) {
          console.error("Artwork enrichment failed:", err);
        }
        state.artworkLoading = false;
        await loadDetail();
        if (statusText) statusText.textContent = "Cover art download complete";
      });
    });

    container.querySelectorAll("[data-action='metadata']").forEach((el) => {
      el.addEventListener("click", async () => {
        state.metadataLoading = true;
        update();
        if (statusText) statusText.textContent = "Generating metadata...";
        try {
          await rpc.request("enrichMetadata", { id: animeId });
        } catch (err) {
          console.error("Metadata enrichment failed:", err);
        }
        state.metadataLoading = false;
        if (statusText) statusText.textContent = "Metadata generation complete";
      });
    });
  }

  loadDetail();
}
