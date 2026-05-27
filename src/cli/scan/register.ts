import type yargs from "yargs";
import { SCHEMA_DEFAULTS } from "../../config/schema";
import type { FileAction } from "../../renamer";
import type { ScanResult } from "../../scanner";
import type { ScanOptions } from "./handlers";

export type ScanHandlerFactory = (debug?: boolean) => Promise<
  | {
      scan(path: string, scanOptions?: ScanOptions): Promise<ScanResult[]>;
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
          default: SCHEMA_DEFAULTS["rename-action"],
          describe: "File operation to perform",
        })
        .option("episode-numbering", {
          type: "string",
          choices: ["absolute", "relative"] as const,
          default: SCHEMA_DEFAULTS["episode-numbering"],
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
        .option("extensions", {
          type: "string",
          describe: "Comma-separated file extensions to scan (e.g. .mkv,.mp4)",
        })
        .option("concurrency", {
          type: "number",
          default: SCHEMA_DEFAULTS["scan-concurrency"],
          describe: "Number of files to process concurrently",
        }),
    async (argv) => {
      try {
        // biome-ignore lint/complexity/useLiteralKeys: yargs index signature
        const handlers = await createHandlers(argv["debug"] as boolean | undefined);
        if (!handlers) return;
        const extensions = argv.extensions
          ? (argv.extensions as string)
              .split(",")
              .map((e) => e.trim())
              .filter(Boolean)
          : undefined;
        const results = await handlers.scan(argv.path, {
          dryRun: argv["dry-run"] ?? false,
          yes: argv.yes ?? false,
          force: argv.force ?? false,
          action: argv.action as FileAction,
          episodeNumbering: argv["episode-numbering"] as "absolute" | "relative" | undefined,
          verbose: argv.verbose ?? false,
          quiet: argv.quiet ?? false,
          // biome-ignore lint/complexity/useLiteralKeys: yargs index signature
          json: !!argv["json"],
          extensions,
          concurrency: argv.concurrency,
        });

        // biome-ignore lint/complexity/useLiteralKeys: yargs index signature
        if (argv["json"]) {
          console.log(JSON.stringify(results, null, 2));
        }
      } catch (err) {
        console.error(String(err));
        process.exit(1);
      }
    },
  );
}
