import type yargs from "yargs";
import { createLogger, type Logger, resolveLogLevel } from "../logger";
import { wrapCommand } from "../wrap";
import type { ArtworkSummary } from "./handlers";

type ArtworkHandlerFactory = (debug?: boolean) => Promise<
  | {
      process(
        path: string,
        cliOptions: { force?: boolean },
        logger: Logger,
      ): Promise<ArtworkSummary>;
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
        }),
    async (argv) => {
      const logger = createLogger(resolveLogLevel(argv));
      const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
      if (!handlers) return;
      await wrapCommand(async () => handlers.process(argv.path, { force: argv.force }, logger));
    },
  );
}
