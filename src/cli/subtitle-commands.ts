import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { MatchCache } from "../match-cache.ts";
import type { SubtitlePlugin } from "../subtitle/subtitle-plugin.ts";

const VIDEO_EXTENSIONS = new Set([".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm"]);

export interface SubtitleHandlerOptions {
  subtitlePlugin: SubtitlePlugin;
  cache: MatchCache;
}

export interface SubtitleFetchOptions {
  language?: string;
  force?: boolean;
}

export function createSubtitleHandlers(options: SubtitleHandlerOptions) {
  const { subtitlePlugin, cache } = options;

  async function fetch(
    dirPath: string,
    opts: SubtitleFetchOptions,
    onLog: (msg: string) => void,
    onError: (msg: string) => void,
  ): Promise<void> {
    const language = opts.language ?? "en";
    const force = opts.force ?? false;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const files = findVideoFiles(dirPath);

      for (const filePath of files) {
        const hash = await MatchCache.hashFile(filePath);
        const cached = cache.get(hash);

        if (!cached) {
          continue;
        }

        const animeTitle = cached.animeTitle ?? extractAnimeTitle(dirPath, filePath);
        if (!animeTitle) {
          continue;
        }

        const subtitlePath = `${filePath}.${language}.srt`;

        if (!force && existsSync(subtitlePath)) {
          skipped++;
          continue;
        }

        const results = await subtitlePlugin.search(
          animeTitle,
          cached.season ?? undefined,
          cached.episode ?? undefined,
          language,
        );

        if (results.length === 0) {
          failed++;
          continue;
        }

        const best = results[0];
        if (best === undefined) {
          failed++;
          continue;
        }
        const content = await subtitlePlugin.download(best.fileId);

        if (!content) {
          failed++;
          continue;
        }

        await Bun.write(subtitlePath, content);
        downloaded++;
        onLog(`Downloaded: ${filePath} -> ${subtitlePath}`);
      }

      onLog(`\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    } catch (err) {
      onError(`Subtitle fetch failed: ${String(err)}`);
    }
  }

  return { fetch };
}

function findVideoFiles(dirPath: string): string[] {
  const files: string[] = [];

  function walk(currentPath: string) {
    const entries = readdirSync(currentPath);
    for (const entry of entries) {
      const fullPath = join(currentPath, entry);
      const stats = statSync(fullPath);
      if (stats.isDirectory()) {
        walk(fullPath);
      } else if (stats.isFile() && VIDEO_EXTENSIONS.has(extname(fullPath).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return files;
}

function extractAnimeTitle(basePath: string, filePath: string): string | undefined {
  const relativePath = relative(basePath, filePath);
  const parts = relativePath.split(sep);
  if (parts.length < 2) return undefined;
  return parts[0];
}
