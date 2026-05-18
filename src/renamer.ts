import { copyFileSync, linkSync, mkdirSync, renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { EntryType } from "./db/types.ts";
import type { MatchResult } from "./matcher.ts";
import type { ParsedTags } from "./parser.ts";
import { render } from "./template-engine.ts";

export type FileAction = "move" | "copy" | "symlink" | "hardlink";

export interface RenamePlan {
  sourcePath: string;
  targetPath: string;
  targetDir: string;
  targetFilename: string;
  action: FileAction;
}

export interface RenamerOptions {
  filenameTemplate: string;
  directoryTemplate: string;
  action?: FileAction;
}

const ENTRY_TYPE_DIR_MAP: Record<EntryType, string> = {
  tv: "TV",
  movie: "Movies",
  ova: "OVA",
  special: "Specials",
};

function stripExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex === -1 ? name : name.slice(0, dotIndex);
}

function buildDisambiguator(tags: ParsedTags): string {
  const parts: string[] = [];
  for (const key of ["resolution", "group", "source", "codec", "audio"] as const) {
    const val = tags[key];
    if (val) parts.push(val);
  }
  if (parts.length === 0) return "";
  return ` - [${parts.join("] [")}]`;
}

function buildFilenameContext(
  animeTitle: string,
  extension: string,
  season?: number,
  episode?: number,
  episodeTitle?: string,
): Record<string, string | number> {
  const ctx: Record<string, string | number> = {
    anime: animeTitle,
    ext: extension,
  };
  // biome-ignore lint/complexity/useLiteralKeys: tsc noPropertyAccessFromIndexSignature
  if (season !== undefined) ctx["season"] = season;
  // biome-ignore lint/complexity/useLiteralKeys: tsc noPropertyAccessFromIndexSignature
  if (episode !== undefined) ctx["episode"] = episode;
  // biome-ignore lint/complexity/useLiteralKeys: tsc noPropertyAccessFromIndexSignature
  if (episodeTitle) ctx["title"] = episodeTitle;
  return ctx;
}

export class Renamer {
  private filenameTemplate: string;
  private directoryTemplate: string;
  private action: FileAction;
  private usedTargets: Set<string>;

  constructor(options: RenamerOptions) {
    this.filenameTemplate = options.filenameTemplate;
    this.directoryTemplate = options.directoryTemplate;
    this.action = options.action ?? "move";
    this.usedTargets = new Set();
  }

  plan(sourcePath: string, match: MatchResult, extension: string, tags?: ParsedTags): RenamePlan {
    const { anime, episode } = match;

    const dirContext: Record<string, string | number> = {
      anime: anime.title,
      type: ENTRY_TYPE_DIR_MAP[anime.entryType],
    };

    const targetDir = render(this.directoryTemplate, dirContext);

    const filenameContext = buildFilenameContext(
      anime.title,
      extension,
      episode?.season,
      episode?.episode,
      episode?.title,
    );

    let targetFilename = render(this.filenameTemplate, filenameContext);
    let targetPath = `${targetDir}/${targetFilename}`;

    if (this.usedTargets.has(targetPath)) {
      const base = stripExtension(targetFilename);
      const ext = `.${extension}`;

      if (tags) {
        const disambiguator = buildDisambiguator(tags);
        if (disambiguator) {
          const taggedFilename = `${base}${disambiguator}${ext}`;
          const taggedPath = `${targetDir}/${taggedFilename}`;
          if (!this.usedTargets.has(taggedPath)) {
            targetFilename = taggedFilename;
            targetPath = taggedPath;
            this.usedTargets.add(taggedPath);
            return { sourcePath, targetPath, targetDir, targetFilename, action: this.action };
          }
        }
      }

      let counter = 2;
      while (true) {
        const suffixedFilename = `${base} (${counter})${ext}`;
        const suffixedPath = `${targetDir}/${suffixedFilename}`;
        if (!this.usedTargets.has(suffixedPath)) {
          targetFilename = suffixedFilename;
          targetPath = suffixedPath;
          break;
        }
        counter++;
      }
    }

    this.usedTargets.add(targetPath);

    return {
      sourcePath,
      targetPath,
      targetDir,
      targetFilename,
      action: this.action,
    };
  }

  execute(plan: RenamePlan, baseDir?: string): void {
    const targetDir = baseDir ? join(baseDir, plan.targetDir) : plan.targetDir;
    const targetPath = baseDir ? join(baseDir, plan.targetPath) : plan.targetPath;

    mkdirSync(targetDir, { recursive: true });

    switch (plan.action) {
      case "move":
        renameSync(plan.sourcePath, targetPath);
        break;
      case "copy":
        copyFileSync(plan.sourcePath, targetPath);
        break;
      case "symlink":
        symlinkSync(plan.sourcePath, targetPath);
        break;
      case "hardlink":
        linkSync(plan.sourcePath, targetPath);
        break;
    }
  }
}
