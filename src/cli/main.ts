import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getDefaultPrompts } from "../config/config-wizard.ts";
import { createConfigHandlers } from "./config-commands.ts";

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
      "config",
      "Manage Kogoro configuration",
      (yargs) =>
        yargs
          .command(
            "get <key>",
            "Get a config value",
            (yargs) =>
              yargs.positional("key", {
                type: "string",
                demandOption: true,
                describe: "Config key to get",
              }),
            async (argv) => {
              const handlers = createConfigHandlers();
              await handlers.get(argv.key, console.log, console.error);
            },
          )
          .command(
            "set <key> <value>",
            "Set a config value",
            (yargs) =>
              yargs
                .positional("key", {
                  type: "string",
                  demandOption: true,
                  describe: "Config key to set",
                })
                .positional("value", {
                  type: "string",
                  demandOption: true,
                  describe: "Value to set",
                }),
            async (argv) => {
              const handlers = createConfigHandlers();
              await handlers.set(argv.key, argv.value, console.log);
            },
          )
          .command(
            "init",
            "Run the first-time setup wizard",
            () => {},
            async () => {
              const prompts = getDefaultPrompts();
              const handlers = createConfigHandlers();
              await handlers.init(prompts, console.log);
            },
          )
          .demandCommand(1, "Please specify a config action: get, set, or init"),
      () => {},
    )
    .demandCommand(1, "Please specify a command")
    .help()
    .alias("h", "help")
    .version("0.1.0")
    .alias("v", "version")
    .strict()
    .parse();
}
