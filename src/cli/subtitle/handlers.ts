import { existsSync } from "node:fs";
import { relative, sep } from "node:path";
import { VIDEO_EXTENSIONS, walk } from "../../directory-walker";
import { MatchCache } from "../../match-cache";
import type { SubtitlePlugin } from "../../plugins/subtitle/plugin";

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
      const files = walk(dirPath, VIDEO_EXTENSIONS);

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

function extractAnimeTitle(basePath: string, filePath: string): string | undefined {
  const relativePath = relative(basePath, filePath);
  const parts = relativePath.split(sep);
  if (parts.length < 2) return undefined;
  return parts[0];
}
