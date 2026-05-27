import { existsSync, writeFileSync } from "node:fs";
import { SCHEMA_DEFAULTS } from "./config/schema";
import { walk } from "./directory-walker";
import { type CachedMatch, MatchCache } from "./match-cache";
import { stripExtension } from "./parser";
import type { DatabasePlugin } from "./plugins/database/plugin";
import type { EpisodeResult } from "./plugins/database/types";

interface MetadataSummary {
  total: number;
  written: number;
  skipped: number;
  failed: number;
}

interface MetadataWriterOptions {
  cache: MatchCache;
  database?: DatabasePlugin;
  extensions?: readonly string[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export class MetadataWriter {
  private cache: MatchCache;
  private database?: DatabasePlugin;
  private extensions: readonly string[];

  constructor(options: MetadataWriterOptions) {
    this.cache = options.cache;
    this.database = options.database;
    this.extensions = options.extensions ?? SCHEMA_DEFAULTS["media-extensions"];
  }

  async write(dirPath: string, options?: { force?: boolean }): Promise<MetadataSummary> {
    const force = options?.force ?? false;
    let total = 0;
    let written = 0;
    let skipped = 0;
    let failed = 0;

    const videoFiles = walk(dirPath, this.extensions);
    const episodeCache = new Map<string, Map<number, EpisodeResult>>();
    const animeCache = new Map<string, string | undefined>();

    for (const filePath of videoFiles) {
      total++;
      try {
        const nfoPath = `${stripExtension(filePath)}.nfo`;

        if (!force && existsSync(nfoPath)) {
          skipped++;
          continue;
        }

        const hash = await MatchCache.hashFile(filePath);
        const match = this.cache.get(hash);

        if (!match) {
          skipped++;
          continue;
        }

        let episodeData: EpisodeResult | undefined;
        let dbAnimeTitle: string | undefined;
        if (this.database && match.animeId) {
          if (!episodeCache.has(match.animeId)) {
            const episodes = await this.database.getEpisodes(match.animeId);
            const map = new Map<number, EpisodeResult>();
            for (const ep of episodes) {
              map.set(ep.episode, ep);
            }
            episodeCache.set(match.animeId, map);
          }
          if (match.episode !== null) {
            const animeEpisodes = episodeCache.get(match.animeId);
            episodeData = animeEpisodes?.get(match.episode);
          }

          if (!animeCache.has(match.animeId)) {
            const anime = await this.database.getAnime(match.animeId);
            animeCache.set(match.animeId, anime?.titleEn);
          }
          dbAnimeTitle = animeCache.get(match.animeId);
        }

        const showTitle = dbAnimeTitle ?? match.animeTitle;
        let xml: string;
        switch (match.entryType) {
          case "movie":
            xml = this.generateMovieNfo(match, episodeData, showTitle);
            break;
          default:
            xml = this.generateEpisodeNfo(match, episodeData, showTitle);
        }

        writeFileSync(nfoPath, xml, "utf-8");
        written++;
      } catch {
        failed++;
      }
    }

    return { total, written, skipped, failed };
  }

  generateEpisodeNfo(match: CachedMatch, episodeData?: EpisodeResult, showTitle?: string): string {
    const title = escapeXml(match.title ?? "");
    const showTitleEscaped = escapeXml(showTitle ?? match.animeTitle ?? "");
    const plot = escapeXml(episodeData?.overview ?? "");
    const aired = escapeXml(episodeData?.airDate ?? "");
    const season = match.season ?? 1;
    const episode = match.episode ?? 1;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>${title}</title>
  <showtitle>${showTitleEscaped}</showtitle>
  <plot>${plot}</plot>
  <aired>${aired}</aired>
  <season>${season}</season>
  <episode>${episode}</episode>
  <displayseason>${season}</displayseason>
  <displayepisode>${episode}</displayepisode>
</episodedetails>`;
  }

  generateMovieNfo(match: CachedMatch, episodeData?: EpisodeResult, showTitle?: string): string {
    const title = escapeXml(showTitle ?? match.title ?? "");
    const plot = escapeXml(episodeData?.overview ?? showTitle ?? match.animeTitle ?? "");
    const aired = escapeXml(episodeData?.airDate ?? "");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${title}</title>
  <plot>${plot}</plot>
  <aired>${aired}</aired>
</movie>`;
  }
}
