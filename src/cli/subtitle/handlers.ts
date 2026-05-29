import { existsSync } from "node:fs";
import { relative, sep } from "node:path";
import type { ConfigManager } from "../../config/config-manager";
import { SCHEMA_DEFAULTS } from "../../config/schema";
import { walk } from "../../directory-walker";
import { MatchCache } from "../../match-cache";
import type { SubtitlePlugin } from "../../plugins/subtitle/plugin";
import type { TaskContext } from "../../progress";
import { resolveMediaExtensions } from "../extensions";

export interface SubtitleHandlerOptions {
  subtitlePlugin: SubtitlePlugin;
  cache: MatchCache;
  config?: ConfigManager;
}

export interface SubtitleFetchOptions {
  language?: string;
  force?: boolean;
}

function resolveLanguage(cliLang: string | undefined, config?: ConfigManager): string {
  if (cliLang) return cliLang;
  const fromConfig = config?.get("subtitle-language");
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig;
  return SCHEMA_DEFAULTS["subtitle-language"];
}

export function createSubtitleHandlers(options: SubtitleHandlerOptions) {
  const { subtitlePlugin, cache } = options;

  async function fetch(
    dirPath: string,
    opts: SubtitleFetchOptions = {},
    ctx?: TaskContext,
  ): Promise<void> {
    const language = resolveLanguage(opts.language, options.config);
    const force = opts.force ?? false;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const files = walk(dirPath, resolveMediaExtensions(options.config));
      let completed = 0;

      for (const filePath of files) {
        if (ctx?.abortSignal?.aborted) break;

        const hash = await MatchCache.hashFile(filePath);
        const cached = cache.get(hash);

        if (!cached) {
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "skipped" });
          continue;
        }

        const animeTitle = cached.animeTitle ?? extractAnimeTitle(dirPath, filePath);
        if (!animeTitle) {
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "skipped" });
          continue;
        }

        const subtitlePath = `${filePath}.${language}.srt`;

        if (!force && existsSync(subtitlePath)) {
          skipped++;
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "skipped" });
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
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "failed" });
          continue;
        }

        const best = results[0];
        if (best === undefined) {
          failed++;
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "failed" });
          continue;
        }
        const content = await subtitlePlugin.download(best.fileId);

        if (!content) {
          failed++;
          completed++;
          ctx?.progress({ completed, total: files.length, file: filePath, status: "failed" });
          continue;
        }

        await Bun.write(subtitlePath, content);
        downloaded++;
        ctx?.log(`Downloaded: ${filePath} -> ${subtitlePath}`);
        completed++;
        ctx?.progress({ completed, total: files.length, file: filePath, status: "downloaded" });
      }

      ctx?.log(`\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    } catch (err) {
      ctx?.error(`Subtitle fetch failed: ${String(err)}`);
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
