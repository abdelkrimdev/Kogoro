import { OVERRIDE_TOML_KEYS } from "@kogoro/core";
import type yargs from "yargs";
import { getDefaultPrompts } from "./default-prompts";
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
          (argv) => {
            const handlers = createConfigHandlers();
            console.log(JSON.stringify(handlers.get(argv.key)));
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
          (argv) => {
            const handlers = createConfigHandlers();
            console.log(JSON.stringify(handlers.set(argv.key, argv.value)));
          },
        )
        .command(
          "init",
          "Run the first-time setup wizard",
          () => {},
          async () => {
            const prompts = getDefaultPrompts();
            const handlers = createConfigHandlers();
            await handlers.init(prompts);
            console.log(JSON.stringify(true));
          },
        )
        .command("override", "Manage per-directory overrides in kogoro.toml", (yargs) =>
          yargs
            .command(
              "set <hash>",
              "Set an override for a file hash",
              (yargs) =>
                yargs
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
              (argv) => {
                const handlers = createConfigHandlers();
                console.log(
                  JSON.stringify(
                    handlers.overrideSet(argv.hash, {
                      animeId: argv[OVERRIDE_TOML_KEYS.ANIME_ID],
                      episodeId: argv[OVERRIDE_TOML_KEYS.EPISODE_ID],
                      entryType: argv[OVERRIDE_TOML_KEYS.ENTRY_TYPE] as
                        | "tv"
                        | "movie"
                        | "ova"
                        | "special"
                        | undefined,
                    }),
                  ),
                );
              },
            )
            .command(
              "list",
              "List all overrides",
              () => {},
              () => {
                const handlers = createConfigHandlers();
                console.log(JSON.stringify(handlers.overrideList()));
              },
            )
            .command(
              "remove <hash>",
              "Remove an override for a file hash",
              (yargs) =>
                yargs.positional("hash", {
                  type: "string",
                  demandOption: true,
                  describe: "File hash to remove override for",
                }),
              (argv) => {
                const handlers = createConfigHandlers();
                console.log(JSON.stringify(handlers.overrideRemove(argv.hash)));
              },
            )
            .demandCommand(1, "Please specify an override action: set, list, or remove"),
        )
        .demandCommand(1, "Please specify a config action: get, set, init, or override"),
    () => {},
  );
}
