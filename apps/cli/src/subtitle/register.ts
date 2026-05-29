import { SCHEMA_DEFAULTS, type TaskContext } from "@kogoro/core";
import type yargs from "yargs";
import { createProgressTracker } from "../progress";

type SubtitleHandlerFactory = (debug?: boolean) => Promise<
  | {
      fetch(
        dirPath: string,
        opts: { language?: string; force?: boolean },
        ctx?: TaskContext,
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
        }),
    async (argv) => {
      const handlers = await createHandlers(argv["debug"] as boolean | undefined);
      if (!handlers) return;
      const tracker = createProgressTracker();
      tracker.start("Fetching subtitles...");
      await handlers.fetch(argv.path, { language: argv.lang, force: argv.force }, tracker.ctx);
      tracker.stop("Done");
    },
  );
}
