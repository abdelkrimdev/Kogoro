import type yargs from "yargs";

export type DatabaseHandlerFactory = (
  name: string,
  debug?: boolean,
) => Promise<
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
          "Search for anime by title and print results as JSON",
          (yargs) =>
            yargs
              .positional("title", {
                type: "string",
                demandOption: true,
                describe: "Anime title to search for",
              })
              .option("debug", {
                type: "boolean",
                default: false,
                describe: "Dump API requests and responses",
              }),
          async (argv) => {
            const commands = await createHandlers("tvdb", argv.debug);
            if (!commands) return;
            await commands.search(argv.title, console.log, console.error);
          },
        )
        .command(
          "episodes <animeId>",
          "Get episodes for an anime by ID and print as JSON",
          (yargs) =>
            yargs
              .positional("animeId", {
                type: "string",
                demandOption: true,
                describe: "Anime ID in the primary database",
              })
              .option("debug", {
                type: "boolean",
                default: false,
                describe: "Dump API requests and responses",
              }),
          async (argv) => {
            const commands = await createHandlers("tvdb", argv.debug);
            if (!commands) return;
            await commands.episodes(argv.animeId, console.log, console.error);
          },
        )
        .command(
          "anidb",
          "Query AniDB for anime and episode data",
          (yargs) =>
            yargs
              .command(
                "search <title>",
                "Search for anime by title on AniDB and print results as JSON",
                (yargs) =>
                  yargs
                    .positional("title", {
                      type: "string",
                      demandOption: true,
                      describe: "Anime title to search for",
                    })
                    .option("debug", {
                      type: "boolean",
                      default: false,
                      describe: "Dump API requests and responses",
                    }),
                async (argv) => {
                  const commands = await createHandlers("anidb", argv.debug);
                  if (!commands) return;
                  await commands.search(argv.title, console.log, console.error);
                },
              )
              .command(
                "episodes <animeId>",
                "Get episodes for an anime by AniDB ID and print as JSON",
                (yargs) =>
                  yargs
                    .positional("animeId", {
                      type: "string",
                      demandOption: true,
                      describe: "AniDB anime ID",
                    })
                    .option("debug", {
                      type: "boolean",
                      default: false,
                      describe: "Dump API requests and responses",
                    }),
                async (argv) => {
                  const commands = await createHandlers("anidb", argv.debug);
                  if (!commands) return;
                  await commands.episodes(argv.animeId, console.log, console.error);
                },
              )
              .demandCommand(1, "Please specify an anidb action: search or episodes"),
          () => {},
        )
        .demandCommand(1, "Please specify a db action: search, episodes, or anidb"),
    () => {},
  );
}
