import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { parse } from "../parser.ts";

export function run(argv: string[]) {
  return yargs(hideBin(argv))
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
      "parse <filename>",
      "Parse a MediaFile filename and print the ParsedResult as JSON",
      (yargs) =>
        yargs.positional("filename", {
          type: "string",
          demandOption: true,
          describe: "The filename to parse",
        }),
      (argv) => {
        const result = parse(argv.filename);
        console.log(JSON.stringify(result, null, 2));
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
    .demandCommand(1, "Please specify a command")
    .help()
    .alias("h", "help")
    .version("0.1.0")
    .alias("v", "version")
    .strict()
    .parse();
}
