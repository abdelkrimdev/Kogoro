import type yargs from "yargs";
import type { FileAction } from "../../renamer";
import type { ScanOptions } from "./handlers";

export type ScanHandlerFactory = (debug?: boolean) => Promise<
  | {
      scan(path: string, scanOptions?: ScanOptions): Promise<string>;
    }
  | undefined
>;

export function registerScan(
  parser: ReturnType<typeof yargs>,
  createHandlers: ScanHandlerFactory,
): void {
  parser.command(
    "scan <path>",
    "Scan a directory for MediaFiles, match against Databases, and organize",
    (yargs) =>
      yargs
        .positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to a directory or MediaFile to scan",
        })
        .option("dry-run", {
          type: "boolean",
          default: false,
          describe: "Print planned operations without executing",
        })
        .option("yes", {
          type: "boolean",
          alias: "y",
          default: false,
          describe: "Skip interactive prompts, auto-accept best match",
        })
        .option("force", {
          type: "boolean",
          default: false,
          describe: "Ignore cache and re-match from scratch",
        })
        .option("action", {
          type: "string",
          choices: ["move", "copy", "symlink", "hardlink"] as const,
          default: "move",
          describe: "File operation to perform",
        })
        .option("episode-numbering", {
          type: "string",
          choices: ["absolute", "relative"] as const,
          describe: "Override preferred episode numbering scheme",
        })
        .option("verbose", {
          type: "boolean",
          default: false,
          describe: "Show per-file status lines during scan",
        })
        .option("quiet", {
          type: "boolean",
          alias: "q",
          default: false,
          describe: "Suppress progress and summary; only errors and prompts",
        })
        .option("debug", {
          type: "boolean",
          default: false,
          describe: "Dump API requests and responses",
        })
        .option("json", {
          type: "boolean",
          default: false,
          describe: "Output final scan report as JSON",
        })
        .option("concurrency", {
          type: "number",
          default: 1,
          describe: "Number of files to process concurrently",
        }),
    async (argv) => {
      const handlers = await createHandlers(argv.debug);
      if (!handlers) return;
      try {
        const output = await handlers.scan(argv.path, {
          dryRun: argv["dry-run"] ?? false,
          yes: argv.yes ?? false,
          force: argv.force ?? false,
          action: argv.action as FileAction,
          verbose: argv.verbose ?? false,
          quiet: argv.quiet ?? false,
          debug: argv.debug ?? false,
          json: argv.json ?? false,
          concurrency: argv.concurrency ?? 1,
        });
        console.log(output);
      } catch (err) {
        console.error(String(err));
      }
    },
  );
}
