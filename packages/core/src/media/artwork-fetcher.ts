import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { SCHEMA_DEFAULTS } from "../config/schema";
import { walk } from "../io/directory-walker";
import { hashFile } from "../io/file-hash";
import { HttpClient } from "../io/http-client";
import type { TaskContext } from "../io/progress";
import type { CacheService } from "../match/cache-service";
import type { ArtworkResult, DatabasePlugin } from "../types";

interface ArtworkFetcherOptions {
  primaryDb: DatabasePlugin;
  cacheService: CacheService;
  httpClient?: HttpClient;
  extensions?: readonly string[];
}

interface ArtworkSummary {
  total: number;
  downloaded: number;
  skipped: number;
  noArtwork: number;
}

export class ArtworkFetcher {
  private primaryDb: DatabasePlugin;
  private cacheService: CacheService;
  private httpClient: HttpClient;
  private extensions: readonly string[];

  constructor(options: ArtworkFetcherOptions) {
    this.primaryDb = options.primaryDb;
    this.cacheService = options.cacheService;
    this.httpClient = options.httpClient ?? new HttpClient();
    this.extensions = options.extensions ?? SCHEMA_DEFAULTS["media-extensions"];
  }

  async process(
    rootPath: string,
    options?: { force?: boolean },
    ctx?: TaskContext,
  ): Promise<ArtworkSummary> {
    const videoFiles = walk(rootPath, this.extensions);

    const animeMap = new Map<string, string[]>();

    for (const filePath of videoFiles) {
      if (ctx?.abortSignal?.aborted) break;
      const hash = await hashFile(filePath);
      const match = this.cacheService.get(hash);
      if (match) {
        const files = animeMap.get(match.animeId);
        if (files) {
          files.push(filePath);
        } else {
          animeMap.set(match.animeId, [filePath]);
        }
      }
    }

    let downloaded = 0;
    let skipped = 0;
    let noArtwork = 0;
    const total = animeMap.size;
    let completed = 0;

    for (const [animeId, files] of animeMap) {
      if (ctx?.abortSignal?.aborted) break;
      const animeDir = this.findCommonParent(files);

      const coverPath = join(animeDir, "cover.jpg");
      if (existsSync(coverPath) && !options?.force) {
        skipped++;
        ctx?.log(`[skip] ${animeId} — cover.jpg already exists`);
        completed++;
        ctx?.progress({ completed, total, file: animeId, status: "skipped" });
        continue;
      }

      const posterUrl = await this.findPosterUrl(animeId);
      if (!posterUrl) {
        noArtwork++;
        ctx?.log(`[no artwork] ${animeId} — no poster found`);
        completed++;
        ctx?.progress({ completed, total, file: animeId, status: "noArtwork" });
        continue;
      }

      await this.downloadImage(posterUrl, coverPath);
      downloaded++;
      ctx?.log(`[download] ${animeId} → ${coverPath}`);
      completed++;
      ctx?.progress({ completed, total, file: animeId, status: "downloaded" });
    }

    return { total, downloaded, skipped, noArtwork };
  }

  private pickBestPoster(artworks: ArtworkResult[]): ArtworkResult | undefined {
    let best: ArtworkResult | undefined;
    for (const artwork of artworks) {
      if (!best) {
        best = artwork;
        continue;
      }
      const bestRes = (best.width ?? 0) * (best.height ?? 0);
      const thisRes = (artwork.width ?? 0) * (artwork.height ?? 0);
      if (thisRes > bestRes) best = artwork;
    }
    return best;
  }

  private async findPosterUrl(animeId: string): Promise<string | undefined> {
    const primary = await this.primaryDb.getArtwork(animeId, "poster");
    const bestPrimary = this.pickBestPoster(primary);
    if (bestPrimary) return bestPrimary.url;
    return undefined;
  }

  private findCommonParent(paths: string[]): string {
    if (paths.length === 0) return ".";
    const firstPath = paths[0];
    if (!firstPath) return ".";
    if (paths.length === 1) return dirname(firstPath);

    const splitPaths = paths.map((p) => p.split(sep));
    const minLen = Math.min(...splitPaths.map((s) => s.length));
    const first = splitPaths[0];
    if (!first) return ".";
    let commonLen = 0;
    for (let i = 0; i < minLen; i++) {
      if (splitPaths.every((s) => s[i] === first[i])) {
        commonLen = i + 1;
      } else {
        break;
      }
    }
    return first.slice(0, commonLen).join(sep);
  }

  private async downloadImage(url: string, destPath: string): Promise<void> {
    const response = await this.httpClient.fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const dir = dirname(destPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    await Bun.write(destPath, buffer);
  }
}
