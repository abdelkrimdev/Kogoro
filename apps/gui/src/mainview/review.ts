import type { ReviewPlan } from "@kogoro/core";

export interface ReviewScreenOptions {
  rpc: {
    request: (method: string, params: unknown) => Promise<unknown>;
  };
  sessionId: string;
  plan: ReviewPlan;
  onComplete: () => void;
}

export function renderReviewScreen(container: HTMLElement, options: ReviewScreenOptions): void {
  const { rpc, sessionId, plan, onComplete } = options;

  const currentPlan = { ...plan };
  let searchQuery = "";
  let statusFilter: "all" | "matched" | "ambiguous" | "needs-attention" = "all";
  let draggedFileId: string | null = null;

  function getFilteredGroups() {
    return currentPlan.groups
      .map((group) => {
        const filteredFiles = group.files.filter((file) => {
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSource = file.sourcePath.toLowerCase().includes(query);
            const matchesProposed = file.proposedPath?.toLowerCase().includes(query);
            const matchesTitle = group.animeTitle.toLowerCase().includes(query);
            if (!matchesSource && !matchesProposed && !matchesTitle) {
              return false;
            }
          }

          if (statusFilter !== "all") {
            if (statusFilter === "needs-attention") {
              return file.status === "ambiguous" || file.status === "failed";
            }
            return file.status === statusFilter;
          }

          return true;
        });

        return { ...group, files: filteredFiles };
      })
      .filter((group) => group.files.length > 0);
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case "matched":
        return "bg-green-500/20 text-green-400";
      case "ambiguous":
        return "bg-yellow-500/20 text-yellow-400";
      case "failed":
        return "bg-red-500/20 text-red-400";
      case "cached":
        return "bg-blue-500/20 text-blue-400";
      default:
        return "bg-surface-500/20 text-surface-400";
    }
  }

  function render() {
    const filteredGroups = getFilteredGroups();

    container.innerHTML = `
      <div class="h-full flex flex-col">
        <div class="p-4 border-b border-surface-700 bg-surface-800/50">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold">Review Rename Plan</h2>
            <div class="flex gap-2">
              <button id="approve-all" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                Approve All
              </button>
              <button id="reject-all" class="px-4 py-2 bg-surface-600 hover:bg-surface-500 text-white rounded-lg text-sm font-medium transition-colors">
                Reject All
              </button>
              <button id="cancel" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                Cancel
              </button>
            </div>
          </div>
          
          <div class="flex items-center gap-4 text-sm text-surface-400 mb-4">
            <span>${currentPlan.totalFiles} files</span>
            <span>${currentPlan.groups.length} anime</span>
            <span>${currentPlan.ambiguousCount} ambiguous</span>
          </div>

          <div class="flex gap-4">
            <input
              type="text"
              id="search-input"
              placeholder="Search files or anime..."
              class="flex-1 px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              id="status-filter"
              class="px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-sm text-surface-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Status</option>
              <option value="matched">Matched</option>
              <option value="ambiguous">Ambiguous</option>
              <option value="needs-attention">Needs Attention</option>
            </select>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4 space-y-4">
          ${
            filteredGroups.length === 0
              ? `
            <div class="text-center text-surface-500 py-8">
              No files match your search or filter.
            </div>
          `
              : filteredGroups
                  .map(
                    (group) => `
            <div class="bg-surface-800 rounded-lg border border-surface-700 overflow-hidden">
              <div class="p-4 border-b border-surface-700 bg-surface-800/80">
                <div class="flex items-center gap-3">
                  ${
                    group.image
                      ? `
                    <img src="${group.image}" alt="${group.animeTitle}" class="w-12 h-12 rounded object-cover" />
                  `
                      : `
                    <div class="w-12 h-12 rounded bg-surface-700 flex items-center justify-center">
                      <svg class="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                  `
                  }
                  <div class="flex-1">
                    <h3 class="font-semibold text-surface-200">${group.animeTitle}</h3>
                    <p class="text-sm text-surface-400">${group.files.length} files • ${group.entryType}</p>
                  </div>
                  <div class="flex gap-2">
                    <button class="approve-group px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors">
                      Approve
                    </button>
                    <button class="reject-group px-3 py-1 bg-surface-600 hover:bg-surface-500 text-white rounded text-sm transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="divide-y divide-surface-700">
                ${group.files
                  .map(
                    (file) => `
                  <div 
                    class="file-row p-3 hover:bg-surface-700/50 transition-colors cursor-move"
                    data-file-id="${file.fileId}"
                    draggable="true"
                  >
                    <div class="flex items-center gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-sm font-medium text-surface-200 truncate">${file.sourcePath.split("/").pop()}</span>
                          <span class="px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(file.status)}">
                            ${file.status}
                          </span>
                        </div>
                        <div class="text-xs text-surface-500 truncate">${file.sourcePath}</div>
                        ${
                          file.proposedPath
                            ? `
                          <div class="text-xs text-green-400 truncate mt-1">→ ${file.proposedPath}</div>
                        `
                            : ""
                        }
                      </div>
                      ${
                        file.status === "ambiguous"
                          ? `
                        <button class="resolve-ambiguous px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors">
                          Resolve
                        </button>
                      `
                          : ""
                      }
                    </div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          `,
                  )
                  .join("")
          }
        </div>
      </div>
    `;

    // Add event listeners
    setupEventListeners();
  }

  function setupEventListeners() {
    const searchInput = document.getElementById("search-input") as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = (e.target as HTMLInputElement).value;
        render();
      });
    }

    const statusFilterEl = document.getElementById("status-filter") as HTMLSelectElement;
    if (statusFilterEl) {
      statusFilterEl.addEventListener("change", (e) => {
        statusFilter = (e.target as HTMLSelectElement).value as typeof statusFilter;
        render();
      });
    }

    const approveAllBtn = document.getElementById("approve-all");
    if (approveAllBtn) {
      approveAllBtn.addEventListener("click", async () => {
        try {
          await rpc.request("approvePlan", { sessionId });
          onComplete();
        } catch (err) {
          console.error("Failed to approve plan:", err);
        }
      });
    }

    const rejectAllBtn = document.getElementById("reject-all");
    if (rejectAllBtn) {
      rejectAllBtn.addEventListener("click", async () => {
        try {
          await rpc.request("rejectPlan", { sessionId });
          onComplete();
        } catch (err) {
          console.error("Failed to reject plan:", err);
        }
      });
    }

    const cancelBtn = document.getElementById("cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", async () => {
        try {
          await rpc.request("cancelScan", { sessionId });
          onComplete();
        } catch (err) {
          console.error("Failed to cancel scan:", err);
        }
      });
    }

    document.querySelectorAll(".approve-group").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await rpc.request("approvePlan", { sessionId });
          onComplete();
        } catch (err) {
          console.error("Failed to approve group:", err);
        }
      });
    });

    document.querySelectorAll(".reject-group").forEach((btn) => {
      btn.addEventListener("click", async () => {
        try {
          await rpc.request("rejectPlan", { sessionId });
          onComplete();
        } catch (err) {
          console.error("Failed to reject group:", err);
        }
      });
    });

    const fileRows = document.querySelectorAll(".file-row");
    fileRows.forEach((row) => {
      row.addEventListener("dragstart", (e) => {
        const fileId = (e.target as HTMLElement).getAttribute("data-file-id");
        if (fileId) {
          draggedFileId = fileId;
          (e as DragEvent).dataTransfer?.setData("text/plain", fileId);
        }
      });

      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.add("bg-surface-600/50");
      });

      row.addEventListener("dragleave", (e) => {
        (e.currentTarget as HTMLElement).classList.remove("bg-surface-600/50");
      });

      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).classList.remove("bg-surface-600/50");

        const fileId = (e.currentTarget as HTMLElement).getAttribute("data-file-id");
        if (fileId && draggedFileId && draggedFileId !== fileId) {
          try {
            await rpc.request("swapFiles", {
              sessionId,
              fileAId: draggedFileId,
              fileBId: fileId,
            });
          } catch (err) {
            console.error("Failed to swap files:", err);
          }
        }
        draggedFileId = null;
      });
    });
  }

  render();
}
