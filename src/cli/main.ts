import { confirm, isCancel } from "@clack/prompts";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ConfigManager } from "../config/config-manager.ts";
import { getDefaultPrompts } from "../config/config-wizard.ts";
import { CredentialStore } from "../config/credential-store.ts";
import { AniDBAdapter } from "../db/anidb-adapter.ts";
import type { DatabasePlugin } from "../db/database-plugin.ts";
import { TVDBAdapter } from "../db/tvdb-adapter.ts";
import { MatchCache } from "../match-cache.ts";
import { parse } from "../parser.ts";
import type { FileAction } from "../renamer.ts";
import { OpenSubtitlesAdapter } from "../subtitle/opensubtitles-adapter.ts";
import { render } from "../template-engine.ts";
import { createArtworkHandlers } from "./artwork-commands.ts";
import { createCacheHandlers } from "./cache-commands.ts";
import { createConfigHandlers } from "./config-commands.ts";
import { createDBCommands } from "./db-commands.ts";
import { createMatchHandlers } from "./match-commands.ts";
import { createMetadataHandlers } from "./metadata-commands.ts";
import { createRenameHandlers } from "./rename-commands.ts";
import { createScanHandlers } from "./scan-commands.ts";
import { createSubtitleHandlers } from "./subtitle-commands.ts";

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
  const cache = new MatchCache();
  const config = new ConfigManager();
  return createScanHandlers({ database: adapter, cache, config });
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

async function createArtworkWithCredentials() {
  const credentialStore = new CredentialStore();
  const tvdbKey = await credentialStore.getCredential("tvdb");
  if (!tvdbKey) {
    console.error("No TVDB API key configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const primaryDb: DatabasePlugin = new TVDBAdapter({ apiKey: tvdbKey });

  const secondaryDbs: DatabasePlugin[] = [];
  const anidbCred = await credentialStore.getCredential("anidb");
  if (anidbCred) {
    const [client, clientver] = anidbCred.split(":", 2);
    secondaryDbs.push(
      new AniDBAdapter({ client: client ?? anidbCred, clientver: clientver ?? "1" }),
    );
  }

  return createArtworkHandlers({ primaryDb, secondaryDbs });
}

async function createSubtitleWithCredentials() {
  const credentialStore = new CredentialStore();
  const apiKey = await credentialStore.getCredential("opensubtitles");
  if (!apiKey) {
    console.error("No OpenSubtitles API key configured. Run 'kogoro config init' first.");
    return undefined;
  }
  const adapter = new OpenSubtitlesAdapter({ apiKey });
  const cache = new MatchCache();
  return createSubtitleHandlers({ subtitlePlugin: adapter, cache });
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
          }),
      async (argv) => {
        const handlers = await createScanWithCredentials();
        if (!handlers) return;
        try {
          const output = await handlers.scan(argv.path, {
            dryRun: argv["dry-run"] ?? false,
            yes: argv.yes ?? false,
            force: argv.force ?? false,
            action: argv.action as FileAction,
          });
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
        yargs
          .positional("path", {
            type: "string",
            demandOption: true,
            describe: "Path to the organized anime directory",
          })
          .option("force", {
            type: "boolean",
            default: false,
            describe: "Overwrite existing cover.jpg files",
          })
          .option("verbose", {
            type: "boolean",
            default: false,
            describe: "Show per-anime status messages",
          }),
      async (argv) => {
        const handlers = await createArtworkWithCredentials();
        if (!handlers) return;
        await handlers.process(
          argv.path,
          { force: argv.force, verbose: argv.verbose },
          console.log,
          console.error,
        );
      },
    )
    .command(
      "subtitle <path>",
      "Fetch missing subtitles for matched Episodes",
      (yargs) =>
        yargs
          .positional("path", {
            type: "string",
            demandOption: true,
            describe: "Path to the organized anime directory",
          })
          .option("lang", {
            type: "string",
            default: "en",
            describe: "Subtitle language code (e.g. en, ja, fr)",
          })
          .option("force", {
            type: "boolean",
            default: false,
            describe: "Overwrite existing subtitle files",
          }),
      async (argv) => {
        const handlers = await createSubtitleWithCredentials();
        if (!handlers) return;
        await handlers.fetch(
          argv.path,
          { language: argv.lang, force: argv.force },
          console.log,
          console.error,
        );
      },
    )
    .command(
      "metadata <path>",
      "Write missing .nfo metadata sidecar files",
      (yargs) =>
        yargs
          .positional("path", {
            type: "string",
            demandOption: true,
            describe: "Path to the organized anime directory",
          })
          .option("force", {
            type: "boolean",
            default: false,
            describe: "Overwrite existing .nfo files",
          }),
      async (argv) => {
        const handlers = createMetadataHandlers();
        await handlers.write(argv.path, argv.force, console.log, console.error);
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
      "cache",
      "Manage the Match cache (SQLite database keyed by file hash)",
      (yargs) =>
        yargs
          .command(
            "list",
            "List all cached Match entries as JSON",
            () => {},
            async () => {
              const handlers = createCacheHandlers();
              await handlers.list(console.log, console.error);
            },
          )
          .command(
            "lookup <hash>",
            "Look up a cached Match by file hash",
            (yargs) =>
              yargs.positional("hash", {
                type: "string",
                demandOption: true,
                describe: "SHA-256 hash of the file",
              }),
            async (argv) => {
              const handlers = createCacheHandlers();
              await handlers.lookup(argv.hash, console.log, console.error);
            },
          )
          .command(
            "clear",
            "Clear all cached Match entries (requires confirmation)",
            () => {},
            async () => {
              const handlers = createCacheHandlers();
              const response = await confirm({
                message: "Are you sure you want to clear the entire Match cache?",
              });
              const confirmed = !isCancel(response) && response === true;
              await handlers.clear(confirmed, console.log, console.error);
            },
          )
          .demandCommand(1, "Please specify a cache action: list, lookup, or clear"),
      () => {},
    )
    .command(
      "rename <source-file>",
      "Plan and execute a rename for a single MediaFile (debugging CLI)",
      (yargs) =>
        yargs
          .positional("source-file", {
            type: "string",
            demandOption: true,
            describe: "Path to the source MediaFile",
          })
          .option("anime", { type: "string", demandOption: true, describe: "Anime title" })
          .option("type", {
            type: "string",
            demandOption: true,
            describe: "Entry type (tv, movie, ova, special)",
          })
          .option("season", { type: "number", describe: "Season number" })
          .option("episode", { type: "number", describe: "Episode number" })
          .option("title", { type: "string", describe: "Episode title" })
          .option("action", {
            type: "string",
            choices: ["move", "copy", "symlink", "hardlink"] as const,
            default: "move",
            describe: "File operation to perform",
          }),
      async (argv) => {
        const handlers = createRenameHandlers();
        await handlers.rename(
          argv["source-file"],
          {
            anime: argv.anime,
            entryType: argv.type,
            season: argv.season,
            episode: argv.episode,
            title: argv.title,
            action: argv.action as FileAction,
          },
          console.log,
          console.error,
        );
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
