import { extname } from "node:path";
import { parse } from "../parser.ts";
import { type FileAction, Renamer } from "../renamer.ts";

export interface RenameHandlerOptions {
  filenameTemplate?: string;
  directoryTemplate?: string;
}

const DEFAULT_FILENAME_TEMPLATE = "{anime} - {season}x{episode:02} - {title}.{ext}";
const DEFAULT_DIRECTORY_TEMPLATE = "{anime}/{type}";

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

        const entryTypeNormalized = params.entryType.toLowerCase();
        const validTypes = ["tv", "movie", "ova", "special"];
        const entryType = validTypes.includes(entryTypeNormalized) ? entryTypeNormalized : "tv";

        const match = {
          anime: {
            id: "",
            title: params.anime,
            entryType: entryType as "tv" | "movie" | "ova" | "special",
          },
          episode: {
            id: "",
            animeId: "",
            season: params.season ?? 1,
            episode: params.episode ?? 1,
            title: params.title ?? "",
            entryType: entryType as "tv" | "movie" | "ova" | "special",
          },
          score: 1,
        };

        const plan = renamer.plan(sourcePath, match, extension, parsed.tags);
        plan.action = (params.action ?? "move") as FileAction;

        onLog(JSON.stringify(plan, null, 2));
      } catch (err) {
        onError(String(err));
      }
    },
  };
}
