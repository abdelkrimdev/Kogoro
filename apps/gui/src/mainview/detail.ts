function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "tv":
      return "bg-primary-500/20 text-primary-400";
    case "movie":
      return "bg-emerald-500/20 text-emerald-400";
    case "ova":
      return "bg-amber-500/20 text-amber-400";
    case "special":
      return "bg-rose-500/20 text-rose-400";
    default:
      return "bg-surface-600 text-surface-300";
  }
}

function entryTypeLabel(type: string): string {
  switch (type) {
    case "tv":
      return "TV";
    case "movie":
      return "Movie";
    case "ova":
      return "OVA";
    case "special":
      return "Specials";
    default:
      return type;
  }
}

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

export interface AnimeDetailOptions {
  rpc: { request: (method: string, params: unknown) => Promise<unknown> };
  animeId: string;
  onBack: () => void;
}

interface EpisodeRow {
  id: string;
  season: number;
  episode: number;
  titleEn: string;
  filePath: string;
  missing: boolean;
}

interface AnimeDetailData {
  anime: {
    id: string;
    titleEn: string;
    titleJa?: string;
    entryType: string;
    sourceDb: string;
    totalEpisodes: number;
    coverArt?: string;
  };
  episodes: EpisodeRow[];
  filesOnDisk: number;
}

export function renderAnimeDetail(container: HTMLElement, options: AnimeDetailOptions): void {
  const { rpc, animeId, onBack } = options;

  async function loadDetail(): Promise<AnimeDetailData | null> {
    try {
      return (await rpc.request("getAnimeDetail", { id: animeId })) as AnimeDetailData | null;
    } catch {
      return null;
    }
  }

  function detectGaps(episodes: EpisodeRow[]): Set<number> {
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

  function renderEpisodeTable(episodes: EpisodeRow[], gaps: Set<number>): string {
    if (episodes.length === 0) {
      return `
        <div class="text-center text-surface-500 py-8">
          No episodes found.
        </div>
      `;
    }

    const rows = episodes
      .map((ep) => {
        const isGap = gaps.has(ep.episode);
        const rowClass = ep.missing
          ? "text-surface-500 opacity-60"
          : isGap
            ? "text-amber-400"
            : "text-surface-100";

        return `
        <tr class="border-t border-surface-700/50 ${rowClass}">
          <td class="px-4 py-2 text-sm font-medium whitespace-nowrap">
            ${ep.season}x${String(ep.episode).padStart(2, "0")}
            ${ep.missing ? '<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Missing</span>' : ""}
            ${isGap && !ep.missing ? '<span class="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Gap</span>' : ""}
          </td>
          <td class="px-4 py-2 text-sm">${escapeHtml(ep.titleEn)}</td>
          <td class="px-4 py-2 text-sm text-surface-400 font-mono truncate max-w-xs">
            ${ep.filePath ? escapeHtml(ep.filePath) : '<span class="text-surface-600">—</span>'}
          </td>
        </tr>
      `;
      })
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

  async function render(): Promise<void> {
    const data = await loadDetail();

    if (!data) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center gap-4">
          <p class="text-surface-500">Anime not found.</p>
          <button id="back-btn" class="px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors">
            Back to Library
          </button>
        </div>
      `;
      container.querySelector("#back-btn")?.addEventListener("click", onBack);
      return;
    }

    const { anime, episodes, filesOnDisk } = data;
    const gaps = detectGaps(episodes);
    const missingCount = episodes.filter((ep) => ep.missing).length;

    container.innerHTML = `
      <div class="h-full flex flex-col">
        <div class="flex-shrink-0 px-6 py-4 border-b border-surface-700 bg-surface-800/50">
          <button id="back-btn" class="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors mb-4">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </button>
          <div class="flex gap-6">
            <div class="w-36 flex-shrink-0">
              ${
                anime.coverArt
                  ? `<img src="${escapeHtml(anime.coverArt)}" alt="${escapeHtml(anime.titleEn)}" class="w-full rounded-lg object-cover shadow-lg" onerror="this.style.display='none'" />`
                  : `<div class="w-full aspect-[2/3] bg-surface-700 rounded-lg flex items-center justify-center">
                    <svg class="w-12 h-12 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>`
              }
            </div>
            <div class="flex-1 min-w-0 space-y-3">
              <h1 class="text-2xl font-bold text-surface-100 truncate">${escapeHtml(anime.titleEn)}</h1>
              ${anime.titleJa ? `<p class="text-sm text-surface-400">${escapeHtml(anime.titleJa)}</p>` : ""}
              <div class="flex flex-wrap items-center gap-3 text-sm">
                <span class="px-2 py-0.5 rounded text-xs font-medium ${typeBadgeClass(anime.entryType)}">${entryTypeLabel(anime.entryType)}</span>
                <span class="text-surface-400">${sourceDbLabel(anime.sourceDb)}</span>
                <span class="text-surface-500">·</span>
                <span class="text-surface-300">${anime.totalEpisodes} episodes</span>
                <span class="text-surface-500">·</span>
                <span class="text-surface-300">${filesOnDisk} files on disk</span>
                ${missingCount > 0 ? `<span class="text-surface-500">·</span><span class="text-amber-400">${missingCount} missing</span>` : ""}
              </div>
            </div>
          </div>
        </div>
        <div class="flex-1 overflow-auto">
          ${renderEpisodeTable(episodes, gaps)}
        </div>
        <div class="flex-shrink-0 px-6 py-4 border-t border-surface-700 bg-surface-800/50 flex gap-3">
          <button id="btn-artwork" class="px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors">
            Artwork
          </button>
          <button id="btn-metadata" class="px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors">
            Metadata
          </button>
          <button id="btn-rescan" class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
            Rescan
          </button>
        </div>
      </div>
    `;

    container.querySelector("#back-btn")?.addEventListener("click", onBack);
    container.querySelector("#btn-artwork")?.addEventListener("click", () => {
      const statusText = document.getElementById("status-text");
      if (statusText) {
        statusText.textContent = "Artwork download queued (stub)";
      }
    });
    container.querySelector("#btn-metadata")?.addEventListener("click", () => {
      const statusText = document.getElementById("status-text");
      if (statusText) {
        statusText.textContent = "Metadata generation queued (stub)";
      }
    });
    container.querySelector("#btn-rescan")?.addEventListener("click", () => {
      const statusText = document.getElementById("status-text");
      if (statusText) {
        statusText.textContent = `Rescan queued for ${escapeHtml(anime.titleEn)} (stub)`;
      }
    });
  }

  render();
}
