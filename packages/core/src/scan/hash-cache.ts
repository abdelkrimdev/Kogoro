import { statSync } from "node:fs";
import { basename } from "node:path";
import { hashFile } from "../io/file-hash";
import type { CacheService } from "../match/cache-service";
import type { CachedMatch } from "../match/match-repository";
import type { MatchResult } from "../match/matcher";
import type { OverrideData, OverrideStore } from "../match/override-store";
import type { ScanStateService } from "../match/scan-state-service";

function computeFileHash(input: string): string {
  return Bun.hash(input).toString(16);
}

export interface HashCacheOptions {
  cacheService: CacheService;
  overrideStore?: OverrideStore;
  scanStateService?: ScanStateService;
  sourceDb?: string;
}

export interface PreparedFile {
  filePath: string;
  hash: string;
  overrideKey: string;
  override: OverrideData | null;
  cachedMatch: CachedMatch | null;
  sourceDb: string;
}

export class HashCache {
  private cacheService: CacheService;
  private overrideStore?: OverrideStore;
  private scanStateService?: ScanStateService;
  private sourceDb: string;

  constructor(options: HashCacheOptions) {
    this.cacheService = options.cacheService;
    this.overrideStore = options.overrideStore;
    this.scanStateService = options.scanStateService;
    this.sourceDb = options.sourceDb ?? "tvdb";
  }

  async prepareFile(filePath: string, force?: boolean): Promise<PreparedFile> {
    const overrideKey = computeFileHash(basename(filePath));
    let hash = "";
    let cachedMatch: CachedMatch | null = null;
    let cachedStat: { size: number; mtimeMs: number } | null = null;

    if (!force && this.scanStateService) {
      try {
        const stat = statSync(filePath);
        cachedStat = { size: stat.size, mtimeMs: stat.mtimeMs };
        const cachedHash = this.scanStateService.isFileUpToDate(
          filePath,
          stat.size,
          Math.floor(stat.mtimeMs / 1000),
        );
        if (cachedHash) {
          hash = cachedHash;
          cachedMatch = this.cacheService.get(hash, this.sourceDb);
          const override = this.overrideStore?.get(overrideKey) ?? null;
          return { filePath, hash, overrideKey, override, cachedMatch, sourceDb: this.sourceDb };
        }
      } catch {
        // stat failed, fall through to full hash
      }
    }

    hash = await hashFile(filePath);

    if (!force) {
      cachedMatch = this.cacheService.get(hash, this.sourceDb);
    }

    if (this.scanStateService) {
      try {
        const stat = cachedStat ?? statSync(filePath);
        this.scanStateService.set(filePath, stat.size, Math.floor(stat.mtimeMs / 1000), hash);
      } catch {
        // stat failed, skip state storage
      }
    }

    const override = this.overrideStore?.get(overrideKey) ?? null;

    return { filePath, hash, overrideKey, override, cachedMatch, sourceDb: this.sourceDb };
  }

  async persistMatch(filePath: string, hash: string, match: MatchResult): Promise<string> {
    const resolvedHash = hash || (await hashFile(filePath));

    this.cacheService.storeMatchFromResult(resolvedHash, match, this.sourceDb);

    return resolvedHash;
  }

  persistOverride(filePath: string, match: MatchResult): void {
    if (!this.overrideStore) return;

    const overrideKey = computeFileHash(basename(filePath));

    this.overrideStore.set(overrideKey, {
      animeId: match.anime.id,
      episodeId: match.episode?.id,
      entryType: match.anime.entryType,
    });
  }
}
