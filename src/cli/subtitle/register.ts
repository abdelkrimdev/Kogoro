import type yargs from "yargs";
import { SCHEMA_DEFAULTS } from "../../config/schema";

export type SubtitleHandlerFactory = (debug?: boolean) => Promise<
  | {
      fetch(
        dirPath: string,
        opts: { language?: string; force?: boolean },
        onLog: (msg: string) => void,
        onError: (msg: string) => void,
      ): Promise<void>;
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
        })
        .option("debug", {
          type: "boolean",
          default: false,
          describe: "Dump API requests and responses",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv.debug);
      if (!handlers) return;
      await handlers.fetch(
        argv.path,
        { language: argv.lang, force: argv.force },
        console.log,
        console.error,
      );
    },
  );
}
