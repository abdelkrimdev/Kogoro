export interface GroupApproval {
  approve(animeId: string): void;
  reject(animeId: string): void;
  shouldExecute(originalId: string, canonicalIdMap: Map<string, string>): boolean;
  isApproved(canonicalId: string): boolean;
  isRejected(canonicalId: string): boolean;
  clear(): void;
  readonly hasApprovals: boolean;
}

export function createGroupApproval(): GroupApproval {
  const approvedAnimeIds = new Set<string>();
  const rejectedAnimeIds = new Set<string>();

  return {
    approve(animeId) {
      approvedAnimeIds.add(animeId);
      rejectedAnimeIds.delete(animeId);
    },
    reject(animeId) {
      rejectedAnimeIds.add(animeId);
      approvedAnimeIds.delete(animeId);
    },
    shouldExecute(originalId, canonicalIdMap) {
      const canonicalId = canonicalIdMap.get(originalId) ?? originalId;
      if (approvedAnimeIds.has(canonicalId)) return true;
      if (rejectedAnimeIds.has(canonicalId)) return false;
      if (approvedAnimeIds.size > 0) return false;
      return true;
    },
    isApproved(canonicalId) {
      return approvedAnimeIds.has(canonicalId);
    },
    isRejected(canonicalId) {
      return rejectedAnimeIds.has(canonicalId);
    },
    clear() {
      approvedAnimeIds.clear();
      rejectedAnimeIds.clear();
    },
    get hasApprovals() {
      return approvedAnimeIds.size > 0;
    },
  };
}
