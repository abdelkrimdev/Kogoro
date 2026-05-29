import { readFileSync } from "node:fs";
import { styleText } from "node:util";
import { ConfigManager, createCredentialStore, MatchCache, OverrideStore } from "@kogoro/core";
import { type DatabasePlugin, PluginFactory } from "@kogoro/plugins";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { registerArtwork } from "./artwork/register";
import { registerCache } from "./cache/register";
import { registerConfig } from "./config/register";
import { registerDb } from "./database/register";
import { registerMetadata } from "./metadata/register";
import { registerPlugins } from "./plugins/register";
import { registerScan } from "./scan/register";
import { registerSubtitle } from "./subtitle/register";

function readVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL("../../../package.json", import.meta.url), "utf-8"),
    ) as { version: string };
    return pkg.version;
  } catch {
    return "0.1.0";
  }
}

export function run(argv: string[]): void {
  const config = new ConfigManager();
  const credentialStore = createCredentialStore();

  function createFactory(debug?: boolean): PluginFactory {
    return new PluginFactory(config, credentialStore, debug);
  }

  async function withDatabase<T>(
    debug: boolean | undefined,
    getDatabase: (factory: PluginFactory) => Promise<DatabasePlugin | undefined>,
    buildHandlers: (database: DatabasePlugin) => T,
  ): Promise<T | undefined> {
    const factory = createFactory(debug);
    const database = await getDatabase(factory);
    if (!database) return undefined;
    return buildHandlers(database);
  }

  async function createDatabaseCommandsWithCredentials(debug?: boolean) {
    const { createDatabaseHandlers } = await import("./database/handlers");
    return withDatabase(
      debug,
      (factory) => factory.primaryDatabase(),
      (database) => createDatabaseHandlers(database),
    );
  }

  async function createScanWithCredentials(debug?: boolean) {
    const { createScanHandlers } = await import("./scan/handlers");
    const factory = createFactory(debug);
    const database = await factory.primaryDatabase();
    if (!database) return undefined;
    const fallbackDatabases = await factory.secondaryDatabases();
    const cache = new MatchCache();
    const overrideStore = new OverrideStore(process.cwd());
    return createScanHandlers({
      database,
      fallbackDatabases,
      cache,
      config,
      overrideStore,
    });
  }

  async function createMetadataWithCredentials(debug?: boolean) {
    const { createMetadataHandlers } = await import("./metadata/handlers");
    return withDatabase(
      debug,
      (factory) => factory.primaryDatabase(),
      (database) => createMetadataHandlers({ database, config }),
    );
  }

  async function createArtworkWithCredentials(debug?: boolean) {
    const { createArtworkHandlers } = await import("./artwork/handlers");
    const factory = createFactory(debug);
    const database = await factory.primaryDatabase();
    if (!database) return undefined;
    const fallbackDatabases = await factory.secondaryDatabases();
    return createArtworkHandlers({ primaryDb: database, secondaryDbs: fallbackDatabases, config });
  }

  async function createSubtitleWithCredentials(debug?: boolean) {
    const { createSubtitleHandlers } = await import("./subtitle/handlers");
    const factory = createFactory(debug);
    const subtitlePlugin = await factory.subtitle();
    if (!subtitlePlugin) return undefined;
    const cache = new MatchCache();
    return createSubtitleHandlers({ subtitlePlugin, cache, config });
  }

  const parser = yargs(hideBin(argv))
    .scriptName("kogoro")
    .usage("$0 <command> [options]")
    .option("json", {
      type: "boolean",
      default: false,
      describe: "Output as JSON",
    })
    .option("debug", {
      type: "boolean",
      default: false,
      describe: "Enable debug logging",
    });

  registerScan(parser, createScanWithCredentials);
  registerArtwork(parser, createArtworkWithCredentials);
  registerSubtitle(parser, createSubtitleWithCredentials);
  registerMetadata(parser, createMetadataWithCredentials);
  registerConfig(parser);
  registerDb(parser, createDatabaseCommandsWithCredentials);
  registerCache(parser);
  registerPlugins(parser, config);

  parser
    .demandCommand(1, "Please specify a command")
    .help()
    .alias("h", "help")
    .version(readVersion())
    .alias("v", "version")
    .strict()
    .fail((msg, err) => {
      if (err) {
        if (process.argv.includes("--debug")) {
          console.error(styleText("red", err.stack ?? String(err)));
        } else {
          console.error(styleText("red", `❌ ${err.message}`));
        }
      } else {
        console.error(styleText("red", `❌ ${msg}`));
      }
      process.exit(1);
    })
    .parse();
}
