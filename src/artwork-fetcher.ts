import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { VIDEO_EXTENSIONS, walk } from "./directory-walker";
import { HttpClient } from "./http-client";
import { MatchCache } from "./match-cache";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { ArtworkResult } from "./plugins/database/types";

export interface ArtworkFetcherOptions {
  primaryDb: DatabasePlugin;
  secondaryDbs?: DatabasePlugin[];
  cache: MatchCache;
  httpClient?: HttpClient;
}

export interface ArtworkSummary {
  total: number;
  downloaded: number;
  skipped: number;
  noArtwork: number;
}

export class ArtworkFetcher {
  private primaryDb: DatabasePlugin;
  private secondaryDbs: DatabasePlugin[];
  private cache: MatchCache;
  private httpClient: HttpClient;

  constructor(options: ArtworkFetcherOptions) {
    this.primaryDb = options.primaryDb;
    this.secondaryDbs = options.secondaryDbs ?? [];
    this.cache = options.cache;
    this.httpClient = options.httpClient ?? new HttpClient();
  }

  async process(
    rootPath: string,
    options?: { force?: boolean },
    onLog?: (msg: string) => void,
  ): Promise<ArtworkSummary> {
    const videoFiles = walk(rootPath, VIDEO_EXTENSIONS);

    const animeMap = new Map<string, string[]>();

    for (const filePath of videoFiles) {
      const hash = await MatchCache.hashFile(filePath);
      const match = this.cache.get(hash);
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

    for (const [animeId, files] of animeMap) {
      const animeDir = this.findCommonParent(files);

      const coverPath = join(animeDir, "cover.jpg");
      if (existsSync(coverPath) && !options?.force) {
        skipped++;
        if (onLog) onLog(`[skip] ${animeId} — cover.jpg already exists`);
        continue;
      }

      const posterUrl = await this.findPosterUrl(animeId);
      if (!posterUrl) {
        noArtwork++;
        if (onLog) onLog(`[no artwork] ${animeId} — no poster found`);
        continue;
      }

      await this.downloadImage(posterUrl, coverPath);
      downloaded++;
      if (onLog) onLog(`[download] ${animeId} → ${coverPath}`);
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

    for (const db of this.secondaryDbs) {
      const artworks = await db.getArtwork(animeId, "poster");
      const artwork = this.pickBestPoster(artworks);
      if (artwork) return artwork.url;
    }

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
