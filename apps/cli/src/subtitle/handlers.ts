import { existsSync } from "node:fs";
import { relative, sep } from "node:path";
import type { SubtitlePlugin } from "@kogoro/core";
import {
  type CacheService,
  type ConfigManager,
  hashFile,
  SCHEMA_DEFAULTS,
  walk,
} from "@kogoro/core";
import type { Logger } from "../logger";

export interface SubtitleHandlerOptions {
  subtitlePlugin: SubtitlePlugin;
  cacheService: CacheService;
  config?: ConfigManager;
}

export interface SubtitleFetchOptions {
  language?: string;
  force?: boolean;
}

export interface SubtitleSummary {
  downloaded: number;
  skipped: number;
  failed: number;
}

function resolveLanguage(cliLang: string | undefined, config?: ConfigManager): string {
  if (cliLang) return cliLang;
  const fromConfig = config?.subtitleLanguage;
  if (typeof fromConfig === "string" && fromConfig.trim()) return fromConfig;
  return SCHEMA_DEFAULTS["subtitle-language"];
}

export function createSubtitleHandlers(options: SubtitleHandlerOptions) {
  const { subtitlePlugin, cacheService } = options;

  async function fetch(
    dirPath: string,
    opts: SubtitleFetchOptions = {},
    logger: Logger,
  ): Promise<SubtitleSummary> {
    const language = resolveLanguage(opts.language, options.config);
    const force = opts.force ?? false;
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;

    const extensions =
      options.config?.resolveMediaExtensions() ?? SCHEMA_DEFAULTS["media-extensions"];
    const files = walk(dirPath, extensions);
    let completed = 0;

    for (const filePath of files) {
      const fileHash = await hashFile(filePath);
      const cached = cacheService.get(fileHash);

      if (!cached) {
        completed++;
        logger.progress(`matched=${completed}/${files.length} status=skipped`);
        continue;
      }

      const animeTitle = cached.animeTitle ?? extractAnimeTitle(dirPath, filePath);
      if (!animeTitle) {
        completed++;
        logger.progress(`matched=${completed}/${files.length} status=skipped`);
        continue;
      }

      const subtitlePath = `${filePath}.${language}.srt`;

      if (!force && existsSync(subtitlePath)) {
        skipped++;
        completed++;
        logger.progress(`matched=${completed}/${files.length} status=skipped`);
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
        logger.progress(`matched=${completed}/${files.length} status=failed`);
        continue;
      }

      const best = results[0];
      if (best === undefined) {
        failed++;
        completed++;
        logger.progress(`matched=${completed}/${files.length} status=failed`);
        continue;
      }
      const content = await subtitlePlugin.download(best.fileId);

      if (!content) {
        failed++;
        completed++;
        logger.progress(`matched=${completed}/${files.length} status=failed`);
        continue;
      }

      await Bun.write(subtitlePath, content);
      downloaded++;
      logger.info(`Downloaded: ${filePath} -> ${subtitlePath}`);
      completed++;
      logger.progress(`matched=${completed}/${files.length} status=downloaded`);
    }

    logger.info(`Summary: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    return { downloaded, skipped, failed };
  }

  return { fetch };
}

function extractAnimeTitle(basePath: string, filePath: string): string | undefined {
  const relativePath = relative(basePath, filePath);
  const parts = relativePath.split(sep);
  if (parts.length < 2) return undefined;
  return parts[0];
}
