import { log } from "@clack/prompts";
import { getDefaultPrompts, OVERRIDE_TOML_KEYS } from "@kogoro/core";
import type yargs from "yargs";
import { createFormatter } from "../format";
import { createConfigHandlers } from "./handlers";

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
            const json = !!argv["json"];
            await handlers.get(
              argv.key,
              createFormatter(json, (msg) => log.error(msg)),
              (msg) => log.error(msg),
            );
          },
        )
        .command(
          "set <key> <value>",
          "Set a config value",
          (yargs) =>
            yargs
              .hide("json")
              .hide("debug")
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
            await handlers.set(
              argv.key,
              argv.value,
              (msg) => log.message(msg),
              (msg) => log.error(msg),
            );
          },
        )
        .command(
          "init",
          "Run the first-time setup wizard",
          (yargs) => yargs.hide("json").hide("debug"),
          async () => {
            const prompts = getDefaultPrompts();
            const handlers = createConfigHandlers();
            await handlers.init(prompts, (msg) => log.message(msg));
          },
        )
        .command("override", "Manage per-directory overrides in kogoro.toml", (yargs) =>
          yargs
            .command(
              "set <hash>",
              "Set an override for a file hash",
              (yargs) =>
                yargs
                  .hide("json")
                  .hide("debug")
                  .positional("hash", {
                    type: "string",
                    demandOption: true,
                    describe: "File hash to override",
                  })
                  .option(OVERRIDE_TOML_KEYS.ANIME_ID, {
                    type: "string",
                    describe: "Anime ID to override with",
                  })
                  .option(OVERRIDE_TOML_KEYS.EPISODE_ID, {
                    type: "string",
                    describe: "Episode ID to override with",
                  })
                  .option(OVERRIDE_TOML_KEYS.ENTRY_TYPE, {
                    type: "string",
                    describe: "Entry type (tv, movie, ova, special)",
                  }),
              async (argv) => {
                const handlers = createConfigHandlers();
                await handlers.overrideSet(
                  argv.hash,
                  {
                    animeId: argv[OVERRIDE_TOML_KEYS.ANIME_ID],
                    episodeId: argv[OVERRIDE_TOML_KEYS.EPISODE_ID],
                    entryType: argv[OVERRIDE_TOML_KEYS.ENTRY_TYPE] as
                      | "tv"
                      | "movie"
                      | "ova"
                      | "special"
                      | undefined,
                  },
                  (msg) => log.message(msg),
                );
              },
            )
            .command(
              "list",
              "List all overrides",
              () => {},
              async (argv) => {
                const handlers = createConfigHandlers();
                await handlers.overrideList(
                  createFormatter(!!argv["json"], (msg) => log.error(msg)),
                );
              },
            )
            .command(
              "remove <hash>",
              "Remove an override for a file hash",
              (yargs) =>
                yargs.hide("json").hide("debug").positional("hash", {
                  type: "string",
                  demandOption: true,
                  describe: "File hash to remove override for",
                }),
              async (argv) => {
                const handlers = createConfigHandlers();
                await handlers.overrideRemove(
                  argv.hash,
                  (msg) => log.message(msg),
                  (msg) => log.error(msg),
                );
              },
            )
            .demandCommand(1, "Please specify an override action: set, list, or remove"),
        )
        .demandCommand(1, "Please specify a config action: get, set, init, or override"),
    () => {},
  );
}
