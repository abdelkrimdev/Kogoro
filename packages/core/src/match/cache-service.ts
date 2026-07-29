import type { ManifestRepository } from "./manifest-repository";
import type { CachedMatch, MatchRepository } from "./match-repository";
import type { MatchResult } from "./matcher";

export class CacheService {
  constructor(
    private matches: MatchRepository,
    private manifest: ManifestRepository,
  ) {}

  list() {
    return this.matches.list();
  }

  get(hash: string, sourceDb?: string): CachedMatch | null {
    if (sourceDb) {
      return this.matches.getByHashAndSourceDb(hash, sourceDb);
    }
    return this.matches.get(hash);
  }

  has(hash: string): boolean {
    return this.matches.has(hash);
  }

  set(hash: string, match: CachedMatch) {
    this.matches.set(hash, match);
  }

  storeMatchFromResult(hash: string, match: MatchResult, sourceDb: string): void {
    this.matches.set(hash, {
      animeId: match.anime.id,
      animeTitle: match.anime.titleEn,
      episodeId: match.episode?.id ?? null,
      entryType: match.anime.entryType,
      season: match.episode?.season ?? null,
      episode: match.episode?.episode ?? null,
      title: match.episode?.titleEn ?? null,
      sourceDb,
      timestamp: new Date().toISOString(),
    });
  }

  clear() {
    this.matches.clear();
    this.manifest.deleteAll();
  }

  purgeStale(currentPaths: string[]): void {
    this.manifest.transaction(() => {
      if (currentPaths.length === 0) {
        this.manifest.deleteAll();
        this.matches.clear();
        return;
      }

      const currentSet = new Set(currentPaths);
      const allPaths = this.manifest.getAllPaths();
      const stalePaths = allPaths.filter((p) => !currentSet.has(p));
      this.manifest.deleteBatch(stalePaths);

      const remainingHashes = new Set(this.manifest.getAllHashes());
      const allEntries = this.matches.list();
      for (const entry of allEntries) {
        if (!remainingHashes.has(entry.hash)) {
          this.matches.delete(entry.hash);
        }
      }
    });
  }
}
