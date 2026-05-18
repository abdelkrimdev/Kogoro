import { copyFileSync, linkSync, mkdirSync, renameSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import type { EntryType } from "./db/types.ts";
import type { MatchResult } from "./matcher.ts";
import type { ParsedTags } from "./parser.ts";
import { stripExtension } from "./parser.ts";
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

function buildDisambiguator(tags: ParsedTags): string {
  const parts: string[] = [];
  for (const key of ["resolution", "group", "source", "codec", "audio"] as const) {
    const val = tags[key];
    if (val) parts.push(val);
  }
  if (parts.length === 0) return "";
  return ` - [${parts.join("] [")}]`;
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

    const filenameContext = {
      anime: anime.title,
      ext: extension,
      ...(episode?.season !== undefined ? { season: episode.season } : {}),
      ...(episode?.episode !== undefined ? { episode: episode.episode } : {}),
      ...(episode?.title ? { title: episode.title } : {}),
    } as Record<string, string | number>;

    let targetFilename = render(this.filenameTemplate, filenameContext);
    let targetPath = `${targetDir}/${targetFilename}`;

    if (this.usedTargets.has(targetPath)) {
      const resolved = this.resolveCollision(targetDir, targetFilename, extension, tags);
      targetFilename = resolved.filename;
      targetPath = resolved.path;
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

  private resolveCollision(
    targetDir: string,
    baseFilename: string,
    extension: string,
    tags?: ParsedTags,
  ): { filename: string; path: string } {
    const base = stripExtension(baseFilename);
    const ext = `.${extension}`;

    if (tags) {
      const disambiguator = buildDisambiguator(tags);
      if (disambiguator) {
        const taggedFilename = `${base}${disambiguator}${ext}`;
        const taggedPath = `${targetDir}/${taggedFilename}`;
        if (!this.usedTargets.has(taggedPath)) {
          return { filename: taggedFilename, path: taggedPath };
        }
      }
    }

    let counter = 2;
    while (true) {
      const suffixedFilename = `${base} (${counter})${ext}`;
      const suffixedPath = `${targetDir}/${suffixedFilename}`;
      if (!this.usedTargets.has(suffixedPath)) {
        return { filename: suffixedFilename, path: suffixedPath };
      }
      counter++;
    }
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
