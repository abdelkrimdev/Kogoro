import { cancel, confirm, intro, isCancel, outro, select, text } from "@clack/prompts";
import type { PromptsAPI } from "@kogoro/core";
import type yargs from "yargs";
import { wrapCommand } from "../wrap";
import { createConfigHandlers } from "./handlers";

function getDefaultPrompts(): PromptsAPI {
  return { intro, outro, select, text, confirm, cancel, isCancel };
}

export function registerConfig(parser: ReturnType<typeof yargs>): void {
  parser.command(
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
            await wrapCommand(async () => handlers.get(argv.key));
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
            await wrapCommand(async () => handlers.set(argv.key, argv.value));
          },
        )
        .command(
          "init",
          "Run the first-time setup wizard",
          () => {},
          async () => {
            const prompts = getDefaultPrompts();
            const handlers = createConfigHandlers();
            await wrapCommand(async () => handlers.init(prompts), { redirectStdout: true });
          },
        )
        .demandCommand(1, "Please specify a config action: get, set, or init"),
    () => {},
  );
}
