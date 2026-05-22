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
    "Query databases for Anime and Episode data",
    (yargs) =>
      yargs
        .command(
          "search <title>",
          "Search for Anime by title on TVDB and print results as JSON",
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
          "Get episodes for an Anime by TVDB ID and print as JSON",
          (yargs) =>
            yargs
              .positional("animeId", {
                type: "string",
                demandOption: true,
                describe: "TVDB Anime ID",
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
          "Query AniDB database for Anime and Episode data",
          (yargs) =>
            yargs
              .command(
                "search <title>",
                "Search for Anime by title on AniDB and print results as JSON",
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
                "Get episodes for an Anime by AniDB AID and print as JSON",
                (yargs) =>
                  yargs
                    .positional("animeId", {
                      type: "string",
                      demandOption: true,
                      describe: "AniDB Anime ID",
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
