import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { type CachedMatch, MatchCache } from "./match-cache.ts";
import { stripExtension } from "./parser.ts";

export const VIDEO_EXTENSIONS = [".mkv", ".mp4", ".avi", ".mov"];

export interface MetadataSummary {
  total: number;
  written: number;
  skipped: number;
  failed: number;
}

export interface MetadataWriterOptions {
  cache: MatchCache;
  extensions?: string[];
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
  private extensions: string[];

  constructor(options: MetadataWriterOptions) {
    this.cache = options.cache;
    this.extensions = options.extensions ?? [...VIDEO_EXTENSIONS];
  }

  async write(dirPath: string, options?: { force?: boolean }): Promise<MetadataSummary> {
    const force = options?.force ?? false;
    let total = 0;
    let written = 0;
    let skipped = 0;
    let failed = 0;

    const videoFiles = this.walkDir(dirPath);

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

        const xml =
          match.entryType === "movie"
            ? this.generateMovieNfo(match)
            : this.generateEpisodeNfo(match);

        writeFileSync(nfoPath, xml, "utf-8");
        written++;
      } catch {
        failed++;
      }
    }

    return { total, written, skipped, failed };
  }

  private walkDir(dirPath: string): string[] {
    const files: string[] = [];
    const entries = readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...this.walkDir(fullPath));
      } else if (stat.isFile() && this.extensions.includes(extname(fullPath).toLowerCase())) {
        files.push(fullPath);
      }
    }
    return files;
  }

  generateEpisodeNfo(match: CachedMatch): string {
    const title = match.title ? escapeXml(match.title) : "";
    const season = match.season ?? 1;
    const episode = match.episode ?? 1;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
  <title>${title}</title>
  <showtitle></showtitle>
  <plot></plot>
  <aired></aired>
  <season>${season}</season>
  <episode>${episode}</episode>
  <displayseason>${season}</displayseason>
  <displayepisode>${episode}</displayepisode>
</episodedetails>`;
  }

  generateMovieNfo(match: CachedMatch): string {
    const title = match.title ? escapeXml(match.title) : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
  <title>${title}</title>
  <plot></plot>
  <aired></aired>
</movie>`;
  }
}
