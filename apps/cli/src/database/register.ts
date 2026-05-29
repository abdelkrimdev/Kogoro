import { log } from "@clack/prompts";
import type yargs from "yargs";
import { createFormatter } from "../format";

type DatabaseHandlerFactory = (debug?: boolean) => Promise<
  | {
      search(
        title: string,
        onLog: (msg: string) => void,
        onError: (msg: string) => void,
      ): Promise<void>;
      episodes(
        animeId: string,
        onLog: (msg: string) => void,
        onError: (msg: string) => void,
      ): Promise<void>;
    }
  | undefined
>;

export function registerDb(
  parser: ReturnType<typeof yargs>,
  createHandlers: DatabaseHandlerFactory,
): void {
  parser.command(
    "db",
    "Query anime databases for search and episode listings",
    (yargs) =>
      yargs
        .command(
          "search <title>",
          "Search for anime by title",
          (yargs) =>
            yargs.positional("title", {
              type: "string",
              demandOption: true,
              describe: "Anime title to search for",
            }),
          async (argv) => {
            const handlers = await createHandlers(argv["debug"] as boolean | undefined);
            if (!handlers) return;
            await handlers.search(
              argv.title,
              createFormatter(!!argv["json"], (msg) => log.error(msg)),
              (msg) => log.error(msg),
            );
          },
        )
        .command(
          "episodes <animeId>",
          "Get episodes for an anime by ID",
          (yargs) =>
            yargs.positional("animeId", {
              type: "string",
              demandOption: true,
              describe: "Anime ID in the primary database",
            }),
          async (argv) => {
            const handlers = await createHandlers(argv["debug"] as boolean | undefined);
            if (!handlers) return;
            await handlers.episodes(
              argv.animeId,
              createFormatter(!!argv["json"], (msg) => log.error(msg)),
              (msg) => log.error(msg),
            );
          },
        )
        .demandCommand(1, "Please specify a db action: search or episodes"),
    () => {},
  );
}
