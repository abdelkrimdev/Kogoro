import { extname } from "node:path";
import type { MatchResult } from "../matcher";
import { parse } from "../parser";
import type { EntryType } from "../plugins/database/types";
import { type FileAction, Renamer } from "../renamer";

export interface RenameHandlerOptions {
  filenameTemplate?: string;
  directoryTemplate?: string;
}

const DEFAULT_FILENAME_TEMPLATE = "{anime} - {season}x{episode:02} - {title}.{ext}";
const DEFAULT_DIRECTORY_TEMPLATE = "{anime}/{type}";

function normalizeEntryType(input: string): EntryType {
  const normalized = input.toLowerCase();
  switch (normalized) {
    case "tv":
    case "movie":
    case "ova":
    case "special":
      return normalized;
    default:
      return "tv";
  }
}

export function createRenameHandlers(options?: RenameHandlerOptions) {
  const renamer = new Renamer({
    filenameTemplate: options?.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE,
    directoryTemplate: options?.directoryTemplate ?? DEFAULT_DIRECTORY_TEMPLATE,
  });

  return {
    async rename(
      sourcePath: string,
      params: {
        anime: string;
        entryType: string;
        season?: number;
        episode?: number;
        title?: string;
        action?: FileAction;
      },
      onLog: (msg: string) => void,
      onError: (msg: string) => void,
    ): Promise<void> {
      try {
        const extension = extname(sourcePath).replace(".", "") || "mkv";
        const parsed = parse(sourcePath);

        const entryType = normalizeEntryType(params.entryType);

        const match: MatchResult = {
          anime: {
            id: "",
            title: params.anime,
            entryType,
          },
          episode: {
            id: "",
            animeId: "",
            season: params.season ?? 1,
            episode: params.episode ?? 1,
            title: params.title ?? "",
            entryType,
          },
          score: 1,
        };

        const plan = renamer.plan(sourcePath, match, extension, parsed.tags);
        plan.action = params.action ?? "move";

        onLog(JSON.stringify(plan, null, 2));
      } catch (err) {
        onError(String(err));
      }
    },
  };
}
