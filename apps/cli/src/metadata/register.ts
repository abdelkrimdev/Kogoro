import type yargs from "yargs";
import { createLogger, type Logger, type LogLevel } from "../logger";
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
      const level: LogLevel = argv["verbose"] ? "debug" : argv["quiet"] ? "error" : "info";
      const logger = createLogger(level);
      const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
      if (!handlers) return;
      const result = await handlers.write(argv.path, { force: argv.force }, logger);
      console.log(JSON.stringify(result));
    },
  );
}
