import type yargs from "yargs";
import type { FileAction } from "../../renamer";
import { createRenameHandlers } from "./handlers";

export function registerRename(parser: ReturnType<typeof yargs>): void {
  parser.command(
    "rename <source-file>",
    "Plan and execute a rename for a single MediaFile (debugging CLI)",
    (yargs) =>
      yargs
        .positional("source-file", {
          type: "string",
          demandOption: true,
          describe: "Path to the source MediaFile",
        })
        .option("anime", { type: "string", demandOption: true, describe: "Anime title" })
        .option("type", {
          type: "string",
          demandOption: true,
          describe: "Entry type (tv, movie, ova, special)",
        })
        .option("season", { type: "number", describe: "Season number" })
        .option("episode", { type: "number", describe: "Episode number" })
        .option("title", { type: "string", describe: "Episode title" })
        .option("action", {
          type: "string",
          choices: ["move", "copy", "symlink", "hardlink"] as const,
          default: "move",
          describe: "File operation to perform",
        }),
    async (argv) => {
      const handlers = createRenameHandlers();
      await handlers.rename(
        argv["source-file"],
        {
          anime: argv.anime,
          entryType: argv.type,
          season: argv.season,
          episode: argv.episode,
          title: argv.title,
          action: argv.action as FileAction,
        },
        console.log,
        console.error,
      );
    },
  );
}
