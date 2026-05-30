import type yargs from "yargs";
import { createLogger, type Logger, resolveLogLevel } from "../logger";
import { wrapCommand } from "../wrap";
import type { MetadataResult } from "./handlers";

type MetadataHandlerFactory = (debug?: boolean) => Promise<
  | {
      write(path: string, cliOptions: { force?: boolean }, logger: Logger): Promise<MetadataResult>;
    }
  | undefined
>;

export function registerMetadata(
  parser: ReturnType<typeof yargs>,
  createHandlers: MetadataHandlerFactory,
): void {
  parser.command(
    "metadata <path>",
    "Write missing .nfo metadata sidecar files",
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
          describe: "Overwrite existing .nfo files",
        }),
    async (argv) => {
      const logger = createLogger(resolveLogLevel(argv));
      const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
      if (!handlers) return;
      await wrapCommand(async () => handlers.write(argv.path, { force: argv.force }, logger));
    },
  );
}
