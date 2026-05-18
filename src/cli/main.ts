import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { render } from "../template-engine.ts";

export function run(argv: string[]): string | undefined {
  let result: string | undefined;

  const parser = yargs(hideBin(argv))
    .scriptName("kogoro")
    .usage("$0 <command> [options]")
    .command(
      "scan <path>",
      "Scan a directory for MediaFiles, match against Databases, and organize",
      (yargs) =>
        yargs.positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to a directory or MediaFile to scan",
        }),
      () => {
        console.log("scan command — not yet implemented");
      },
    )
    .command(
      "artwork <path>",
      "Fetch missing artwork for matched Anime",
      (yargs) =>
        yargs.positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        }),
      () => {
        console.log("artwork command — not yet implemented");
      },
    )
    .command(
      "subtitle <path>",
      "Fetch missing subtitles for matched Episodes",
      (yargs) =>
        yargs.positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        }),
      () => {
        console.log("subtitle command — not yet implemented");
      },
    )
    .command(
      "metadata <path>",
      "Write missing .nfo metadata sidecar files",
      (yargs) =>
        yargs.positional("path", {
          type: "string",
          demandOption: true,
          describe: "Path to the organized anime directory",
        }),
      () => {
        console.log("metadata command — not yet implemented");
      },
    )
    .command(
      "config <action>",
      "Manage Kogoro configuration and Overrides",
      (yargs) =>
        yargs.positional("action", {
          type: "string",
          demandOption: true,
          describe: "Config action: init, get, set",
        }),
      () => {
        console.log("config command — not yet implemented");
      },
    )
    .command(
      "template <pattern>",
      "Test a rename pattern with {placeholder} variables",
      (yargs) =>
        yargs
          // Allow arbitrary --key value pairs to be passed as template variables
          .strict(false)
          .positional("pattern", {
            type: "string",
            demandOption: true,
            describe: "Template pattern with {placeholder} variables",
          })
          .option("anime", { type: "string", describe: "Anime title" })
          .option("season", { type: "number", describe: "Season number" })
          .option("episode", { type: "number", describe: "Episode number" })
          .option("title", { type: "string", describe: "Episode title" }),
      (argv) => {
        const ctx: Record<string, string | number> = {};
        const reservedKeys = new Set(["_", "$0", "pattern", "help", "version"]);
        for (const [key, value] of Object.entries(argv)) {
          if (!reservedKeys.has(key) && value !== undefined) {
            ctx[key] = value as string | number;
          }
        }
        result = render(argv.pattern, ctx);
      },
    )
    .demandCommand(1, "Please specify a command")
    .help()
    .alias("h", "help")
    .version("0.1.0")
    .alias("v", "version")
    .strict();

  parser.parse();

  return result;
}
