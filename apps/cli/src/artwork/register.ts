import type yargs from "yargs";

type ArtworkHandlerFactory = (debug?: boolean) => Promise<
  | {
      process(
        path: string,
        cliOptions: { force?: boolean; verbose?: boolean; quiet?: boolean },
      ): Promise<void>;
    }
  | undefined
>;

export function registerArtwork(
  parser: ReturnType<typeof yargs>,
  createHandlers: ArtworkHandlerFactory,
): void {
  parser.command(
    "artwork <path>",
    "Fetch missing artwork for matched Anime",
    (yargs) =>
      yargs
        .positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        })
        .option("force", {
          type: "boolean",
          default: false,
          describe: "Overwrite existing cover.jpg files",
        })
        .option("verbose", {
          type: "boolean",
          default: false,
          describe: "Show per-anime status messages",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv["debug"] as boolean | undefined);
      if (!handlers) return;
      await handlers.process(argv.path, {
        force: argv.force,
        verbose: argv.verbose,
      });
    },
  );
}
