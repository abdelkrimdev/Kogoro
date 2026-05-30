import type yargs from "yargs";

type DatabaseHandlerFactory = (debug?: boolean) => Promise<
  | {
      search(title: string): Promise<unknown>;
      episodes(animeId: string): Promise<unknown>;
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
            const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
            if (!handlers) return;
            const result = await handlers.search(argv.title);
            console.log(JSON.stringify(result));
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
            const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
            if (!handlers) return;
            const result = await handlers.episodes(argv.animeId);
            console.log(JSON.stringify(result));
          },
        )
        .demandCommand(1, "Please specify a db action: search or episodes"),
    () => {},
  );
}
