import { SCHEMA_DEFAULTS } from "@kogoro/core";
import type yargs from "yargs";
import { createLogger, type Logger, type LogLevel } from "../logger";
import { wrapCommand } from "../wrap";
import type { SubtitleSummary } from "./handlers";

type SubtitleHandlerFactory = (debug?: boolean) => Promise<
  | {
      fetch(
        dirPath: string,
        opts: { language?: string; force?: boolean },
        logger: Logger,
      ): Promise<SubtitleSummary>;
    }
  | undefined
>;

export function registerSubtitle(
  parser: ReturnType<typeof yargs>,
  createHandlers: SubtitleHandlerFactory,
): void {
  parser.command(
    "subtitle <path>",
    "Fetch missing subtitles for matched Episodes",
    (yargs) =>
      yargs
        .positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        })
        .option("lang", {
          type: "string",
          default: SCHEMA_DEFAULTS["subtitle-language"],
          describe: "Subtitle language code (e.g. en, ja, fr)",
        })
        .option("force", {
          type: "boolean",
          default: false,
          describe: "Overwrite existing subtitle files",
        }),
    async (argv) => {
      const level: LogLevel = argv["verbose"] ? "debug" : argv["quiet"] ? "error" : "info";
      const logger = createLogger(level);
      const handlers = await createHandlers(argv["verbose"] as boolean | undefined);
      if (!handlers) return;
      await wrapCommand(async () =>
        handlers.fetch(argv.path, { language: argv.lang, force: argv.force }, logger),
      );
    },
  );
}
