import { OVERRIDE_TOML_KEYS } from "@kogoro/core";
import type yargs from "yargs";
import { wrapCommand } from "../wrap";
import { createOverrideHandlers } from "./handlers";

export function registerOverride(parser: ReturnType<typeof yargs>): void {
  parser.command(
    "override",
    "Manage per-directory overrides in kogoro.toml",
    (yargs) =>
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
          async (argv) => {
            const handlers = createOverrideHandlers();
            await wrapCommand(async () =>
              handlers.set(argv.hash, {
                animeId: argv[OVERRIDE_TOML_KEYS.ANIME_ID],
                episodeId: argv[OVERRIDE_TOML_KEYS.EPISODE_ID],
                entryType: argv[OVERRIDE_TOML_KEYS.ENTRY_TYPE] as
                  | "tv"
                  | "movie"
                  | "ova"
                  | "special"
                  | undefined,
              }),
            );
          },
        )
        .command(
          "list",
          "List all overrides",
          () => {},
          async () => {
            const handlers = createOverrideHandlers();
            await wrapCommand(async () => handlers.list());
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
          async (argv) => {
            const handlers = createOverrideHandlers();
            await wrapCommand(async () => handlers.remove(argv.hash));
          },
        )
        .demandCommand(1, "Please specify an override action: set, list, or remove"),
    () => {},
  );
}
