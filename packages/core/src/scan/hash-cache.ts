import { basename } from "node:path";
import { hashFile } from "../io/file-hash";
import type { CacheService } from "../match/cache-service";
import type { CachedMatch } from "../match/match-repository";
import type { MatchResult } from "../match/matcher";
import type { OverrideData, OverrideStore } from "../match/override-store";

export function computeFileHash(input: string): string {
  return Bun.hash(input).toString(16);
}

export interface HashCacheOptions {
  cacheService?: CacheService;
  overrideStore?: OverrideStore;
  sourceDb?: string;
}

export interface PreparedFile {
  filePath: string;
  hash: string;
  overrideKey: string;
  override: OverrideData | null;
  cachedMatch: CachedMatch | null;
}

export class HashCache {
  private cacheService?: CacheService;
  private overrideStore?: OverrideStore;
  private sourceDb: string;

  constructor(options: HashCacheOptions) {
    this.cacheService = options.cacheService;
    this.overrideStore = options.overrideStore;
    this.sourceDb = options.sourceDb ?? "tvdb";
  }

  getSourceDb(): string {
    return this.sourceDb;
  }

  async prepareFile(
    filePath: string,
    _extensions?: readonly string[],
    force?: boolean,
  ): Promise<PreparedFile> {
    const overrideKey = computeFileHash(basename(filePath));
    let hash = "";
    let cachedMatch: CachedMatch | null = null;

    if (this.cacheService) {
      hash = await hashFile(filePath);
      if (!force) {
        cachedMatch = this.cacheService.get(hash, this.sourceDb);
      }
    }

    const override = this.overrideStore?.get(overrideKey) ?? null;

    return { filePath, hash, overrideKey, override, cachedMatch };
  }

  async persistMatch(filePath: string, hash: string, match: MatchResult): Promise<string> {
    if (!this.cacheService) return hash;

    const resolvedHash = hash || (await hashFile(filePath));

    this.cacheService.storeMatchFromResult(resolvedHash, match, this.sourceDb);

    return resolvedHash;
  }

  persistOverride(overrideKey: string | undefined, match: MatchResult): void {
    if (!this.overrideStore || !overrideKey) return;

    this.overrideStore.set(overrideKey, {
      animeId: match.anime.id,
      episodeId: match.episode?.id,
      entryType: match.anime.entryType,
    });
  }
}
