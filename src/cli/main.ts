import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { getDefaultPrompts } from "../config/config-wizard.ts";
import { CredentialStore } from "../config/credential-store.ts";
import { AniDBAdapter } from "../db/anidb-adapter.ts";
import { TVDBAdapter } from "../db/tvdb-adapter.ts";
import { parse } from "../parser.ts";
import { render } from "../template-engine.ts";
import { createConfigHandlers } from "./config-commands.ts";
import { createDBCommands } from "./db-commands.ts";
import { createMatchHandlers } from "./match-commands.ts";
import { createScanHandlers } from "./scan-commands.ts";

async function createTVDBCommandsWithCredentials() {
  const credentialStore = new CredentialStore();
  const apiKey = await credentialStore.getCredential("tvdb");
  if (!apiKey) {
    console.error("No TVDB API key configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const adapter = new TVDBAdapter({ apiKey });
  return createDBCommands(adapter);
}

async function createAniDBCommandsWithCredentials() {
  const credentialStore = new CredentialStore();
  const credential = await credentialStore.getCredential("anidb");
  if (!credential) {
    console.error("No AniDB credentials configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const [client, clientver] = credential.split(":", 2);
  const adapter = new AniDBAdapter({
    client: client ?? credential,
    clientver: clientver ?? "1",
  });
  return createDBCommands(adapter);
}

async function createScanWithCredentials() {
  const credentialStore = new CredentialStore();
  const apiKey = await credentialStore.getCredential("tvdb");
  if (!apiKey) {
    console.error("No TVDB API key configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const adapter = new TVDBAdapter({ apiKey });
  return createScanHandlers({ database: adapter });
}

async function createMatchWithCredentials() {
  const credentialStore = new CredentialStore();
  const apiKey = await credentialStore.getCredential("tvdb");
  if (!apiKey) {
    console.error("No TVDB API key configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const adapter = new TVDBAdapter({ apiKey });
  return createMatchHandlers({ database: adapter });
}

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
      async (argv) => {
        const handlers = await createScanWithCredentials();
        if (!handlers) return;
        try {
          const output = await handlers.scan(argv.path);
          console.log(output);
        } catch (err) {
          console.error(String(err));
        }
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
                    .option("anime-id", {
                      type: "string",
                      describe: "Anime ID to override with",
                    })
                    .option("episode-id", {
                      type: "string",
                      describe: "Episode ID to override with",
                    })
                    .option("type", {
                      type: "string",
                      describe: "Entry type (tv, movie, ova, special)",
                    }),
                async (argv) => {
                  const handlers = createConfigHandlers();
                  await handlers.overrideSet(
                    argv.hash,
                    {
                      animeId: argv["anime-id"],
                      episodeId: argv["episode-id"],
                      entryType: argv.type as "tv" | "movie" | "ova" | "special" | undefined,
                    },
                    console.log,
                    console.error,
                  );
                },
              )
              .command(
                "list",
                "List all overrides",
                () => {},
                async () => {
                  const handlers = createConfigHandlers();
                  await handlers.overrideList(console.log, console.error);
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
                  const handlers = createConfigHandlers();
                  await handlers.overrideRemove(argv.hash, console.log, console.error);
                },
              )
              .demandCommand(1, "Please specify an override action: set, list, or remove"),
          )
          .demandCommand(1, "Please specify a config action: get, set, init, or override"),
      () => {},
    )
    .command(
      "db",
      "Query databases for Anime and Episode data",
      (yargs) =>
        yargs
          .command(
            "search <title>",
            "Search for Anime by title on TVDB and print results as JSON",
            (yargs) =>
              yargs.positional("title", {
                type: "string",
                demandOption: true,
                describe: "Anime title to search for",
              }),
            async (argv) => {
              const commands = await createTVDBCommandsWithCredentials();
              if (!commands) return;
              await commands.search(argv.title, console.log, console.error);
            },
          )
          .command(
            "episodes <animeId>",
            "Get episodes for an Anime by TVDB ID and print as JSON",
            (yargs) =>
              yargs.positional("animeId", {
                type: "string",
                demandOption: true,
                describe: "TVDB Anime ID",
              }),
            async (argv) => {
              const commands = await createTVDBCommandsWithCredentials();
              if (!commands) return;
              await commands.episodes(argv.animeId, console.log, console.error);
            },
          )
          .command(
            "anidb",
            "Query AniDB database for Anime and Episode data",
            (yargs) =>
              yargs
                .command(
                  "search <title>",
                  "Search for Anime by title on AniDB and print results as JSON",
                  (yargs) =>
                    yargs.positional("title", {
                      type: "string",
                      demandOption: true,
                      describe: "Anime title to search for",
                    }),
                  async (argv) => {
                    const commands = await createAniDBCommandsWithCredentials();
                    if (!commands) return;
                    await commands.search(argv.title, console.log, console.error);
                  },
                )
                .command(
                  "episodes <animeId>",
                  "Get episodes for an Anime by AniDB AID and print as JSON",
                  (yargs) =>
                    yargs.positional("animeId", {
                      type: "string",
                      demandOption: true,
                      describe: "AniDB Anime ID",
                    }),
                  async (argv) => {
                    const commands = await createAniDBCommandsWithCredentials();
                    if (!commands) return;
                    await commands.episodes(argv.animeId, console.log, console.error);
                  },
                )
                .demandCommand(1, "Please specify an anidb action: search or episodes"),
            () => {},
          )
          .demandCommand(1, "Please specify a db action: search, episodes, or anidb"),
      () => {},
    )
    .command(
      "match <filename>",
      "Parse a MediaFile filename and resolve Match candidates via the Database",
      (yargs) =>
        yargs.positional("filename", {
          type: "string",
          demandOption: true,
          describe: "The filename to parse and match",
        }),
      async (argv) => {
        const handlers = await createMatchWithCredentials();
        if (!handlers) return;
        await handlers.match(argv.filename, console.log, console.error);
      },
    )
    .command(
      "template <pattern>",
      "Test a rename pattern with {placeholder} variables",
      (yargs) =>
        yargs
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
